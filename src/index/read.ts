import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync, SQLInputValue, StatementSync } from 'node:sqlite';
import { parseFields, splitNote } from '../frontmatter.js';
import { readSection } from '../sections.js';
import { titleTokens } from '../similarity.js';
import { KilnError, type Fields } from '../types.js';
import type { Index } from './db.js';
import { sha256 } from './reconcile.js';

export type NoteRef = {
  id: string | null;
  path: string;
  title: string;
  type: string | null;
  kind: string | null;
  status: string | null;
  updated: string | null;
};

export type SearchHit = {
  id: string | null;
  path: string;
  title: string;
  type: string | null;
  kind: string | null;
  status: string | null;
  score: number;
  snippet: string;
};

export type Brief = {
  note: NoteRef;
  summary: string;
  currentTruth: string;
  activeDecisions: NoteRef[];
  openWork: NoteRef[];
  recent: NoteRef[];
};

export type NoteRecord = { id: string | null; path: string; fields: Fields; body: string; revision: string };

export type SearchParams = {
  q: string;
  variants?: string[];
  scopeAnchors?: string[];
  autoScope?: boolean;
  limit?: number;
};

export type QueryFilter = {
  type?: string;
  kind?: string;
  status?: string;
  anchors?: string[];
  project?: string;
  review?: boolean;
  triage?: string;
  updatedAfter?: string;
  limit?: number;
};

export type ResolveResult = { matches: NoteRef[]; brief: Brief | null };

export type IndexStatus = { base: string; notes: number; inbox: number; needsReview: number };

const SNIPPET_MAX = 200;
const CURRENT_TRUTH_MAX = 1500;
const BRIEF_LIST_MAX = 10;
const BRIEF_RECENT_MAX = 5;
const RESOLVE_FTS_MAX = 10;

/** Status boosts multiplied into the BM25 score (spec global constraints). */
const BOOST = `CASE n.type
  WHEN 'anchor' THEN 1.6
  WHEN 'project' THEN 1.3
  WHEN 'work' THEN 1.3
  WHEN 'decision' THEN CASE n.status WHEN 'active' THEN 1.6 WHEN 'proposed' THEN 1.3 WHEN 'superseded' THEN 0.4 ELSE 1.0 END
  ELSE 1.0 END`;

/** Field-weighted BM25 (title 5, aliases 3, summary 2, keywords 0.5, body 1), negated so that higher is better. */
const SCORE = `-bm25(fts, 5, 3, 2, 0.5, 1) * (${BOOST})`;

const REF_COLS = 'n.id, n.path, n.title, n.type, n.kind, n.status, n.updated';
const NEWEST_FIRST = 'ORDER BY n.updated IS NULL, n.updated DESC, n.path';
/** Notes with a link whose lowercased target is in the JSON array bound here. Driven by the `links_target_lc` index. */
const LINKS_ANY = 'n.path IN (SELECT l.src_path FROM links l WHERE l.target_lc IN (SELECT value FROM json_each(?)))';

type NoteRow = NoteRef & { fields_json: string };
type HitRow = NoteRow & { score: number };

const statements = new WeakMap<DatabaseSync, Map<string, StatementSync>>();

/**
 * A prepared statement, cached per connection. The first call on a connection also registers `kiln_lower`, a
 * Unicode-aware `lower()` (SQLite's own folds ASCII only), and `kiln_link_target`, which reads a `[[target|label]]`
 * (or plain) value as its lowercased target.
 */
function stmt(ix: Index, sql: string): StatementSync {
  let cache = statements.get(ix.db);
  if (!cache) {
    ix.db.function('kiln_lower', { deterministic: true }, (v) => (typeof v === 'string' ? v.toLowerCase() : v));
    ix.db.function('kiln_link_target', { deterministic: true }, (v) =>
      typeof v === 'string' ? stripLink(v).toLowerCase() : v,
    );
    cache = new Map();
    statements.set(ix.db, cache);
  }
  let s = cache.get(sql);
  if (!s) {
    s = ix.db.prepare(sql);
    cache.set(sql, s);
  }
  return s;
}

function all<T>(ix: Index, sql: string, ...params: SQLInputValue[]): T[] {
  return stmt(ix, sql).all(...params) as T[];
}

function toRef(r: NoteRef): NoteRef {
  return { id: r.id, path: r.path, title: r.title, type: r.type, kind: r.kind, status: r.status, updated: r.updated };
}

/** `[[Name]]`, `[[Name|label]]` or `Name` → `Name`. */
function stripLink(name: string): string {
  const m = /^\s*\[\[([^\]]*)\]\]\s*$/.exec(name);
  return (m ? m[1]!.split('|')[0]!.split('#')[0]! : name).trim();
}

function stemOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
}

/** At most `max` UTF-16 units, never ending on half a surrogate pair. */
function cap(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

/** The note's file text, or null when the file has gone since it was indexed. */
function readNote(ix: Index, path: string): string | null {
  try {
    return readFileSync(join(ix.base.path, path), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

function summaryOf(fieldsJson: string): string {
  const s = (JSON.parse(fieldsJson) as Fields).summary;
  return typeof s === 'string' ? s.trim() : '';
}

/** Lowercase search words of `q` and its variants, stopwords removed. */
function searchTerms(q: string, variants: string[]): string[] {
  const terms = new Set<string>();
  for (const text of [q, ...variants]) for (const t of titleTokens(text)) terms.add(t);
  return [...terms];
}

/** An FTS5 query OR-ing each term as a quoted string. */
function ftsQuery(terms: string[]): string {
  return terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(' OR ');
}

/** Every lowercased name a link can use to reach the note at `path`: its title, its aliases and its file stem. */
function namesOf(ix: Index, path: string): string[] {
  const names = new Set(
    all<{ name_lc: string }>(ix, 'SELECT name_lc FROM aliases WHERE path = ?', path).map((r) => r.name_lc),
  );
  names.add(stemOf(path).toLowerCase());
  return [...names];
}

/** Notes whose title or alias is `name` (lowercased): anchors and projects first, falling back to any type. */
function notesNamed(ix: Index, nameLc: string): NoteRow[] {
  const sql = (where: string) =>
    `SELECT DISTINCT ${REF_COLS}, n.fields_json FROM aliases a JOIN notes n ON n.path = a.path
     WHERE a.name_lc = ? ${where} ORDER BY n.type = 'anchor' DESC, n.path`;
  const preferred = all<NoteRow>(ix, sql("AND n.type IN ('anchor', 'project')"), nameLc);
  return preferred.length > 0 ? preferred : all<NoteRow>(ix, sql(''), nameLc);
}

/**
 * The notes behind a list of anchor names, and every lowercased name that links to them (including the given names
 * themselves, so a link to an anchor that has no note yet still counts).
 */
function scopeOf(ix: Index, names: string[]): { notes: NoteRow[]; linkNames: string[] } {
  const notes = new Map<string, NoteRow>();
  const linkNames = new Set<string>();
  for (const raw of names) {
    const lc = stripLink(raw).toLowerCase();
    if (lc === '') continue;
    linkNames.add(lc);
    for (const n of notesNamed(ix, lc)) {
      if (notes.has(n.path)) continue;
      notes.set(n.path, n);
      for (const name of namesOf(ix, n.path)) linkNames.add(name);
    }
  }
  return { notes: [...notes.values()], linkNames: [...linkNames] };
}

/** The summary when present; else the first body line containing a term, trimmed and capped; else `''`. */
function snippetOf(ix: Index, row: NoteRow, terms: string[]): string {
  const summary = summaryOf(row.fields_json);
  if (summary !== '') return summary;
  const text = readNote(ix, row.path);
  if (text === null) return '';
  for (const line of splitNote(text).body.split(/\r?\n/)) {
    const lc = line.toLowerCase();
    if (terms.some((t) => lc.includes(t))) return cap(line.trim(), SNIPPET_MAX);
  }
  return '';
}

function toHit(ix: Index, row: NoteRow, score: number, terms: string[]): SearchHit {
  return {
    id: row.id,
    path: row.path,
    title: row.title,
    type: row.type,
    kind: row.kind,
    status: row.status,
    score,
    snippet: snippetOf(ix, row, terms),
  };
}

/**
 * Field-weighted, boosted BM25 over the words of `q` and its variants (OR-joined). With a scope (explicit, or the
 * anchors named in `q` when `autoScope` is on), results run: the scope anchor notes themselves (hits by score, then
 * non-hits), then hits linking a scope anchor, then the remaining hits; score order holds within each group.
 */
export function search(ix: Index, p: SearchParams): SearchHit[] {
  const limit = p.limit ?? 20;
  const terms = searchTerms(p.q, p.variants ?? []);
  if (terms.length === 0 || limit <= 0) return [];
  const match = ftsQuery(terms);

  const scopeNames = p.scopeAnchors?.length ? p.scopeAnchors : (p.autoScope ?? true) ? matchAnchors(ix, p.q) : [];
  const scope = scopeOf(ix, scopeNames);
  if (scope.notes.length === 0 && scope.linkNames.length === 0) {
    const rows = all<HitRow>(
      ix,
      `SELECT ${REF_COLS}, n.fields_json, ${SCORE} AS score FROM fts JOIN notes n ON n.rowid = fts.rowid
       WHERE fts MATCH ? ORDER BY score DESC, n.path LIMIT ?`,
      match,
      limit,
    );
    return rows.map((r) => toHit(ix, r, r.score, terms));
  }

  const anchorPaths = scope.notes.map((n) => n.path);
  const rows = all<HitRow & { grp: number }>(
    ix,
    `SELECT ${REF_COLS}, n.fields_json, ${SCORE} AS score,
       CASE WHEN n.path IN (SELECT value FROM json_each(?)) THEN 0 WHEN ${LINKS_ANY} THEN 1 ELSE 2 END AS grp
     FROM fts JOIN notes n ON n.rowid = fts.rowid
     WHERE fts MATCH ? ORDER BY grp, score DESC, n.path LIMIT ?`,
    JSON.stringify(anchorPaths),
    JSON.stringify(scope.linkNames),
    match,
    limit,
  );
  const hitPaths = new Set(rows.map((r) => r.path));
  const out: SearchHit[] = rows.filter((r) => r.grp === 0).map((r) => toHit(ix, r, r.score, terms));
  for (const n of scope.notes) if (!hitPaths.has(n.path)) out.push(toHit(ix, n, 0, terms));
  for (const r of rows) if (r.grp !== 0) out.push(toHit(ix, r, r.score, terms));
  return out.slice(0, limit);
}

const WORD = /[\p{L}\p{N}]+/gu;
const WORD_CHAR = /^[\p{L}\p{N}]$/u;

/** Whether the code point ending just before `i` is a letter or digit. */
function wordCharBefore(s: string, i: number): boolean {
  if (i <= 0) return false;
  let start = i - 1;
  if (start > 0 && /[\uDC00-\uDFFF]/.test(s[start]!) && /[\uD800-\uDBFF]/.test(s[start - 1]!)) start--;
  return WORD_CHAR.test(s.slice(start, i));
}

/** Whether the code point starting at `i` is a letter or digit. */
function wordCharAt(s: string, i: number): boolean {
  const cp = s.codePointAt(i);
  return cp !== undefined && WORD_CHAR.test(String.fromCodePoint(cp));
}

/**
 * Titles of the anchors and projects whose title, or an alias longer than two characters, occurs in `text`
 * case-insensitively with a non-letter/digit or the string end on both sides. In order of first occurrence.
 * Names are bucketed by their first word, so each word of the text is checked only against names starting with it.
 */
export function matchAnchors(ix: Index, text: string): string[] {
  type Name = { name: string; offset: number; title: string };
  const byFirstWord = new Map<string, Name[]>();
  const rows = all<{ name_lc: string; title: string }>(
    ix,
    `SELECT a.name_lc, n.title FROM aliases a JOIN notes n ON n.path = a.path
     WHERE n.type IN ('anchor', 'project') ORDER BY n.path`,
  );
  for (const { name_lc: name, title } of rows) {
    // oxlint-disable-next-line typescript/no-misused-spread -- counts code points on purpose
    if (name !== title.toLowerCase() && [...name].length <= 2) continue;
    const first = new RegExp(WORD.source, 'u').exec(name);
    if (!first) continue;
    const bucket = byFirstWord.get(first[0]) ?? [];
    bucket.push({ name, offset: first.index, title });
    byFirstWord.set(first[0], bucket);
  }

  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const m of lower.matchAll(WORD)) {
    for (const c of byFirstWord.get(m[0]) ?? []) {
      if (found.has(c.title)) continue;
      const start = m.index - c.offset;
      const end = start + c.name.length;
      if (start < 0 || !lower.startsWith(c.name, start)) continue;
      if (wordCharBefore(lower, start) || wordCharAt(lower, end)) continue;
      found.add(c.title);
    }
  }
  return [...found];
}

/**
 * Notes for a name: exact title/alias matches among anchors and projects, then of any type, then an FTS match over
 * anchors and projects, de-duplicated in that order. `brief` is for the first match.
 */
export function resolve(ix: Index, name: string): ResolveResult {
  const clean = stripLink(name);
  if (clean === '') return { matches: [], brief: null };
  const lc = clean.toLowerCase();
  const byAlias = (where: string) =>
    all<NoteRef>(
      ix,
      `SELECT DISTINCT ${REF_COLS} FROM aliases a JOIN notes n ON n.path = a.path
       WHERE a.name_lc = ? ${where} ORDER BY n.type = 'anchor' DESC, n.path`,
      lc,
    );
  const candidates = [...byAlias("AND n.type IN ('anchor', 'project')"), ...byAlias('')];
  const terms = searchTerms(clean, []);
  if (terms.length > 0) {
    candidates.push(
      ...all<NoteRef>(
        ix,
        `SELECT ${REF_COLS}, ${SCORE} AS score FROM fts JOIN notes n ON n.rowid = fts.rowid
         WHERE fts MATCH ? AND n.type IN ('anchor', 'project') ORDER BY score DESC, n.path LIMIT ?`,
        ftsQuery(terms),
        RESOLVE_FTS_MAX,
      ),
    );
  }
  const seen = new Set<string>();
  const matches = candidates.filter((c) => !seen.has(c.path) && seen.add(c.path)).map(toRef);
  return { matches, brief: matches.length > 0 ? brief(ix, matches[0]!.path) : null };
}

/** The indexed note with this id, else at this path (`\` read as `/`; case-insensitive on Windows). */
function findNote(ix: Index, idOrPath: string): NoteRow {
  const cols = `${REF_COLS}, n.fields_json`;
  const byId = all<NoteRow>(ix, `SELECT ${cols} FROM notes n WHERE n.id = ? ORDER BY n.path LIMIT 1`, idOrPath)[0];
  if (byId) return byId;
  const path = idOrPath.replace(/\\/g, '/');
  const byPath =
    all<NoteRow>(ix, `SELECT ${cols} FROM notes n WHERE n.path = ?`, path)[0] ??
    (process.platform === 'win32'
      ? all<NoteRow>(
          ix,
          `SELECT ${cols} FROM notes n WHERE kiln_lower(n.path) = ? ORDER BY n.path LIMIT 1`,
          path.toLowerCase(),
        )[0]
      : undefined);
  if (!byPath) throw new KilnError('not_found', `No note with id or path "${idOrPath}"`);
  return byPath;
}

/**
 * A capped summary of a note (by id or path): its `summary`, its `## Summary` section as current truth, and the
 * active or proposed decisions, active or blocked work, and most recently updated notes that link to it.
 */
export function brief(ix: Index, idOrPath: string): Brief {
  const row = findNote(ix, idOrPath);
  const text = readNote(ix, row.path);
  const section = text === null ? null : readSection(text, 'Summary');
  const names = JSON.stringify(namesOf(ix, row.path));
  const linking = (where: string, limit: number) =>
    all<NoteRef>(
      ix,
      `SELECT ${REF_COLS} FROM notes n WHERE ${LINKS_ANY} AND n.path <> ? ${where} ${NEWEST_FIRST} LIMIT ?`,
      names,
      row.path,
      limit,
    ).map(toRef);
  return {
    note: toRef(row),
    summary: summaryOf(row.fields_json),
    currentTruth: cap((section ?? '').trim(), CURRENT_TRUTH_MAX),
    activeDecisions: linking("AND n.type = 'decision' AND n.status IN ('active', 'proposed')", BRIEF_LIST_MAX),
    openWork: linking("AND n.type = 'work' AND n.status IN ('active', 'blocked')", BRIEF_LIST_MAX),
    recent: linking('', BRIEF_RECENT_MAX),
  };
}

/**
 * Structured filters, newest `updated` first. `anchors` matches notes linking any of the anchors by any of their names
 * (an empty list does not filter); `project` matches a `project` field whose link target (`[[X]]`, `[[X|label]]` or
 * plain `X`) is the given name or any name of the project it names (title, alias or file stem), case-insensitively.
 */
export function query(ix: Index, f: QueryFilter): NoteRef[] {
  const where: string[] = [];
  const params: SQLInputValue[] = [];
  for (const col of ['type', 'kind', 'status', 'triage'] as const) {
    const v = f[col];
    if (v !== undefined) {
      where.push(`n.${col} = ?`);
      params.push(v);
    }
  }
  if (f.anchors?.length) {
    where.push(LINKS_ANY);
    params.push(JSON.stringify(scopeOf(ix, f.anchors).linkNames));
  }
  if (f.project !== undefined) {
    where.push("kiln_link_target(json_extract(n.fields_json, '$.project')) IN (SELECT value FROM json_each(?))");
    params.push(JSON.stringify(scopeOf(ix, [f.project]).linkNames));
  }
  if (f.review !== undefined) where.push(f.review ? "n.review = 'needed'" : 'n.review IS NULL');
  if (f.updatedAfter !== undefined) {
    where.push('n.updated > ?');
    params.push(f.updatedAfter);
  }
  const sql = `SELECT ${REF_COLS} FROM notes n ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''} ${NEWEST_FIRST} LIMIT ?`;
  return all<NoteRef>(ix, sql, ...params, f.limit ?? 50).map(toRef);
}

/** The full note: parsed fields (`{}` when unparseable), body, and revision (sha256 hex of the file bytes). */
export function get(ix: Index, idOrPath: string): NoteRecord {
  const row = findNote(ix, idOrPath);
  let bytes: Buffer;
  try {
    bytes = readFileSync(join(ix.base.path, row.path));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT')
      throw new KilnError('not_found', `Note file "${row.path}" no longer exists`);
    throw e;
  }
  const split = splitNote(bytes.toString('utf8'));
  let fields: Fields;
  try {
    fields = parseFields(split.fmText);
  } catch (e) {
    if (!(e instanceof KilnError && e.code === 'validation')) throw e;
    fields = {};
  }
  return { id: row.id, path: row.path, fields, body: split.body, revision: sha256(bytes) };
}

const PENDING = "n.type = 'source' AND n.triage = 'pending'";

/** Pending sources, oldest capture first (`captured_at`, else `created`). */
export function inbox(ix: Index, limit = 50): NoteRef[] {
  const when = "COALESCE(json_extract(n.fields_json, '$.captured_at'), n.created)";
  return all<NoteRef>(
    ix,
    `SELECT ${REF_COLS} FROM notes n WHERE ${PENDING} ORDER BY ${when} IS NULL, ${when}, n.path LIMIT ?`,
    limit,
  ).map(toRef);
}

export function status(ix: Index): IndexStatus {
  const count = (where: string) => all<{ c: number }>(ix, `SELECT count(*) AS c FROM notes n WHERE ${where}`)[0]!.c;
  return { base: ix.base.name, notes: count('1'), inbox: count(PENDING), needsReview: count("n.review = 'needed'") };
}

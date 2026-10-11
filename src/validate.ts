import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { parseFields, splitNote } from './frontmatter.js';
import type { Index } from './index/db.js';
import { extractLinks } from './links.js';
import { validateFields } from './schema.js';
import { jaccard, titleTokens } from './similarity.js';
import { KilnError, type Fields } from './types.js';

export const FINDING_KINDS = ['schema', 'broken_link', 'missing_enrichment', 'possible_duplicate'] as const;

export type FindingKind = (typeof FINDING_KINDS)[number];

export type Finding = { path: string; kind: FindingKind; message: string };

/** Titles at or above this word-token Jaccard similarity (within one type) are reported as possible duplicates. */
const DUPLICATE_THRESHOLD = { num: 85, den: 100 };
/** How many other paths a group of identical titles lists before "… and N more". */
const GROUP_SHOWN = 10;

type NoteRow = { path: string; type: string | null; title: string; fields_json: string };

/** Lowercase file name without its extension. */
function stemOf(path: string): string {
  return path
    .slice(path.lastIndexOf('/') + 1)
    .replace(/\.md$/i, '')
    .toLowerCase();
}

/**
 * Lowercase base-relative paths and file names of every non-Markdown file in the base (attachments),
 * skipping directories whose name starts with `.`.
 */
function attachmentNames(root: string): Set<string> {
  const names = new Set<string>();
  const walk = (abs: string, rel: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) walk(join(abs, entry.name), childRel);
      } else if (entry.isFile() && !entry.name.toLowerCase().endsWith('.md')) {
        names.add(entry.name.toLowerCase());
        names.add(childRel.toLowerCase());
      }
    }
  };
  walk(root, '');
  return names;
}

function schemaFindings(notes: NoteRow[], index: Index, out: Finding[]): void {
  for (const n of notes) {
    if (n.type !== null) {
      const fields = JSON.parse(n.fields_json) as Fields;
      for (const issue of validateFields(fields, { claudeWritten: false })) {
        out.push({ path: n.path, kind: 'schema', message: `${issue.field}: ${issue.message} (${issue.hint})` });
      }
      continue;
    }

    // No type: either a hand-written typeless note (exempt) or frontmatter that does not parse (the index stores
    // empty fields for it). Only the second is a finding.
    let text: string;
    try {
      text = readFileSync(join(index.base.path, n.path), 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw e;
    }
    const { fmText } = splitNote(text);
    if (fmText === null) continue;
    try {
      parseFields(fmText);
    } catch (e) {
      if (!(e instanceof KilnError && e.code === 'validation')) throw e;
      out.push({
        path: n.path,
        kind: 'schema',
        message: `frontmatter: ${e.message} (fix the YAML between the --- lines)`,
      });
    }
  }
}

/** Lowercased note names (titles, aliases, file stems and base-relative paths without `.md`) to the notes' paths. */
type Names = Map<string, Set<string>>;

function noteNames(notes: NoteRow[], index: Index): Names {
  const names: Names = new Map();
  const add = (name: string, path: string): void => {
    const paths = names.get(name);
    if (paths) paths.add(path);
    else names.set(name, new Set([path]));
  };
  for (const row of index.db.prepare('SELECT name_lc, path FROM aliases').all() as { name_lc: string; path: string }[])
    add(row.name_lc, row.path);
  for (const n of notes) {
    add(stemOf(n.path), n.path);
    add(n.path.replace(/\.md$/i, '').toLowerCase(), n.path);
  }
  return names;
}

const NO_PATHS: ReadonlySet<string> = new Set();

/** The paths of the notes a link target names (by title, alias, file stem or path); empty when it names none. */
function notesNamed(names: Names, target: string): ReadonlySet<string> {
  const lc = target.toLowerCase();
  return names.get(lc) ?? (lc.endsWith('.md') ? names.get(lc.slice(0, -3)) : undefined) ?? NO_PATHS;
}

function brokenLinkFindings(names: Names, index: Index, out: Finding[]): void {
  let attachments: Set<string> | undefined;
  const resolves = (target: string): boolean => {
    const lc = target.toLowerCase();
    if (notesNamed(names, lc).size > 0) return true;
    const ext = extname(lc);
    if (ext !== '' && ext !== '.md') return (attachments ??= attachmentNames(index.base.path)).has(lc);
    return false;
  };

  const seen = new Set<string>();
  const rows = index.db.prepare('SELECT src_path, target, target_lc FROM links').all() as {
    src_path: string;
    target: string;
    target_lc: string;
  }[];
  for (const l of rows) {
    const key = `${l.src_path}\0${l.target_lc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!resolves(l.target)) {
      out.push({
        path: l.src_path,
        kind: 'broken_link',
        message: `[[${l.target}]] does not match any note title, alias or file name`,
      });
    }
  }
}

/** The string entries of a list field, as written. */
function entries(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** The link target of one `[[...]]` entry, label and heading dropped. */
function targetOf(entry: string): string | undefined {
  return extractLinks({ entry }, '')[0];
}

const BACK_LINK = { superseded_by: 'supersedes', supersedes: 'superseded_by' } as const;

/**
 * Supersession recorded on one side only: a decision whose `superseded_by` (or `supersedes`) names a note whose
 * `supersedes` (or `superseded_by`) does not name it back. This also catches a supersede cut off between its two
 * writes. Targets are resolved as `broken_link` resolves them; a target that names no note is left to `broken_link`.
 */
function supersessionFindings(notes: NoteRow[], names: Names, out: Finding[]): void {
  const fieldsByPath = new Map(notes.map((n) => [n.path, JSON.parse(n.fields_json) as Fields]));
  const linksBack = (path: string, field: 'supersedes' | 'superseded_by', to: string): boolean =>
    entries(fieldsByPath.get(path)?.[field]).some((e) => {
      const t = targetOf(e);
      return t !== undefined && notesNamed(names, t).has(to);
    });
  for (const n of notes) {
    if (n.type !== 'decision') continue;
    const fields = fieldsByPath.get(n.path)!;
    for (const field of ['superseded_by', 'supersedes'] as const) {
      const back = BACK_LINK[field];
      for (const entry of entries(fields[field])) {
        const t = targetOf(entry);
        const linked = t === undefined ? NO_PATHS : notesNamed(names, t);
        if (linked.size === 0 || [...linked].some((p) => linksBack(p, back, n.path))) continue;
        out.push({
          path: n.path,
          kind: 'schema',
          message: `${field}: ${entry} does not list this decision in its ${back} (add the back-link there, or correct this link)`,
        });
      }
    }
  }
}

function enrichmentFindings(notes: NoteRow[], out: Finding[]): void {
  for (const n of notes) {
    if (n.type === null || n.type === 'source') continue;
    const fields = JSON.parse(n.fields_json) as Fields;
    const missing: string[] = [];
    if (typeof fields.summary !== 'string' || fields.summary.trim() === '') missing.push('summary');
    if (!Array.isArray(fields.aliases) || fields.aliases.length === 0) missing.push('aliases');
    if (missing.length > 0)
      out.push({ path: n.path, kind: 'missing_enrichment', message: `missing ${missing.join(' and ')}` });
  }
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

type Titled = { path: string; title: string; norm: string; tokens: string[] };

/**
 * Pairs of same-type notes whose titles are not identical (trimmed, lowercased) but score at or above the threshold,
 * as [a, b] with a.path < b.path. Identical titles are reported as groups instead (`identicalGroups`).
 */
function similarPairs(group: Titled[]): [Titled, Titled, number][] {
  const { num, den } = DUPLICATE_THRESHOLD;
  const pairs = new Map<string, [Titled, Titled, number]>();
  const record = (x: Titled, y: Titled, score: number): void => {
    if (x.norm === y.norm) return;
    const [a, b] = x.path < y.path ? [x, y] : [y, x];
    pairs.set(`${a.path}\0${b.path}`, [a, b, score]);
  };

  // Prefix filtering: order each token set rarest-first; two sets with Jaccard >= t must share a token within the
  // first |s| - ceil(t|s|) + 1 tokens of each. Probing only those prefixes keeps common tokens from forcing all-pairs.
  const freq = new Map<string, number>();
  for (const t of group) for (const tok of t.tokens) freq.set(tok, (freq.get(tok) ?? 0) + 1);
  const rank = (a: string, b: string): number => freq.get(a)! - freq.get(b)! || (a < b ? -1 : a > b ? 1 : 0);
  const tokened = group
    .filter((t) => t.tokens.length > 0)
    .map((t) => ({ t, ordered: [...t.tokens].sort(rank), set: new Set(t.tokens) }))
    .sort((a, b) => a.ordered.length - b.ordered.length);

  const postings = new Map<string, typeof tokened>();
  for (const x of tokened) {
    const size = x.ordered.length;
    const minSize = Math.ceil((num * size) / den);
    const prefix = x.ordered.slice(0, size - minSize + 1);
    const candidates = new Set<(typeof tokened)[number]>();
    for (const tok of prefix) {
      for (const y of postings.get(tok) ?? []) if (y.ordered.length >= minSize) candidates.add(y);
    }
    for (const y of candidates) {
      const score = jaccard(x.set, y.set);
      if (score >= num / den) record(x.t, y.t, score);
    }
    for (const tok of prefix) {
      const list = postings.get(tok);
      if (list) list.push(x);
      else postings.set(tok, [x]);
    }
  }
  return [...pairs.values()];
}

/** Groups of notes whose titles are identical once trimmed and lowercased (stopword-only titles included), by path. */
function identicalGroups(group: Titled[]): Titled[][] {
  const byNorm = new Map<string, Titled[]>();
  for (const t of group) {
    const same = byNorm.get(t.norm);
    if (same) same.push(t);
    else byNorm.set(t.norm, [t]);
  }
  return [...byNorm.values()].filter((same) => same.length > 1).map((same) => same.sort((a, b) => cmp(a.path, b.path)));
}

/**
 * Likely duplicates among same-type notes, sources aside (`dedupe_key` already deduplicates them). A group of identical
 * titles is one finding on its smallest path, listing at most GROUP_SHOWN of the others; each near-identical pair is one
 * finding on the smaller path. This keeps the output linear in the number of notes for large identical groups.
 */
function duplicateFindings(notes: NoteRow[], out: Finding[]): void {
  const byType = new Map<string, Titled[]>();
  for (const n of notes) {
    if (n.type === null || n.type === 'source') continue;
    const entry: Titled = {
      path: n.path,
      title: n.title,
      norm: n.title.trim().toLowerCase(),
      tokens: [...titleTokens(n.title)],
    };
    const list = byType.get(n.type);
    if (list) list.push(entry);
    else byType.set(n.type, [entry]);
  }
  for (const group of byType.values()) {
    for (const [first, ...others] of identicalGroups(group)) {
      const shown = others
        .slice(0, GROUP_SHOWN)
        .map((o) => o.path)
        .join(', ');
      const more = others.length > GROUP_SHOWN ? ` … and ${others.length - GROUP_SHOWN} more` : '';
      out.push({
        path: first!.path,
        kind: 'possible_duplicate',
        message: `same title as ${others.length} other note${others.length === 1 ? '' : 's'}: ${shown}${more}`,
      });
    }
    for (const [a, b, score] of similarPairs(group)) {
      out.push({
        path: a.path,
        kind: 'possible_duplicate',
        message: `possible duplicate of ${b.path} ("${b.title}"), title similarity ${score.toFixed(2)}`,
      });
    }
  }
}

/**
 * Read-only check of a base: schema problems (including frontmatter that is not valid YAML, and supersession recorded
 * on one side only), broken links,
 * knowledge notes missing a summary or aliases, and likely duplicate titles. Uses the index as it stands (callers
 * decide whether to `ensureFresh` first), reads note files only to diagnose typeless notes, and writes nothing.
 * Findings are sorted by path, then kind, then message.
 */
export function validateBase(index: Index): Finding[] {
  const notes = index.db.prepare('SELECT path, type, title, fields_json FROM notes').all() as NoteRow[];
  const out: Finding[] = [];
  const names = noteNames(notes, index);
  schemaFindings(notes, index, out);
  supersessionFindings(notes, names, out);
  brokenLinkFindings(names, index, out);
  enrichmentFindings(notes, out);
  duplicateFindings(notes, out);
  return out.sort((a, b) => cmp(a.path, b.path) || cmp(a.kind, b.kind) || cmp(a.message, b.message));
}

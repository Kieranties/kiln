import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { parseFields, splitNote } from './frontmatter.js';
import type { Index } from './index/db.js';
import { validateFields } from './schema.js';
import { jaccard, titleTokens } from './similarity.js';
import { KilnError, type Fields } from './types.js';

export type FindingKind = 'schema' | 'broken_link' | 'missing_enrichment' | 'possible_duplicate';

export type Finding = { path: string; kind: FindingKind; message: string };

/** Titles at or above this word-token Jaccard similarity (within one type) are reported as possible duplicates. */
const DUPLICATE_THRESHOLD = { num: 85, den: 100 };

type NoteRow = { path: string; type: string | null; title: string; fields_json: string };

/** Lowercase file name without its extension. */
function stemOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '').toLowerCase();
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
      out.push({ path: n.path, kind: 'schema', message: `frontmatter: ${e.message} (fix the YAML between the --- lines)` });
    }
  }
}

function brokenLinkFindings(notes: NoteRow[], index: Index, out: Finding[]): void {
  const names = new Set<string>();
  for (const row of index.db.prepare('SELECT DISTINCT name_lc FROM aliases').all() as { name_lc: string }[]) names.add(row.name_lc);
  for (const n of notes) {
    names.add(stemOf(n.path));
    names.add(n.path.replace(/\.md$/i, '').toLowerCase());
  }

  let attachments: Set<string> | undefined;
  const resolves = (target: string): boolean => {
    const lc = target.toLowerCase();
    if (names.has(lc)) return true;
    if (lc.endsWith('.md') && names.has(lc.slice(0, -3))) return true;
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
      out.push({ path: l.src_path, kind: 'broken_link', message: `[[${l.target}]] does not match any note title, alias or file name` });
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
    if (missing.length > 0) out.push({ path: n.path, kind: 'missing_enrichment', message: `missing ${missing.join(' and ')}` });
  }
}

type Titled = { path: string; title: string; norm: string; tokens: string[] };

/** Pairs of same-type notes whose titles score at or above the threshold, as [a, b] with a.path < b.path. */
function similarPairs(group: Titled[]): [Titled, Titled, number][] {
  const { num, den } = DUPLICATE_THRESHOLD;
  const pairs = new Map<string, [Titled, Titled, number]>();
  const record = (x: Titled, y: Titled, score: number): void => {
    const [a, b] = x.path < y.path ? [x, y] : [y, x];
    pairs.set(`${a.path}\0${b.path}`, [a, b, score]);
  };

  // Equal titles always match, including titles made only of stopwords (which have no tokens to index).
  const byNorm = new Map<string, Titled[]>();
  for (const t of group) {
    const same = byNorm.get(t.norm);
    if (same) same.push(t);
    else byNorm.set(t.norm, [t]);
  }
  for (const same of byNorm.values()) {
    for (let i = 0; i < same.length; i++) for (let j = i + 1; j < same.length; j++) record(same[i]!, same[j]!, 1);
  }

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

function duplicateFindings(notes: NoteRow[], out: Finding[]): void {
  const byType = new Map<string, Titled[]>();
  for (const n of notes) {
    if (n.type === null) continue;
    const entry: Titled = { path: n.path, title: n.title, norm: n.title.trim().toLowerCase(), tokens: [...titleTokens(n.title)] };
    const list = byType.get(n.type);
    if (list) list.push(entry);
    else byType.set(n.type, [entry]);
  }
  for (const group of byType.values()) {
    for (const [a, b, score] of similarPairs(group)) {
      out.push({
        path: a.path,
        kind: 'possible_duplicate',
        message: `possible duplicate of ${b.path} ("${b.title}"), title similarity ${score.toFixed(2)}`,
      });
    }
  }
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Read-only check of a base: schema problems (including frontmatter that is not valid YAML), broken links,
 * knowledge notes missing a summary or aliases, and likely duplicate titles. Uses the index as it stands (callers
 * decide whether to `ensureFresh` first), reads note files only to diagnose typeless notes, and writes nothing.
 * Findings are sorted by path, then kind, then message.
 */
export function validateBase(index: Index): Finding[] {
  const notes = index.db.prepare('SELECT path, type, title, fields_json FROM notes').all() as NoteRow[];
  const out: Finding[] = [];
  schemaFindings(notes, index, out);
  brokenLinkFindings(notes, index, out);
  enrichmentFindings(notes, out);
  duplicateFindings(notes, out);
  return out.sort((a, b) => cmp(a.path, b.path) || cmp(a.kind, b.kind) || cmp(a.message, b.message));
}

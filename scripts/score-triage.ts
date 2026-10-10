/**
 * Score a triaged base against the day's answer key.
 *
 *   npx tsx scripts/score-triage.ts <basePath> <answer-key.json>
 *
 * Prints the outcome accuracy, one line per mismatch, and (for information only) every `linked_to` that does not
 * resolve to one of its capture's existing-path targets. Exits 1 when accuracy is below 0.90.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseFields, splitNote } from '../src/frontmatter.js';
import { scanVault, titleOf } from '../src/index/reconcile.js';
import type { Fields } from '../src/types.js';

export type AnswerKey = { captures: { file: string; expected_outcome: string; targets: string[] }[] };

export type CaptureScore = {
  file: string;
  /** Base-relative path of the source note, or null when it is not in the base. */
  path: string | null;
  expected: string;
  /** The recorded `triage_outcome`; `pending` while untriaged, `missing` when the note is absent, `(none)` when unset. */
  actual: string;
  correct: boolean;
  linkedTo: string[];
  targets: string[];
};

export type UnmatchedLink = { file: string; link: string; resolved: string | null };

export type TriageScore = {
  total: number;
  correct: number;
  accuracy: number;
  captures: CaptureScore[];
  mismatches: CaptureScore[];
  unmatchedLinks: UnmatchedLink[];
};

export const PASS_ACCURACY = 0.9;

const norm = (p: string): string => p.replaceAll('\\', '/').toLowerCase();
const fileNameOf = (rel: string): string => rel.slice(rel.lastIndexOf('/') + 1);
const stemOf = (rel: string): string => fileNameOf(rel).replace(/\.md$/, '');

function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

function fieldsOf(abs: string): Fields {
  try {
    return parseFields(splitNote(readFileSync(abs, 'utf8')).fmText);
  } catch {
    return {};
  }
}

/** `[[Name]]`, `[[Name|label]]`, `[[Name#heading]]` or `Name` → `Name`. */
function linkName(link: string): string {
  const m = /^\s*\[\[([^\]]*)\]\]\s*$/.exec(link);
  return (m ? m[1]!.split('|')[0]!.split('#')[0]! : link).trim();
}

/** Score each answer-key capture by the `triage_outcome` recorded on its source note (found by file name under `sources/`). */
export function scoreTriage(basePath: string, key: AnswerKey): TriageScore {
  const files = scanVault(basePath);
  const fields = new Map(files.map((f) => [f.rel, fieldsOf(f.abs)]));

  const byTitle = new Map<string, string>();
  const byStem = new Map<string, string>();
  for (const f of files) {
    const title = titleOf(fields.get(f.rel)!, f.rel).toLowerCase();
    if (!byTitle.has(title)) byTitle.set(title, f.rel);
    const stem = stemOf(f.rel).toLowerCase();
    if (!byStem.has(stem)) byStem.set(stem, f.rel);
  }
  const resolveLink = (link: string): string | null => {
    const name = linkName(link).toLowerCase();
    return byTitle.get(name) ?? byStem.get(name) ?? null;
  };

  const sourcesByName = new Map<string, string>();
  for (const f of files) {
    if (!f.rel.startsWith('sources/')) continue;
    const name = fileNameOf(f.rel).toLowerCase();
    if (!sourcesByName.has(name)) sourcesByName.set(name, f.rel);
  }

  const captures: CaptureScore[] = [];
  const unmatchedLinks: UnmatchedLink[] = [];
  for (const c of key.captures) {
    const path = sourcesByName.get(c.file.toLowerCase()) ?? null;
    const f = path === null ? {} : fields.get(path)!;
    const linkedTo = strings(f.linked_to);
    const outcome = typeof f.triage_outcome === 'string' && f.triage_outcome !== '' ? f.triage_outcome : '(none)';
    const actual = path === null ? 'missing' : f.triage === 'pending' ? 'pending' : outcome;
    captures.push({ file: c.file, path, expected: c.expected_outcome, actual, correct: actual === c.expected_outcome, linkedTo, targets: c.targets });

    const targetPaths = new Set(c.targets.filter((t) => t.endsWith('.md')).map(norm));
    for (const link of linkedTo) {
      const resolved = resolveLink(link);
      if (resolved === null || !targetPaths.has(norm(resolved))) unmatchedLinks.push({ file: c.file, link, resolved });
    }
  }

  const correct = captures.filter((c) => c.correct).length;
  return {
    total: captures.length,
    correct,
    accuracy: captures.length === 0 ? 0 : correct / captures.length,
    captures,
    mismatches: captures.filter((c) => !c.correct),
    unmatchedLinks,
  };
}

export function formatScore(s: TriageScore): string {
  const lines = [`accuracy: ${s.accuracy.toFixed(2)} (${s.correct}/${s.total})`];
  if (s.mismatches.length > 0) {
    lines.push('', 'mismatches:');
    for (const m of s.mismatches) {
      lines.push(
        `- ${m.file}: expected ${m.expected}, got ${m.actual}; linked_to ${JSON.stringify(m.linkedTo)} vs targets ${JSON.stringify(m.targets)}`,
      );
    }
  }
  if (s.unmatchedLinks.length > 0) {
    lines.push('', 'linked_to not matching an existing-path target (information only):');
    for (const u of s.unmatchedLinks) lines.push(`- ${u.file}: ${u.link} -> ${u.resolved ?? '(unresolved)'}`);
  }
  return lines.join('\n');
}

function main(argv: string[]): number {
  if (argv.length !== 2) {
    process.stderr.write('Usage: npx tsx scripts/score-triage.ts <basePath> <answer-key.json>\n');
    return 2;
  }
  const key = JSON.parse(readFileSync(argv[1]!, 'utf8')) as AnswerKey;
  const score = scoreTriage(resolve(argv[0]!), key);
  process.stdout.write(`${formatScore(score)}\n`);
  const pass = score.accuracy >= PASS_ACCURACY;
  process.stdout.write(`\n${pass ? 'PASS' : 'FAIL'}: accuracy ${score.accuracy.toFixed(2)} (target >= ${PASS_ACCURACY.toFixed(2)})\n`);
  return pass ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}

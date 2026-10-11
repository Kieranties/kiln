import type { NoteResult } from './check-note.js';

/** The note's path, then one `  error  <message>` or `  warn   <message>` line per finding. */
export function formatResult(result: NoteResult): string {
  return [result.path, ...result.findings.map((f) => `  ${f.level.padEnd(5)}  ${f.message}`)].join('\n');
}

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** One line for the run: how many notes were checked (skipped ones don't count) and how many findings. */
export function summarise(results: NoteResult[]): string {
  const checked = results.filter((r) => !r.skipped);
  const findings = checked.flatMap((r) => r.findings);
  const errors = findings.filter((f) => f.level === 'error').length;
  const warnings = findings.length - errors;
  const prefix = `Checked ${count(checked.length, 'note')}:`;
  return findings.length === 0
    ? `${prefix} no problems.`
    : `${prefix} ${count(errors, 'error')}, ${count(warnings, 'warning')}.`;
}

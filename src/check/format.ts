import type { NoteResult } from './check-note.js';

/** The note's path, then one `  error  <message>` or `  warn   <message>` line per finding. */
export function formatResult(result: NoteResult): string {
  return [result.path, ...result.findings.map((f) => `  ${f.level.padEnd(5)}  ${f.message}`)].join('\n');
}

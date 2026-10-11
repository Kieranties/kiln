import { statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { checkNote, NoteReadError, type NoteResult } from './check-note.js';
import { formatResult, summarise } from './format.js';
import { findVault, openVault, type Vault } from './vault.js';

export type RunOptions = { now?: Date; cwd?: string };

const USAGE = `Usage: node kiln-check.mjs [--today] [--new] <note-or-folder>...
  <note-or-folder>  a note, a folder of notes, or the vault folder for the whole vault
  --today           only notes changed since midnight
  --new             the notes were just created: <% and an empty body are errors
Exit code: 0 no errors, 1 errors, 2 bad arguments.`;

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const failure = (path: string, text: string): NoteResult => ({ path, findings: [{ level: 'error', message: text }] });

/** Checks the notes, folders and vaults named in `argv`. Never writes; problems with a path become findings, not exceptions. */
export function runCheck(argv: string[], options: RunOptions = {}): { output: string; exitCode: 0 | 1 | 2 } {
  const usage = { output: USAGE, exitCode: 2 as const };
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        new: { type: 'boolean' },
        today: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch {
    return usage;
  }
  const { values, positionals } = parsed;
  if (values.help || positionals.length === 0) return usage;

  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const vaults = new Map<string, Vault | Error>();
  const open = (root: string): Vault | Error => {
    let vault = vaults.get(root);
    if (!vault) {
      try {
        vault = openVault(root);
      } catch (e) {
        vault = new Error(`can't read the vault's definitions: ${message(e)}`);
      }
      vaults.set(root, vault);
    }
    return vault;
  };

  const results: NoteResult[] = [];
  const seen = new Set<string>();
  for (const typed of positionals) {
    const absolute = resolve(cwd, typed);
    const stats = statSync(absolute, { throwIfNoEntry: false });
    if (!stats) {
      results.push(failure(typed, 'no such note or folder'));
      continue;
    }
    const root = findVault(absolute);
    if (!root) {
      results.push(failure(typed, 'not in a kiln vault: no _kiln/types/ folder here or above'));
      continue;
    }
    if (stats.isFile() && !absolute.endsWith('.md')) {
      results.push(failure(typed, 'not a note: kiln checks .md files'));
      continue;
    }
    const vault = open(root);
    if (vault instanceof Error) {
      results.push(failure(typed, vault.message));
      continue;
    }

    const rel = relative(root, absolute).split(sep).join('/');
    const targets = stats.isFile() ? [rel] : vault.notes.filter((note) => rel === '' || note.startsWith(`${rel}/`));
    for (const note of targets) {
      const key = `${root}\0${note}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const display = stats.isFile() ? typed : note;
      if (values.today) {
        let modified: number;
        try {
          modified = statSync(resolve(root, note)).mtimeMs;
        } catch (e) {
          results.push(failure(display, `can't read the note: ${message(e)}`));
          continue;
        }
        if (modified < midnight) continue;
      }
      try {
        results.push(checkNote(vault, note, { isNew: values.new === true, skipUntyped: stats.isDirectory() }));
      } catch (e) {
        if (!(e instanceof NoteReadError)) throw e;
        results.push(failure(display, `can't read the note: ${e.message}`));
      }
    }
  }

  const withFindings = results.filter((r) => r.findings.length > 0);
  const output = [...withFindings.map(formatResult), summarise(results)].join('\n\n');
  const hasErrors = withFindings.some((r) => r.findings.some((f) => f.level === 'error'));
  return { output, exitCode: hasErrors ? 1 : 0 };
}

import { parseArgs } from 'node:util';
import { resolveVault } from './resolve.js';
import type { Where } from './paths.js';

const USAGE = `Usage: node kiln-vault.mjs [<path>]
  <path>  a vault folder, or a folder or note inside one
Finds the kiln vault: <path>; else the vault holding the current folder; else KILN_VAULT
(a vault name or a path); else the default in ~/.kiln/config.json; else the only kiln
vault in Obsidian's vault list.
Prints JSON. Exit code: 0 found, 1 no vault (with candidates and reasons), 2 bad arguments.`;

/** Finds the vault and prints the answer as JSON. Reads files only; `where` carries the environment. */
export function runVault(argv: string[], where: Where): { output: string; exitCode: 0 | 1 | 2 } {
  const usage = { output: USAGE, exitCode: 2 as const };
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { help: { type: 'boolean', short: 'h' } },
    });
  } catch {
    return usage;
  }
  const { values, positionals } = parsed;
  if (values.help || positionals.length > 1) return usage;
  const explicit = positionals[0];
  if (explicit !== undefined && explicit.trim() === '') return usage;

  const resolution = resolveVault(where, explicit);
  return { output: JSON.stringify(resolution, null, 2), exitCode: resolution.vault === null ? 1 : 0 };
}

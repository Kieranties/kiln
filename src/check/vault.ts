import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { readBlueprint, type Blueprint } from '../blueprint/load.js';

export type Vault = {
  root: string;
  blueprint: Blueprint;
  /** Vault-relative paths (with `/`), sorted, of every note outside dot-folders and `_kiln/`. */
  notes: string[];
  /** Lower-case link name to vault-relative paths, for every file outside dot-folders. */
  names: Map<string, string[]>;
};

/** Starts at `path` (or its folder) and walks up to the first folder holding `_kiln/types/`. */
export function findVault(path: string): string | undefined {
  const start = resolve(path);
  let current = statSync(start, { throwIfNoEntry: false })?.isDirectory() ? start : dirname(start);
  for (;;) {
    if (existsSync(join(current, '_kiln', 'types'))) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

/** Reads the blueprint and lists the vault's files. Throws whatever `readBlueprint` throws. */
export function openVault(path: string, blueprintDir?: string): Vault {
  const root = resolve(path);
  const blueprint = readBlueprint(blueprintDir ?? join(root, '_kiln'));
  const files = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter((path) => !path.split('/').some((segment) => segment.startsWith('.')));

  const notes = files.filter((path) => path.endsWith('.md') && !path.startsWith('_kiln/')).sort();
  const names = new Map<string, string[]>();
  for (const path of files) {
    const file = basename(path);
    const key = (file.endsWith('.md') ? file.slice(0, -3) : file).toLowerCase();
    names.set(key, [...(names.get(key) ?? []), path]);
  }
  return { root, blueprint, notes, names };
}

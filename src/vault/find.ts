import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findUp, isFolder } from './paths.js';

/** `plain` marks a failure that is a plain Obsidian vault: one without kiln, which setup can fix. */
export type VaultCheck = { ok: true; root: string } | { ok: false; reason: string; plain?: true };

/** Starts at `path` (or its folder) and walks up to the first folder holding `_kiln/types/`. */
export function findVault(path: string): string | undefined {
  return findUp(path, '_kiln', 'types');
}

const hasFolder = (root: string, ...marker: string[]): boolean => isFolder(join(root, ...marker));

/** Says whether `path` (absolute) is a kiln vault, or with `walkUp` is inside one. */
export function checkVault(path: string, options: { walkUp: boolean }): VaultCheck {
  const { walkUp } = options;
  let isFile: boolean;
  try {
    const stat = statSync(path, { throwIfNoEntry: false });
    if (stat === undefined) return { ok: false, reason: `${path} doesn't exist` };
    isFile = stat.isFile();
  } catch (error) {
    return { ok: false, reason: `${path} can't be read: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!walkUp && isFile) return { ok: false, reason: `${path} is a file, not a vault folder` };
  const root = walkUp ? findVault(path) : hasFolder(path, '_kiln', 'types') ? resolve(path) : undefined;
  if (root !== undefined) return { ok: true, root: resolve(root) };
  const obs = walkUp ? findUp(path, '.obsidian') : hasFolder(path, '.obsidian') ? path : undefined;
  if (obs !== undefined) {
    return {
      ok: false,
      plain: true,
      reason: `${obs} is an Obsidian vault without kiln: it has no _kiln/types/ folder. Set it up with /kiln:setup first.`,
    };
  }
  return {
    ok: false,
    reason: walkUp
      ? `${path} isn't in a kiln vault: no _kiln/types/ folder here or above`
      : `${path} isn't a kiln vault: it has no _kiln/types/ folder`,
  };
}

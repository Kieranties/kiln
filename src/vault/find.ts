import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findUp } from './paths.js';

export type VaultCheck = { ok: true; root: string } | { ok: false; reason: string };

/** Starts at `path` (or its folder) and walks up to the first folder holding `_kiln/types/`. */
export function findVault(path: string): string | undefined {
  return findUp(path, '_kiln', 'types');
}

const hasFolder = (root: string, ...marker: string[]): boolean =>
  statSync(join(root, ...marker), { throwIfNoEntry: false })?.isDirectory() === true;

/** Says whether `path` (absolute) is a kiln vault, or with `walkUp` is inside one. */
export function checkVault(path: string, options: { walkUp: boolean }): VaultCheck {
  const { walkUp } = options;
  if (!existsSync(path)) return { ok: false, reason: `${path} doesn't exist` };
  if (!walkUp && statSync(path).isFile()) {
    return { ok: false, reason: `${path} is a file, not a vault folder` };
  }
  const root = walkUp ? findVault(path) : hasFolder(path, '_kiln', 'types') ? resolve(path) : undefined;
  if (root !== undefined) return { ok: true, root: resolve(root) };
  const obs = walkUp ? findUp(path, '.obsidian') : hasFolder(path, '.obsidian') ? path : undefined;
  if (obs !== undefined) {
    return {
      ok: false,
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

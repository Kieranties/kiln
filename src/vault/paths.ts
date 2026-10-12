import { statSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';

/** The environment variables as a plain map; the running process's own fit this. */
export type Env = Readonly<Record<string, string | undefined>>;

/** Everything the resolver would otherwise read from the running program. */
export type Where = { cwd: string; env: Env; home: string; platform: NodeJS.Platform };

/** The value, trimmed; `undefined` when unset or blank. */
export function envValue(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

/** A leading `~` (alone, or before `/` or `\`) becomes the home folder. */
export function expandHome(path: string, home: string): string {
  if (path === '~') return home;
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(home, path.slice(2));
  return path;
}

/** Two paths name the same folder when their keys are equal. */
export function pathKey(path: string, platform: NodeJS.Platform): string {
  let key = resolve(path);
  if (key !== parse(key).root) key = key.replace(/[\\/]+$/, '');
  return platform === 'win32' || platform === 'darwin' ? key.toLowerCase() : key;
}

/** True for a folder; any failure to look (permissions, a file in the way) counts as no. */
export function isFolder(path: string): boolean {
  try {
    return statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
  } catch {
    return false;
  }
}

/** From `start` (or its folder) walks up to the first folder in which `join(folder, ...marker)` is a folder. */
export function findUp(start: string, ...marker: string[]): string | undefined {
  const from = resolve(start);
  let current = isFolder(from) ? from : dirname(from);
  for (;;) {
    if (isFolder(join(current, ...marker))) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

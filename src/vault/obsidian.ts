import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { envValue, type Where } from './paths.js';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Where Obsidian keeps its list of vaults. The format isn't documented, so kiln only reads it. */
export function obsidianListPath(where: Pick<Where, 'env' | 'home' | 'platform'>): string {
  const { env, home, platform } = where;
  if (platform === 'win32') {
    const appData = envValue(env, 'APPDATA') ?? join(home, 'AppData', 'Roaming');
    return join(appData, 'obsidian', 'obsidian.json');
  }
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json');
  const config = envValue(env, 'XDG_CONFIG_HOME') ?? join(home, '.config');
  return join(config, 'obsidian', 'obsidian.json');
}

/** The `path` of every vault in Obsidian's list, in file order; `undefined` when there is no list. */
export function readObsidianVaults(file: string): string[] | undefined {
  if (!existsSync(file)) return undefined;
  const source = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch (error) {
    throw new Error(`not valid JSON: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  if (!isObject(data) || !isObject(data.vaults)) throw new Error('no vaults list');
  const paths: string[] = [];
  for (const entry of Object.values(data.vaults)) {
    if (isObject(entry) && typeof entry.path === 'string') paths.push(entry.path);
  }
  return paths;
}

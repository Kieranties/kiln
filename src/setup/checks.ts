import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Env } from '../vault/paths.js';
import type { Requires } from './blueprint.js';
import { isObject, readJson, type Json } from './json.js';

/**
 * Compares two versions part by part, as numbers. A missing part counts as 0, and anything from the first
 * `-` is ignored, so `2.25.2-beta.0` is `2.25.2`. Negative when `a` is lower, 0 when equal, positive when higher.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => (v.split('-', 1)[0] ?? '').split('.').map((p) => Number.parseInt(p, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export type PluginCheck = { id: string; version: string | null; minimum: string; status: 'ok' | 'old' | 'missing' };

/** The installed version: `null` unless `manifest.json` and `main.js` both exist and the manifest has a text version. */
function installedVersion(folder: string): string | null {
  if (!existsSync(join(folder, 'main.js'))) return null;
  let manifest: Json | undefined;
  try {
    manifest = readJson(join(folder, 'manifest.json'));
  } catch {
    return null; // a broken manifest: Obsidian can't load the plugin either
  }
  if (!isObject(manifest)) return null;
  const { version } = manifest;
  return typeof version === 'string' && version.trim() !== '' ? version : null;
}

/** Each plugin `requires` names, in its order: missing, older than the minimum, or ok. */
export function checkPlugins(vault: string, requires: Requires): PluginCheck[] {
  return Object.entries(requires.plugins).map(([id, minimum]) => {
    const version = installedVersion(join(vault, '.obsidian', 'plugins', id));
    if (version === null) return { id, version, minimum, status: 'missing' };
    return { id, version, minimum, status: compareVersions(version, minimum) < 0 ? 'old' : 'ok' };
  });
}

/**
 * The Obsidian CLI's full path: the first folder on `PATH` holding `Obsidian.com` (Windows) or `obsidian`.
 * A lookup, never a run: running the CLI would start Obsidian, which setup needs closed.
 */
export function findObsidianCli(env: Env, platform: NodeJS.Platform): string | null {
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH');
  const path = key === undefined ? undefined : env[key];
  if (path === undefined) return null;
  const name = platform === 'win32' ? 'Obsidian.com' : 'obsidian';
  for (const folder of path.split(platform === 'win32' ? ';' : ':')) {
    if (folder.trim() === '') continue;
    const file = join(folder, name);
    if (existsSync(file)) return file;
  }
  return null;
}

/** Runs a command without a shell, as `spawnSync` does. */
export type Exec = (command: string, args: string[]) => { status: number | null; stdout: string; error?: Error };

/**
 * Whether Obsidian is running, by a process check: `tasklist` on Windows, `pgrep` elsewhere. `null` when the
 * check can't run. It can't tell which vault is open.
 */
export function isObsidianRunning(platform: NodeJS.Platform, exec: Exec): boolean | null {
  if (platform === 'win32') {
    const result = exec('tasklist', ['/FI', 'IMAGENAME eq Obsidian.exe', '/NH', '/FO', 'CSV']);
    if (result.error !== undefined) return null;
    const found = result.stdout.split('\n').some((line) => line.trim().toLowerCase().startsWith('"obsidian.exe"'));
    if (found) return true;
    return result.status === 0 ? false : null;
  }
  const result = exec('pgrep', ['-x', '-i', 'obsidian']);
  if (result.error !== undefined) return null;
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  return null;
}

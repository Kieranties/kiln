import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readDefinitions } from '../blueprint/load.js';
import { kindTemplates } from './quickadd.js';

export type Requires = { obsidian: string; plugins: Record<string, string> };

export function readRequires(dir: string): Requires {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(dir, 'requires.json'), 'utf8'));
  } catch (error) {
    throw new Error(`requires.json: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('requires.json: expected an object');
  }
  const { obsidian, plugins } = value as Record<string, unknown>;
  if (typeof obsidian !== 'string') throw new Error('requires.json: "obsidian" must be text');
  if (typeof plugins !== 'object' || plugins === null || Array.isArray(plugins)) {
    throw new Error('requires.json: "plugins" must be a map of plugin id to version');
  }
  const versions: Record<string, string> = {};
  for (const [id, version] of Object.entries(plugins)) {
    if (typeof version !== 'string') throw new Error(`requires.json: plugin "${id}" must be text`);
    versions[id] = version;
  }
  return { obsidian, plugins: versions };
}

/** Every file under `dir` as `/` paths relative to it, sorted. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name).slice(dir.length).split(/[\\/]/).filter(Boolean).join('/'))
    .sort();
}

/** Vault path to text, for every blueprint file setup copies, sorted by path. */
export function installedFiles(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  const add = (from: string, to: string) => files.set(to, readFileSync(join(dir, from), 'utf8'));
  for (const folder of ['types', 'templates', 'views']) {
    for (const path of filesUnder(join(dir, folder))) add(`${folder}/${path}`, `_kiln/${folder}/${path}`);
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) add(entry.name, `_kiln/${entry.name}`);
  }
  for (const path of filesUnder(join(dir, 'root'))) add(`root/${path}`, path);
  for (const path of filesUnder(join(dir, 'settings', 'snippets'))) {
    add(`settings/snippets/${path}`, `.obsidian/snippets/${path}`);
  }
  for (const { path, text } of kindTemplates(readDefinitions(dir), (file) =>
    readFileSync(join(dir, 'templates', file), 'utf8'),
  )) {
    files.set(path, text);
  }
  return new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** A settings fragment, the vault file it is merged into, and whether Obsidian applies a change while open. */
export type SettingTarget = { fragment: string; target: string; live: boolean };

export const SETTINGS: SettingTarget[] = [
  { fragment: 'settings/app.json', target: '.obsidian/app.json', live: false },
  { fragment: 'settings/types.json', target: '.obsidian/types.json', live: false },
  { fragment: 'settings/daily-notes.json', target: '.obsidian/daily-notes.json', live: false },
  { fragment: 'settings/core-plugins.json', target: '.obsidian/core-plugins.json', live: false },
  { fragment: 'settings/community-plugins.json', target: '.obsidian/community-plugins.json', live: false },
  { fragment: 'settings/appearance.json', target: '.obsidian/appearance.json', live: false },
  { fragment: 'settings/plugins/iconic.json', target: '.obsidian/plugins/iconic/data.json', live: true },
  {
    fragment: 'settings/plugins/templater.json',
    target: '.obsidian/plugins/templater-obsidian/data.json',
    live: true,
  },
  // QuickAdd reloads live since 2.30; set to true after trial T3.
  { fragment: 'settings/plugins/quickadd.json', target: '.obsidian/plugins/quickadd/data.json', live: false },
  { fragment: 'settings/plugins/homepage.json', target: '.obsidian/plugins/homepage/data.json', live: false },
  { fragment: 'settings/workspace-file-properties.json', target: '.obsidian/workspace.json', live: false },
];

/** Blueprint entries setup reads but never copies. */
export const NOT_INSTALLED = ['requires.json'];

/** Whether a change to this vault path is safe while Obsidian is open. */
export function isLive(vaultPath: string): boolean {
  return vaultPath.startsWith('_kiln/') || SETTINGS.some((s) => s.live && s.target === vaultPath);
}

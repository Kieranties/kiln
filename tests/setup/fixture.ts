import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRequires } from '../../src/setup/blueprint.js';
import type { SetupOptions } from '../../src/setup/setup.js';

export const PLUGIN_ROOT = fileURLToPath(new URL('../../claude-plugin/', import.meta.url));

const made: string[] = [];

/**
 * A temporary copy of the plugin's blueprint at `<temp>/<name>/blueprint`, changed by `change`.
 * The last folder name is the plugin version setup records, so two copies may share a name.
 */
export function pluginCopy(name: string, change?: (blueprint: string) => void): string {
  const base = mkdtempSync(join(tmpdir(), 'kiln-plugin-'));
  made.push(base);
  const plugin = join(base, name);
  const blueprint = join(plugin, 'blueprint');
  cpSync(join(PLUGIN_ROOT, 'blueprint'), blueprint, { recursive: true });
  change?.(blueprint);
  return plugin;
}

export function cleanupAll(): void {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
}

const PLUGINS = ['iconic', 'templater-obsidian', 'quickadd', 'homepage'];

/**
 * What Obsidian and the plugins leave in a just-made vault, keyed by path under `.obsidian/`.
 * Exploratory: no trial pinned these.
 */
export const FRESH: Record<string, unknown> = {
  'app.json': {},
  'appearance.json': {},
  'core-plugins.json': {
    'file-explorer': true,
    'global-search': true,
    switcher: true,
    graph: true,
    backlink: true,
    'outgoing-link': true,
    'tag-pane': true,
    properties: true,
    'page-preview': true,
    'daily-notes': true,
    templates: true,
    'command-palette': true,
    bookmarks: true,
    outline: true,
    'word-count': true,
    'file-recovery': true,
    bases: true,
  },
  'community-plugins.json': PLUGINS,
  'types.json': { types: { aliases: 'aliases', cssclasses: 'multitext', tags: 'tags' } },
  'plugins/templater-obsidian/data.json': {
    templates_folder: '',
    trigger_on_file_creation: false,
    folder_templates: [{ folder: '', template: '' }],
  },
  'plugins/homepage/data.json': {
    version: 4,
    homepages: { 'Main Homepage': { value: 'Home', kind: 'File', openOnStartup: true } },
  },
  'workspace.json': {
    main: { id: 'm', type: 'split', children: [] },
    right: {
      id: 'r',
      type: 'split',
      collapsed: true,
      children: [
        { id: 't', type: 'tabs', children: [{ id: 'b', type: 'leaf', state: { type: 'backlink', state: {} } }] },
      ],
    },
  },
};

export type TestVault = {
  root: string;
  vault: string;
  configFile: string;
  options(o?: Partial<SetupOptions>): SetupOptions;
  write(path: string, text: string): void;
  read(path: string): string;
  json(path: string): unknown;
};

const offline = () => Promise.reject(new Error('no network in tests'));

/**
 * A vault at `<root>/Trial Vault` in a new temporary folder, with the four plugins installed at the
 * blueprint's minimums (or the version `plugins` names, or not at all for `null`), and `FRESH` unless
 * `fresh` is false. The kiln file is `<root>/kiln-home/config.json`.
 */
export function testVault(o: { plugins?: Record<string, string | null>; fresh?: boolean } = {}): TestVault {
  const root = mkdtempSync(join(tmpdir(), 'kiln-setup-'));
  made.push(root);
  const vault = join(root, 'Trial Vault');
  const configFile = join(root, 'kiln-home', 'config.json');
  const at = (path: string) => join(vault, ...path.split('/'));
  const write = (path: string, text: string) => {
    mkdirSync(dirname(at(path)), { recursive: true });
    writeFileSync(at(path), text);
  };
  mkdirSync(join(vault, '.obsidian'), { recursive: true });
  const { plugins: minimums } = readRequires(join(PLUGIN_ROOT, 'blueprint'));
  for (const [id, minimum] of Object.entries(minimums)) {
    const version = o.plugins && id in o.plugins ? o.plugins[id] : minimum;
    if (version === null || version === undefined) continue;
    write(`.obsidian/plugins/${id}/manifest.json`, JSON.stringify({ id, version }));
    write(`.obsidian/plugins/${id}/main.js`, '');
  }
  if (o.fresh ?? true) {
    for (const [path, value] of Object.entries(FRESH)) write(`.obsidian/${path}`, JSON.stringify(value, null, 2));
  }
  return {
    root,
    vault,
    configFile,
    options: (more = {}) => ({
      vault,
      pluginRoot: PLUGIN_ROOT,
      platform: process.platform,
      home: root,
      obsidianRunning: false,
      cliPath: 'D:\\apps\\Obsidian\\Obsidian.com',
      kilnConfig: configFile,
      fetch: offline,
      now: new Date('2026-10-12T09:30:00Z'),
      ...more,
    }),
    write,
    read: (path) => readFileSync(at(path), 'utf8'),
    json: (path): unknown => JSON.parse(readFileSync(at(path), 'utf8')),
  };
}

/** A hash of every folder's and file's relative path under `dir`, and each file's bytes and modified time. */
export function fingerprint(dir: string): string {
  const all = createHash('sha256');
  const entries = readdirSync(dir, { recursive: true, withFileTypes: true })
    .map((e) => ({ path: relative(dir, join(e.parentPath, e.name)).split(sep).join('/'), file: e.isFile() }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const { path, file } of entries) {
    all.update(`${path}\0`);
    if (!file) continue;
    const full = join(dir, path);
    all.update(readFileSync(full));
    all.update(`\0${statSync(full).mtimeMs}\n`);
  }
  return all.digest('hex');
}

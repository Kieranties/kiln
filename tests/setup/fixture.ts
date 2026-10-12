import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRequires } from '../../src/setup/blueprint.js';
import type { Fetch, FetchResponse, SetupOptions } from '../../src/setup/setup.js';

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

const SAMPLE_DIR = join(PLUGIN_ROOT, '..', 'tests', 'fixtures', 'layer1');

/** An answer with a JSON body or a text body. */
function answer(body: { json: unknown } | { text: string }): FetchResponse {
  return {
    ok: true,
    status: 200,
    json: () => ('json' in body ? Promise.resolve(body.json) : Promise.reject(new Error('not JSON'))),
    text: () => ('text' in body ? Promise.resolve(body.text) : Promise.resolve(JSON.stringify(body.json))),
  };
}

/**
 * GitHub for the sample at commit `version` (the full SHA is `version` padded with `0`s): the commits,
 * tree and raw endpoints, served from `tests/fixtures/layer1`; the API ones only with GitHub's headers. Records every URL in `urls`.
 * `options.extra` adds files (sample path to text) after the real ones. A URL containing `options.fail`
 * answers 403; any other URL rejects.
 */
export function fakeGitHub(
  version: string,
  options: { fail?: string; extra?: Record<string, string> } = {},
): Fetch & { urls: string[] } {
  const sha = version.padEnd(40, '0');
  const repo = 'Kieranties/kiln';
  const raw = `https://raw.githubusercontent.com/${repo}/${sha}/`;
  const files = readdirSync(SAMPLE_DIR, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(SAMPLE_DIR, join(e.parentPath, e.name)).split(sep).join('/'));
  const folders = [...new Set(files.map((f) => f.split('/').slice(0, -1).join('/')).filter((f) => f !== ''))];
  const tree = [
    { path: 'README.md', type: 'blob' },
    { path: 'tests/fixtures', type: 'tree' },
    { path: 'tests/fixtures/layer1', type: 'tree' },
    ...folders.map((f) => ({ path: `tests/fixtures/layer1/${f}`, type: 'tree' })),
    ...files.map((f) => ({ path: `tests/fixtures/layer1/${f}`, type: 'blob' })),
    ...Object.keys(options.extra ?? {}).map((f) => ({ path: `tests/fixtures/layer1/${f}`, type: 'blob' })),
  ];
  const urls: string[] = [];
  const fetch: Fetch = (url, init) => {
    urls.push(url);
    const headers = init?.headers ?? {};
    const api = headers.Accept === 'application/vnd.github+json' && headers['User-Agent'] === 'kiln-setup';
    if (options.fail !== undefined && url.includes(options.fail)) {
      return Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.reject(new Error('forbidden')),
        text: () => Promise.resolve('forbidden'),
      });
    }
    if (api && url === `https://api.github.com/repos/${repo}/commits/${version}`) {
      return Promise.resolve(answer({ json: { sha } }));
    }
    if (api && url === `https://api.github.com/repos/${repo}/git/trees/${sha}?recursive=1`) {
      return Promise.resolve(answer({ json: { sha, truncated: false, tree } }));
    }
    const prefix = `${raw}tests/fixtures/layer1/`;
    if (url.startsWith(prefix)) {
      const path = url.slice(prefix.length).split('/').map(decodeURIComponent);
      if (files.includes(path.join('/'))) {
        return Promise.resolve(answer({ text: readFileSync(join(SAMPLE_DIR, ...path), 'utf8') }));
      }
      const extra = options.extra?.[path.join('/')];
      if (extra !== undefined) return Promise.resolve(answer({ text: extra }));
    }
    return Promise.reject(new Error(`no such URL in the fake GitHub: ${url}`));
  };
  return Object.assign(fetch, { urls });
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { parse } from 'yaml';
import { loadConfig, saveConfig } from '../../src/config.js';
import { initBase } from '../../src/init.js';
import { KilnError } from '../../src/types.js';

const FOLDERS = [
  'anchors/organisation',
  'anchors/product',
  'anchors/service',
  'anchors/person',
  'anchors/topic',
  'projects',
  'work',
  'decisions',
  'references',
  'notes',
  'attachments',
  'sources/jira',
  'sources/github',
  'sources/slack',
  'sources/email',
  'sources/meeting',
  'sources/web',
  'sources/note',
  'views',
  '.kiln/index',
];

const VIEWS: Record<string, string> = {
  'Inbox.base': `filters:
  and:
    - 'type == "source"'
    - 'triage == "pending"'
views:
  - type: table
    name: Inbox
    order: [file.name, kind, captured_at, why]
`,
  'Needs review.base': `filters:
  and:
    - 'review == "needed"'
views:
  - type: table
    name: Needs review
    order: [file.name, type, review_reason, updated]
`,
  'Active work.base': `filters:
  and:
    - 'type == "work"'
views:
  - type: table
    name: Active work
    filters:
      or:
        - 'status == "active"'
        - 'status == "blocked"'
    order: [file.name, kind, status, ticket, last_checkpoint, updated]
`,
  'Decisions.base': `filters:
  and:
    - 'type == "decision"'
views:
  - type: table
    name: Decisions
    order: [file.name, status, decided_on, anchors, superseded_by]
`,
};

let tmp: string;
let basePath: string;
let cfgPath: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kiln-init-'));
  basePath = join(tmp, 'base');
  cfgPath = join(tmp, 'cfg', 'config.yaml');
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe('initBase', () => {
  it('init creates the full folder layout', () => {
    const base = initBase(basePath, 'northwind', cfgPath);
    expect(base).toEqual({ name: 'northwind', path: basePath });
    for (const f of FOLDERS) expect(existsSync(join(basePath, f)), f).toBe(true);
    expect(existsSync(join(basePath, 'work', '2026'))).toBe(false);
    expect(existsSync(join(basePath, 'decisions', '2026'))).toBe(false);
  });

  it('writes the four views byte-for-byte with LF endings', () => {
    initBase(basePath, 'northwind', cfgPath);
    for (const [file, content] of Object.entries(VIEWS)) {
      expect(readFileSync(join(basePath, 'views', file), 'utf8'), file).toBe(content);
    }
  });

  it('views parse as YAML', () => {
    initBase(basePath, 'northwind', cfgPath);
    for (const file of Object.keys(VIEWS)) {
      const doc = parse(readFileSync(join(basePath, 'views', file), 'utf8')) as {
        filters: unknown;
        views: { type: string; name: string; order: string[] }[];
      };
      expect(doc.filters, file).toBeTruthy();
      expect(doc.views[0]?.type, file).toBe('table');
      expect(doc.views[0]?.order.length, file).toBeGreaterThan(0);
    }
  });

  it('init is idempotent', () => {
    initBase(basePath, 'northwind', cfgPath);
    const edited = join(basePath, 'views', 'Inbox.base');
    writeFileSync(edited, 'custom: true\n');
    initBase(basePath, 'northwind', cfgPath);
    expect(readFileSync(edited, 'utf8')).toBe('custom: true\n');
    expect(readFileSync(join(basePath, '.gitignore'), 'utf8')).toBe('.kiln/\n');
    expect(readFileSync(join(basePath, '.stignore'), 'utf8')).toBe('.kiln\n');
    expect(loadConfig(cfgPath).bases).toEqual([{ name: 'northwind', path: basePath }]);
  });

  it('init registers the base and sets default_base when absent', () => {
    initBase(basePath, 'northwind', cfgPath);
    expect(loadConfig(cfgPath)).toEqual({
      bases: [{ name: 'northwind', path: basePath }],
      rules: [],
      default_base: 'northwind',
    });
  });

  it('keeps an existing default_base', () => {
    saveConfig({ bases: [{ name: 'first', path: join(tmp, 'first') }], rules: [], default_base: 'first' }, cfgPath);
    initBase(basePath, 'northwind', cfgPath);
    const cfg = loadConfig(cfgPath);
    expect(cfg.default_base).toBe('first');
    expect(cfg.bases.map((b) => b.name)).toEqual(['first', 'northwind']);
  });

  it('appends to existing ignore files, preserving CRLF and adding a missing final newline', () => {
    mkdirSync(basePath, { recursive: true });
    writeFileSync(join(basePath, '.gitignore'), 'node_modules\r\ndist');
    writeFileSync(join(basePath, '.stignore'), '  .kiln  \r\n');
    initBase(basePath, 'northwind', cfgPath);
    initBase(basePath, 'northwind', cfgPath);
    expect(readFileSync(join(basePath, '.gitignore'), 'utf8')).toBe('node_modules\r\ndist\r\n.kiln/\r\n');
    expect(readFileSync(join(basePath, '.stignore'), 'utf8')).toBe('  .kiln  \r\n');
  });

  it('resolves a relative path to an absolute one', () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmp);
    try {
      const base = initBase(join('sub', 'rel'), 'rel', cfgPath);
      expect(isAbsolute(base.path)).toBe(true);
      expect(base.path).toBe(join(tmp, 'sub', 'rel'));
      expect(existsSync(join(tmp, 'sub', 'rel', 'views'))).toBe(true);
      expect(loadConfig(cfgPath).bases).toEqual([{ name: 'rel', path: join(tmp, 'sub', 'rel') }]);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('rejects a name already registered at a different path, changing nothing', () => {
    initBase(basePath, 'northwind', cfgPath);
    const before = readFileSync(cfgPath, 'utf8');
    const other = join(tmp, 'other');
    expect(() => initBase(other, 'northwind', cfgPath)).toThrow(KilnError);
    try {
      initBase(other, 'northwind', cfgPath);
    } catch (e) {
      expect((e as KilnError).code).toBe('validation');
    }
    expect(readFileSync(cfgPath, 'utf8')).toBe(before);
    expect(existsSync(other)).toBe(false);
  });

  it('rejects a path already registered under another name', () => {
    initBase(basePath, 'northwind', cfgPath);
    expect(() => initBase(basePath, 'other', cfgPath)).toThrowError(expect.objectContaining({ code: 'validation' }));
    expect(loadConfig(cfgPath).bases).toHaveLength(1);
  });

  it.runIf(process.platform === 'win32')('treats a case-different path as the same base on win32', () => {
    initBase(basePath, 'northwind', cfgPath);
    initBase(basePath.toUpperCase(), 'northwind', cfgPath);
    expect(loadConfig(cfgPath).bases).toHaveLength(1);
  });

  it.each(['', 'has space', 'a/b', 'bad.name', 'all', 'ALL', 'All'])('rejects invalid or reserved name %j', (name) => {
    expect(() => initBase(basePath, name, cfgPath)).toThrowError(expect.objectContaining({ code: 'validation' }));
    expect(existsSync(basePath)).toBe(false);
  });
});

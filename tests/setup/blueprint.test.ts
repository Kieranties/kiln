import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { installedFiles, isLive, NOT_INSTALLED, readRequires, SETTINGS } from '../../src/setup/blueprint.js';
import { blueprintHash, hash } from '../../src/setup/hash.js';
import { BLUEPRINT } from '../kit/load.js';
import { cleanupAll, pluginCopy } from './fixture.js';

afterAll(cleanupAll);
const files = installedFiles(BLUEPRINT);

describe('installedFiles', () => {
  it('maps the blueprint to its vault paths', () => {
    for (const path of [
      '_kiln/types/work.md',
      '_kiln/templates/Work.md',
      '_kiln/templates/kinds/Work bug.md',
      '_kiln/views/today.base',
      '_kiln/properties.md',
      '_kiln/README.md',
      '_kiln/GETTING-STARTED.md',
      '_kiln/TRY-THE-SAMPLE.md',
      'Home.md',
      'Board.base',
      '.obsidian/snippets/kiln.css',
    ]) {
      expect(files.has(path), path).toBe(true);
    }
    expect(files.get('_kiln/types/work.md')).toBe(readFileSync(join(BLUEPRINT, 'types', 'work.md'), 'utf8'));
    expect([...files.keys()]).toEqual([...files.keys()].sort());
  });

  it('accounts for every blueprint entry: installed, merged, or read only', () => {
    const merged = new Set(SETTINGS.map((s) => s.fragment));
    for (const entry of readdirSync(join(BLUEPRINT, 'settings'), { recursive: true, withFileTypes: true }).filter((e) =>
      e.isFile(),
    )) {
      const path = join(entry.parentPath, entry.name).slice(BLUEPRINT.length).split(/[\\/]/).join('/');
      expect(merged.has(path) || path.startsWith('settings/snippets/'), path).toBe(true);
    }
    const handled = ['types', 'templates', 'views', 'root', 'settings', ...NOT_INSTALLED];
    for (const entry of readdirSync(BLUEPRINT)) {
      expect(handled.includes(entry) || entry.endsWith('.md'), entry).toBe(true);
    }
  });

  it('only _kiln/, Iconic and Templater are live', () => {
    expect(isLive('_kiln/types/work.md')).toBe(true);
    expect(isLive('.obsidian/plugins/iconic/data.json')).toBe(true);
    expect(isLive('.obsidian/plugins/templater-obsidian/data.json')).toBe(true);
    for (const path of [
      'Home.md',
      '.obsidian/plugins/quickadd/data.json',
      '.obsidian/app.json',
      '.obsidian/snippets/kiln.css',
    ]) {
      expect(isLive(path), path).toBe(false);
    }
  });
});

describe('requires.json', () => {
  it('names Obsidian and the four plugins', () => {
    const requires = readRequires(BLUEPRINT);
    expect(requires.obsidian).toBe('1.14.0');
    expect(requires.plugins).toEqual({
      iconic: '1.1.10',
      'templater-obsidian': '2.26.0',
      quickadd: '2.32.0',
      homepage: '4.5.0',
    });
  });
});

describe('hashes', () => {
  it('hash a string as UTF-8', () => {
    expect(hash('kiln')).toBe(hash(new TextEncoder().encode('kiln')));
    expect(hash('kiln')).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('the blueprint hash changes with any file', () => {
    const a = pluginCopy('aaaaaaaaaaaa');
    const b = pluginCopy('bbbbbbbbbbbb', (dir) => writeFileSync(join(dir, 'views', 'today.base'), 'changed\n'));
    expect(blueprintHash(join(a, 'blueprint'))).toBe(blueprintHash(BLUEPRINT));
    expect(blueprintHash(join(b, 'blueprint'))).not.toBe(blueprintHash(BLUEPRINT));
  });

  it('ignore line endings', () => {
    const file = join('views', 'today.base');
    const crlf = pluginCopy('cccccccccccc', (dir) => {
      const path = join(dir, file);
      writeFileSync(path, readFileSync(path, 'utf8').replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'));
    });
    const original = readFileSync(join(BLUEPRINT, file), 'utf8');
    const rewritten = readFileSync(join(crlf, 'blueprint', file), 'utf8');
    expect(rewritten).toContain('\r\n');
    expect(hash(rewritten)).toBe(hash(original));
    expect(blueprintHash(join(crlf, 'blueprint'))).toBe(blueprintHash(BLUEPRINT));
  });
});

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { obsidianListPath, readObsidianVaults } from '../../src/vault/obsidian.js';
import { sandbox, type Sandbox } from './fixture.js';

let s: Sandbox;
beforeEach(() => {
  s = sandbox();
});
afterEach(() => s.cleanup());

describe('obsidianListPath', () => {
  it("is Obsidian's own config folder on each platform", () => {
    const home = s.home;
    expect(obsidianListPath({ platform: 'win32', env: { APPDATA: s.appData }, home })).toBe(s.obsidianFile);
    expect(obsidianListPath({ platform: 'win32', env: {}, home })).toBe(
      join(home, 'AppData', 'Roaming', 'obsidian', 'obsidian.json'),
    );
    expect(obsidianListPath({ platform: 'darwin', env: {}, home })).toBe(
      join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json'),
    );
    expect(obsidianListPath({ platform: 'linux', env: {}, home })).toBe(
      join(home, '.config', 'obsidian', 'obsidian.json'),
    );
    expect(obsidianListPath({ platform: 'linux', env: { XDG_CONFIG_HOME: join(s.root, 'xdg') }, home })).toBe(
      join(s.root, 'xdg', 'obsidian', 'obsidian.json'),
    );
  });
});

describe('readObsidianVaults', () => {
  it('is undefined when Obsidian has no list', () => {
    expect(readObsidianVaults(s.obsidianFile)).toBeUndefined();
  });
  it('reads every vault path, in order, skipping entries without one', () => {
    mkdirSync(dirname(s.obsidianFile), { recursive: true });
    writeFileSync(
      s.obsidianFile,
      JSON.stringify({
        vaults: { a1: { path: 'D:\\notes', ts: 1, open: true }, b2: { ts: 2 }, c3: { path: 'D:\\tmp\\kiln-sample' } },
      }),
    );
    expect(readObsidianVaults(s.obsidianFile)).toEqual(['D:\\notes', 'D:\\tmp\\kiln-sample']);
  });
  it('names a broken list', () => {
    mkdirSync(dirname(s.obsidianFile), { recursive: true });
    writeFileSync(s.obsidianFile, '{ "vaults": ');
    expect(() => readObsidianVaults(s.obsidianFile)).toThrow(/^not valid JSON: /);
    writeFileSync(s.obsidianFile, '{ "frame": "native" }');
    expect(() => readObsidianVaults(s.obsidianFile)).toThrow('no vaults list');
  });
});

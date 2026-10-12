import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { kilnConfigPath, readKilnConfig, recordVault } from '../../src/vault/config.js';
import { sandbox, type Sandbox } from './fixture.js';

let s: Sandbox;
beforeEach(() => {
  s = sandbox();
});
afterEach(() => s.cleanup());

const text = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

describe('kilnConfigPath', () => {
  it('is ~/.kiln/config.json, or config.json in KILN_HOME', () => {
    expect(kilnConfigPath({ env: {}, home: s.home })).toBe(join(s.home, '.kiln', 'config.json'));
    expect(kilnConfigPath({ env: { KILN_HOME: join(s.root, 'k') }, home: s.home })).toBe(
      join(s.root, 'k', 'config.json'),
    );
  });
});

describe('readKilnConfig', () => {
  it('is undefined when there is no file', () => {
    expect(readKilnConfig(s.configFile)).toBeUndefined();
  });
  it('reads a file edited by hand, with a byte-order mark and CRLF', () => {
    mkdirSync(dirname(s.configFile), { recursive: true });
    writeFileSync(s.configFile, '\uFEFF{\r\n  "default": "work",\r\n  "vaults": { "work": "D:\\\\notes" }\r\n}\r\n');
    expect(readKilnConfig(s.configFile)).toEqual({ default: 'work', vaults: { work: 'D:\\notes' } });
  });
  it('names what is wrong with a broken file', () => {
    mkdirSync(dirname(s.configFile), { recursive: true });
    writeFileSync(s.configFile, '{ "vaults": ');
    expect(() => readKilnConfig(s.configFile)).toThrow(/^not valid JSON: /);
    s.record({ vaults: ['D:\\notes'] });
    expect(() => readKilnConfig(s.configFile)).toThrow('vaults must be a map of names to folders');
    s.record({ default: 3, vaults: {} });
    expect(() => readKilnConfig(s.configFile)).toThrow('default must be a vault name');
  });
});

describe('recordVault', () => {
  it('creates the file, and the first vault becomes the default', () => {
    const work = s.vault('work');
    recordVault(s.configFile, 'work', work);
    expect(readFileSync(s.configFile, 'utf8')).toBe(text({ default: 'work', vaults: { work } }));
    expect(readdirSync(dirname(s.configFile))).toEqual(['config.json']);
  });
  it('adds a vault without changing the default, unless asked', () => {
    const work = s.vault('work');
    const trial = s.vault('trial');
    recordVault(s.configFile, 'work', work);
    expect(recordVault(s.configFile, 'trial', trial)).toEqual({ default: 'work', vaults: { work, trial } });
    expect(recordVault(s.configFile, 'trial', trial, { makeDefault: true }).default).toBe('trial');
  });
  it('keeps keys it does not know, after default and vaults', () => {
    const work = s.vault('work');
    const routes = [{ path: 'D:\\src\\personal\\**', vault: 'work' }];
    s.record({ routes, vaults: {} });
    recordVault(s.configFile, 'work', work);
    expect(readFileSync(s.configFile, 'utf8')).toBe(text({ default: 'work', vaults: { work }, routes }));
  });
  it('records the vault root from a ~ path', () => {
    const work = s.vault('work');
    recordVault(s.configFile, 'work', '~/vaults/work', { home: s.home });
    expect(readKilnConfig(s.configFile)?.vaults.work).toBe(work);
  });
  it('refuses a folder that is not a kiln vault, and a name that looks like a path', () => {
    const plain = s.vault('plain', 'obsidian');
    expect(() => recordVault(s.configFile, 'plain', plain)).toThrow(/is an Obsidian vault without kiln/);
    expect(() => recordVault(s.configFile, 'D:\\notes', s.vault('work'))).toThrow(/^vault names use letters/);
    expect(existsSync(s.configFile)).toBe(false);
  });
  it('never overwrites a file it cannot read', () => {
    mkdirSync(dirname(s.configFile), { recursive: true });
    writeFileSync(s.configFile, '{ "vaults": ');
    expect(() => recordVault(s.configFile, 'work', s.vault('work'))).toThrow(/can't be read, so it was left as it is/);
    expect(readFileSync(s.configFile, 'utf8')).toBe('{ "vaults": ');
  });
});

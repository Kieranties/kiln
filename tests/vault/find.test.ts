import { join, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkVault, findVault } from '../../src/vault/find.js';
import { envValue, expandHome, pathKey } from '../../src/vault/paths.js';
import { findVault as checkFindVault } from '../../src/check/vault.js';
import { sandbox, type Sandbox } from './fixture.js';

let s: Sandbox;
beforeEach(() => {
  s = sandbox();
});
afterEach(() => s.cleanup());

describe('paths', () => {
  it('treats a blank variable as unset', () => {
    expect(envValue({ KILN_VAULT: '  ' }, 'KILN_VAULT')).toBeUndefined();
    expect(envValue({ KILN_VAULT: ' work ' }, 'KILN_VAULT')).toBe('work');
  });
  it('expands a leading ~ in either separator', () => {
    expect(expandHome('~', s.home)).toBe(s.home);
    expect(expandHome('~/vaults/work', s.home)).toBe(join(s.home, 'vaults/work'));
    expect(expandHome('~\\vaults\\work', s.home)).toBe(join(s.home, 'vaults\\work'));
    expect(expandHome('D:\\notes~', s.home)).toBe('D:\\notes~');
  });
  it('ignores a trailing separator, and letter case on Windows and macOS', () => {
    const v = join(s.home, 'Vault');
    expect(pathKey(v + sep, 'linux')).toBe(pathKey(v, 'linux'));
    expect(pathKey(v.toUpperCase(), 'win32')).toBe(pathKey(v, 'win32'));
    expect(pathKey(v.toUpperCase(), 'linux')).not.toBe(pathKey(v, 'linux'));
  });
});

describe('findVault', () => {
  it('is shared with the note check', () => {
    expect(checkFindVault).toBe(findVault);
  });
  it('walks up from a subfolder', () => {
    const work = s.vault('work');
    expect(findVault(join(work, 'Work'))).toBe(work);
  });
});

describe('checkVault', () => {
  it('accepts a kiln vault, or with walkUp a folder inside one', () => {
    const work = s.vault('work');
    expect(checkVault(work, { walkUp: false })).toEqual({ ok: true, root: work });
    expect(checkVault(join(work, 'Work'), { walkUp: true })).toEqual({ ok: true, root: work });
  });
  it('rejects a subfolder when the path must be the vault root', () => {
    const sub = join(s.vault('work'), 'Work');
    expect(checkVault(sub, { walkUp: false })).toEqual({
      ok: false,
      reason: `${sub} isn't a kiln vault: it has no _kiln/types/ folder`,
    });
  });
  it('rejects a plain Obsidian vault, naming its root', () => {
    const plain = s.vault('plain', 'obsidian');
    const reason = `${plain} is an Obsidian vault without kiln: it has no _kiln/types/ folder. Set it up with /kiln:setup first.`;
    expect(checkVault(plain, { walkUp: false })).toEqual({ ok: false, reason });
    expect(checkVault(join(plain, 'Work'), { walkUp: true })).toEqual({ ok: false, reason });
  });
  it('rejects a missing path and a folder in no vault', () => {
    const gone = join(s.root, 'gone');
    expect(checkVault(gone, { walkUp: true })).toEqual({ ok: false, reason: `${gone} doesn't exist` });
    expect(checkVault(s.cwd, { walkUp: true })).toEqual({
      ok: false,
      reason: `${s.cwd} isn't in a kiln vault: no _kiln/types/ folder here or above`,
    });
  });
});

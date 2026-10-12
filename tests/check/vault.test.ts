import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { findVault, openVault } from '../../src/check/vault.js';
import { makeVault } from './fixture.js';

const vault = makeVault();
const outside = mkdtempSync(join(tmpdir(), 'kiln-outside-'));
afterAll(() => {
  rmSync(vault, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe('findVault', () => {
  it('walks up from a note to the folder holding _kiln/types', () => {
    expect(findVault(join(vault, 'Work', 'Fix renewal date rollover.md'))).toBe(vault);
  });
  it('accepts the vault folder itself', () => {
    expect(findVault(vault)).toBe(vault);
  });
  it('returns an absolute root for a relative path', () => {
    const here = process.cwd();
    try {
      process.chdir(vault);
      expect(findVault(join('Work', 'Fix renewal date rollover.md'))).toBe(vault);
      expect(findVault('.')).toBe(vault);
    } finally {
      process.chdir(here);
    }
  });
  it('finds nothing outside a vault', () => {
    expect(findVault(outside)).toBeUndefined();
  });
});

describe('openVault', () => {
  it("lists the vault's notes, leaving out _kiln and dot-folders", () => {
    mkdirSync(join(vault, '.obsidian'), { recursive: true });
    writeFileSync(join(vault, '.obsidian', 'stray.md'), 'x');
    const v = openVault(vault);
    expect(v.notes).toHaveLength(16);
    expect(v.notes).toContain('People/Priya Raman.md');
    expect(v.notes.some((n) => n.startsWith('_kiln/') || n.startsWith('.obsidian/'))).toBe(false);
  });
  it('lists the same notes for a root with a trailing separator or a relative root', () => {
    const expected = openVault(vault).notes;
    expect(openVault(vault + sep).notes).toEqual(expected);
    expect(openVault(relative(process.cwd(), vault)).notes).toEqual(expected);
  });
  it('indexes file names for links, case-insensitively', () => {
    const v = openVault(vault);
    expect(v.names.get('priya raman')).toEqual(['People/Priya Raman.md']);
    expect(v.blueprint.definitions).toHaveLength(12);
  });
});

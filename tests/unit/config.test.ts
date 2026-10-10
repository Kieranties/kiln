import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baseContaining, loadConfig, resolveBase, saveConfig, type KilnConfig } from '../../src/config.js';
import { KilnError } from '../../src/types.js';

/** Windows-style (backslash) form of a forward-slash path. */
const win = (p: string) => p.replaceAll('/', String.fromCharCode(92));

const work = { name: 'work', path: 'Z:/kb-work' };
const other = { name: 'other', path: 'Z:/kb-other' };
const cfg: KilnConfig = {
  bases: [work, other],
  rules: [
    { path: 'Z:/work/**', base: 'work' },
    { path: 'Z:/**', base: 'other' },
  ],
};

describe('resolveBase', () => {
  it('explicit base wins over rules', () => {
    expect(resolveBase(cfg, { explicit: 'other', cwd: win('Z:/work/repo') }).name).toBe('other');
  });

  it('first matching rule wins', () => {
    expect(resolveBase(cfg, { cwd: win('Z:/work/repo') }).name).toBe('work');
  });

  it.runIf(process.platform === 'win32')('matching is case-insensitive and slash-agnostic on win32', () => {
    expect(resolveBase(cfg, { cwd: win('z:/WORK/repo') }).name).toBe('work');
  });

  it('rules match cwd under dot-directories', () => {
    const c: KilnConfig = { bases: [work], rules: [{ path: 'D:/src/kiln/**', base: 'work' }] };
    expect(resolveBase(c, { cwd: 'D:/src/kiln/.claude/worktrees/x' }).name).toBe('work');
  });

  it('falls back to default_base', () => {
    const c: KilnConfig = { ...cfg, rules: [], default_base: 'other' };
    expect(resolveBase(c, { cwd: win('Z:/elsewhere') }).name).toBe('other');
  });

  it('throws no_base when nothing matches and no default', () => {
    const c: KilnConfig = { ...cfg, rules: [] };
    try {
      resolveBase(c, { cwd: win('Z:/elsewhere') });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(KilnError);
      expect((e as KilnError).code).toBe('no_base');
    }
  });

  it('throws no_base when the explicit base is unknown', () => {
    expect(() => resolveBase(cfg, { explicit: 'nope', cwd: win('Z:/work') })).toThrow(KilnError);
  });
});

describe('baseContaining', () => {
  it('finds the base for a file path inside it and null outside', () => {
    const c: KilnConfig = { bases: [{ name: 'kb', path: 'Z:/kb' }], rules: [] };
    expect(baseContaining(c, 'Z:/kb/notes/a.md')?.name).toBe('kb');
    expect(baseContaining(c, win('Z:/kb/notes/a.md'))?.name).toBe('kb');
    expect(baseContaining(c, 'Z:/elsewhere/a.md')).toBeNull();
  });

  it('does not match a sibling with a shared prefix', () => {
    const c: KilnConfig = { bases: [{ name: 'kb', path: 'Z:/kb' }], rules: [] };
    expect(baseContaining(c, 'Z:/kb2/x.md')).toBeNull();
  });

  it.runIf(process.platform === 'win32')('is case-insensitive on win32', () => {
    const c: KilnConfig = { bases: [{ name: 'kb', path: 'Z:/KB' }], rules: [] };
    expect(baseContaining(c, win('z:/kb/a.md'))?.name).toBe('kb');
  });

  it.runIf(process.platform === 'win32')('reads MSYS-style /x/... paths as drive paths on win32', () => {
    const c: KilnConfig = { bases: [{ name: 'live', path: win('D:/tmp/kiln-live') }], rules: [] };
    expect(baseContaining(c, '/d/tmp/kiln-live/a.md')?.name).toBe('live');
    expect(baseContaining(c, '/D/tmp/kiln-live')?.name).toBe('live');
    expect(baseContaining(c, '/d/tmp/kiln-other/a.md')).toBeNull();
    expect(baseContaining(c, '/zz/scrap/kiln-live/a.md')).toBeNull();
  });

  it('sees through a junction (or symlink) on either side', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kiln-guard-'));
    try {
      const real = join(dir, 'real-base');
      const alias = join(dir, 'alias');
      mkdirSync(join(real, 'notes'), { recursive: true });
      try {
        symlinkSync(real, alias, 'junction');
      } catch (e) {
        console.warn(`skipped: cannot create a junction here (${(e as Error).message})`);
        return;
      }
      const byReal: KilnConfig = { bases: [{ name: 'kb', path: real }], rules: [] };
      expect(baseContaining(byReal, join(alias, 'notes', 'a.md'))?.name).toBe('kb');
      expect(baseContaining(byReal, join(alias, 'new-folder', 'deeper', 'a.md'))?.name).toBe('kb');
      const byAlias: KilnConfig = { bases: [{ name: 'kb', path: alias }], rules: [] };
      expect(baseContaining(byAlias, join(real, 'notes', 'a.md'))?.name).toBe('kb');
      expect(baseContaining(byReal, join(dir, 'elsewhere', 'a.md'))).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('loadConfig / saveConfig', () => {
  it('loadConfig returns empty config when file missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kiln-config-'));
    try {
      expect(loadConfig(join(dir, 'nope.yaml'))).toEqual({ bases: [], rules: [] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('round-trips through saveConfig, creating parent directories', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kiln-config-'));
    try {
      const file = join(dir, 'nested', 'config.yaml');
      const c: KilnConfig = { ...cfg, default_base: 'work' };
      saveConfig(c, file);
      expect(loadConfig(file)).toEqual(c);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

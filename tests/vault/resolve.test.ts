import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveVault } from '../../src/vault/resolve.js';
import { sandbox, type Sandbox } from './fixture.js';

let s: Sandbox;
let work: string;
let trial: string;
beforeEach(() => {
  s = sandbox();
  work = s.vault('work');
  trial = s.vault('trial');
});
afterEach(() => s.cleanup());

const withEnv = (env: Record<string, string>) => s.where({ env: { ...s.env, ...env } });

describe('resolveVault: each step, in order', () => {
  it('1. an explicit path beats the current folder and KILN_VAULT, and may be inside the vault', () => {
    s.record({ default: 'work', vaults: { work, trial } });
    const where = s.where({ cwd: work, env: { ...s.env, KILN_VAULT: 'work' } });
    expect(resolveVault(where, join(trial, 'Work'))).toEqual({ vault: trial, source: 'explicit', name: 'trial' });
  });

  it('1. resolves a relative explicit path against the current folder', () => {
    expect(resolveVault(s.where({ cwd: join(s.home, 'vaults') }), 'trial')).toEqual({
      vault: trial,
      source: 'explicit',
    });
  });

  it('1. a plain Obsidian vault given explicitly stops, and does not fall back to the default', () => {
    const plain = s.vault('plain', 'obsidian');
    s.record({ default: 'work', vaults: { work } });
    const r = resolveVault(s.where(), plain);
    expect(r).toEqual({
      vault: null,
      candidates: [{ path: work, name: 'work', from: 'kiln' }],
      reasons: [
        `${plain} is an Obsidian vault without kiln: it has no _kiln/types/ folder. Set it up with /kiln:setup first.`,
      ],
    });
  });

  it('2. the vault holding the current folder, from a subfolder', () => {
    expect(resolveVault(s.where({ cwd: join(work, 'Work') }))).toEqual({ vault: work, source: 'current-folder' });
  });

  it('2. Claudian: the current folder beats a global KILN_VAULT and the default, even a broken one', () => {
    s.record({ default: 'trial', vaults: { work, trial } });
    for (const KILN_VAULT of ['trial', trial, 'nope']) {
      const where = s.where({ cwd: work, env: { ...s.env, KILN_VAULT } });
      expect(resolveVault(where), KILN_VAULT).toEqual({ vault: work, source: 'current-folder', name: 'work' });
    }
  });

  it('3. KILN_VAULT by name, by path and by ~ path beats the default', () => {
    s.record({ default: 'work', vaults: { work, trial } });
    expect(resolveVault(withEnv({ KILN_VAULT: 'trial' }))).toEqual({
      vault: trial,
      source: 'KILN_VAULT',
      name: 'trial',
    });
    expect(resolveVault(withEnv({ KILN_VAULT: join(trial, 'Work') }))).toEqual({
      vault: trial,
      source: 'KILN_VAULT',
      name: 'trial',
    });
    expect(resolveVault(withEnv({ KILN_VAULT: '~/vaults/trial' }))).toEqual({
      vault: trial,
      source: 'KILN_VAULT',
      name: 'trial',
    });
  });

  it('3. an empty KILN_VAULT counts as unset', () => {
    s.record({ default: 'work', vaults: { work } });
    expect(resolveVault(withEnv({ KILN_VAULT: '' }))).toEqual({ vault: work, source: 'default', name: 'work' });
  });

  it('3. an unknown name or a plain vault in KILN_VAULT stops, and does not fall back to the default', () => {
    s.record({ default: 'work', vaults: { work } });
    const unknown = resolveVault(withEnv({ KILN_VAULT: 'nope' }));
    expect(unknown.vault).toBeNull();
    expect(unknown).toMatchObject({
      reasons: [
        `the current folder (${s.cwd}) isn't in a kiln vault`,
        `KILN_VAULT is "nope": no vault of that name in ${s.configFile}, and no folder of that name`,
      ],
    });
    const plain = s.vault('plain', 'obsidian');
    expect(resolveVault(withEnv({ KILN_VAULT: plain }))).toMatchObject({
      vault: null,
      reasons: [expect.any(String), expect.stringMatching(/^KILN_VAULT is ".*": .* is an Obsidian vault without kiln/)],
    });
  });

  it("4. the kiln file's default, which beats Obsidian's list", () => {
    s.record({ default: 'work', vaults: { work, trial } });
    s.obsidian([trial]);
    expect(resolveVault(s.where())).toEqual({ vault: work, source: 'default', name: 'work' });
  });

  it('4. a default that moved or was deleted stops, and offers the other recorded vaults', () => {
    s.record({ default: 'work', vaults: { work, trial } });
    rmSync(work, { recursive: true, force: true });
    expect(resolveVault(s.where())).toEqual({
      vault: null,
      candidates: [{ path: trial, name: 'trial', from: 'kiln' }],
      reasons: [
        `the current folder (${s.cwd}) isn't in a kiln vault`,
        "KILN_VAULT isn't set",
        `${s.configFile}'s default "work": ${work} doesn't exist`,
      ],
    });
  });

  it("4. a default that names no vault, and a kiln file that can't be read, stop", () => {
    s.record({ default: 'gone', vaults: { work } });
    expect(resolveVault(s.where())).toMatchObject({
      vault: null,
      reasons: expect.arrayContaining([`${s.configFile}'s default is "gone", which isn't one of its vaults`]),
    });
    s.record('x');
    s.obsidian([work]);
    const broken = resolveVault(s.where());
    expect(broken).toMatchObject({ vault: null, candidates: [{ path: work, from: 'obsidian' }] });
    expect(broken.vault === null && broken.reasons.at(-1)).toMatch(/can't be read: /);
  });

  it('4. a kiln config path that is a folder is a reason, not a raw error', () => {
    mkdirSync(s.configFile, { recursive: true });
    const r = resolveVault(s.where());
    expect(r).toMatchObject({ vault: null, candidates: [] });
    const last = r.vault === null ? r.reasons.at(-1) : undefined;
    expect(last).toContain(`${s.configFile} can't be read: `);
    expect(last).not.toMatch(/\n\s+at /);
  });

  it('3. KILN_VAULT with a kiln config path that is a folder says the file can not be read', () => {
    mkdirSync(s.configFile, { recursive: true });
    const r = resolveVault(withEnv({ KILN_VAULT: 'nope' }));
    expect(r.vault === null && r.reasons.at(-1)).toMatch(new RegExp(`^KILN_VAULT is "nope": .* can't be read: `));
  });

  it("5. Obsidian's list, when exactly one vault in it has kiln", () => {
    s.obsidian([s.vault('plain', 'obsidian'), trial, join(s.root, 'gone')]);
    expect(resolveVault(s.where())).toEqual({ vault: trial, source: 'obsidian' });
  });

  it('5. an Obsidian list that is a folder is a reason, and resolution goes on', () => {
    mkdirSync(s.obsidianFile, { recursive: true });
    const r = resolveVault(s.where());
    expect(r).toMatchObject({ vault: null, candidates: [] });
    const last = r.vault === null ? r.reasons.at(-1) : undefined;
    expect(last).toContain("Obsidian's vault list can't be read: ");
    expect(last).not.toMatch(/\n\s+at /);
  });

  it('6. two kiln vaults in Obsidian and no record: no vault, both offered', () => {
    s.obsidian([work, trial]);
    expect(resolveVault(s.where())).toEqual({
      vault: null,
      candidates: [
        { path: work, from: 'obsidian' },
        { path: trial, from: 'obsidian' },
      ],
      reasons: [
        `the current folder (${s.cwd}) isn't in a kiln vault`,
        "KILN_VAULT isn't set",
        `no kiln file at ${s.configFile}`,
        "Obsidian lists 2 kiln vaults, so it can't choose",
      ],
    });
  });

  it('6. nothing at all: no candidates, and a reason for each step', () => {
    expect(resolveVault(s.where())).toEqual({
      vault: null,
      candidates: [],
      reasons: [
        `the current folder (${s.cwd}) isn't in a kiln vault`,
        "KILN_VAULT isn't set",
        `no kiln file at ${s.configFile}`,
        `no Obsidian vault list at ${s.obsidianFile}`,
      ],
    });
  });

  it('6. the same vault in the kiln file and in Obsidian is one candidate', () => {
    s.record({ vaults: { work, trial } });
    s.obsidian([work + sep, trial, trial.toUpperCase(), s.vault('third')]);
    const r = resolveVault(s.where());
    expect(r).toMatchObject({
      vault: null,
      candidates: [
        { path: work, name: 'work', from: 'kiln' },
        { path: trial, name: 'trial', from: 'kiln' },
        { path: join(s.home, 'vaults', 'third'), from: 'obsidian' },
      ],
    });
    expect(r.vault === null && r.reasons).toContain("Obsidian lists 3 kiln vaults, so it can't choose");
  });
});

describe('src/vault', () => {
  it('never reads the real environment, folder or home', () => {
    const dir = fileURLToPath(new URL('../../src/vault/', import.meta.url));
    for (const file of readdirSync(dir)) {
      expect(readFileSync(join(dir, file), 'utf8'), file).not.toMatch(/process\.|homedir\(|tmpdir\(/);
    }
  });
});

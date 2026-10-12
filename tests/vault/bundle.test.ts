import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeVault } from '../check/fixture.js';
import { sandbox, type Sandbox } from './fixture.js';

const SCRIPTS = fileURLToPath(new URL('../../claude-plugin/scripts/', import.meta.url));
const OVERRIDDEN = ['KILN_VAULT', 'KILN_HOME', 'HOME', 'USERPROFILE', 'APPDATA', 'XDG_CONFIG_HOME'];

let s: Sandbox;
let sample: string;
beforeEach(() => {
  s = sandbox();
  sample = makeVault();
});
afterEach(() => {
  s.cleanup();
  rmSync(sample, { recursive: true, force: true });
});

/** Runs a bundle with plain node, a temporary home and no KILN_VAULT, whatever the real environment holds. */
function run(script: string, args: string[], cwd: string, extra: Record<string, string> = {}) {
  // Windows variable names ignore case, so drop the real ones by upper-cased name before adding ours.
  const env: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !OVERRIDDEN.includes(k.toUpperCase())),
  );
  Object.assign(
    env,
    { HOME: s.home, USERPROFILE: s.home, APPDATA: s.appData, XDG_CONFIG_HOME: join(s.home, '.config') },
    extra,
  );
  return spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { cwd, env, encoding: 'utf8' });
}

describe('kiln-vault.mjs', () => {
  it('finds the vault from a folder inside it, and kiln-check checks it', () => {
    const r = run('kiln-vault.mjs', [], join(sample, 'Work'));
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    const found = JSON.parse(r.stdout) as { vault: string; source: string };
    // The child's current folder may be the long or real form of the temporary path (8.3 names, /private/var).
    expect(realpathSync.native(found.vault)).toBe(realpathSync.native(sample));
    expect(found.source).toBe('current-folder');
    expect(run('kiln-check.mjs', [found.vault], s.cwd).stdout).toBe('Checked 16 notes: no problems.\n');
  });

  it('finds the default from another folder, and KILN_VAULT overrides it', () => {
    const work = s.vault('work');
    s.record({ default: 'sample', vaults: { sample, work } });
    expect(JSON.parse(run('kiln-vault.mjs', [], s.cwd).stdout)).toEqual({
      vault: sample,
      source: 'default',
      name: 'sample',
    });
    expect(JSON.parse(run('kiln-vault.mjs', [], s.cwd, { KILN_VAULT: 'work' }).stdout)).toEqual({
      vault: work,
      source: 'KILN_VAULT',
      name: 'work',
    });
  });

  it('honours KILN_HOME for the kiln file', () => {
    const elsewhere = join(s.root, 'kiln-home');
    s.record({ default: 'sample', vaults: { sample } });
    const r = run('kiln-vault.mjs', [], s.cwd, { KILN_HOME: elsewhere });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(`no kiln file at ${JSON.stringify(join(elsewhere, 'config.json')).slice(1, -1)}`);
  });

  it('exits 1 with no vault, and writes nothing', () => {
    const r = run('kiln-vault.mjs', [], s.cwd);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({ vault: null, candidates: [] });
    expect(existsSync(join(s.home, '.kiln'))).toBe(false);
  });

  it('exits 2 on bad arguments', () => {
    expect(run('kiln-vault.mjs', ['a', 'b'], s.cwd).status).toBe(2);
  });
});

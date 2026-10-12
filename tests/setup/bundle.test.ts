import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupAll, fingerprint, testVault } from './fixture.js';

const BUNDLE = fileURLToPath(new URL('../../claude-plugin/scripts/kiln-setup.mjs', import.meta.url));
const OVERRIDDEN = ['KILN_VAULT', 'KILN_HOME', 'KILN_OBSIDIAN_RUNNING', 'HOME', 'USERPROFILE'];
afterAll(cleanupAll);

const t = testVault();
// Windows variable names ignore case, so drop the real ones by upper-cased name before adding ours.
const env: Record<string, string | undefined> = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !OVERRIDDEN.includes(k.toUpperCase()))),
  HOME: t.root,
  USERPROFILE: t.root,
  KILN_HOME: join(t.root, 'kiln-home'),
  KILN_OBSIDIAN_RUNNING: '0',
};
const run = (...args: string[]) =>
  spawnSync(process.execPath, [BUNDLE, ...args], { encoding: 'utf8', env, cwd: t.root });

describe('kiln-setup.mjs', () => {
  it('carries the licence of yaml, which it inlines', () => {
    expect(readFileSync(BUNDLE, 'utf8')).toMatch(/^ \* Includes yaml \d/m);
  });

  it('plans, applies, and applies again without a change', () => {
    const plan = run('plan', '--vault', t.vault);
    expect(plan.stderr).toBe('');
    expect(plan.status).toBe(0);
    expect(JSON.parse(plan.stdout)).toMatchObject({ mode: 'setup', plugin: 'claude-plugin', asks: [] });
    expect(run('apply', '--vault', t.vault).status).toBe(0);
    const before = fingerprint(t.root);
    expect(run('apply', '--vault', t.vault).status).toBe(0);
    expect(fingerprint(t.root)).toBe(before);
  });

  it("loads the sample from the plugin's own clone", () => {
    const trial = testVault();
    const r = spawnSync(process.execPath, [BUNDLE, 'apply', '--vault', trial.vault, '--sample'], {
      encoding: 'utf8',
      env,
    });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ sample: { source: 'local', skipped: [] } });
  });

  it('exits 2 on bad arguments', () => {
    expect(run('plan').status).toBe(2);
  });
});

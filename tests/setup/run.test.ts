import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runSetup, USAGE, type RunContext } from '../../src/setup/run.js';
import { cleanupAll, PLUGIN_ROOT, testVault } from './fixture.js';

afterAll(cleanupAll);
const t = testVault();
const context = (o: Partial<RunContext> = {}): RunContext => ({
  cwd: t.root,
  env: { KILN_HOME: join(t.root, 'kiln-home') },
  home: t.root,
  platform: process.platform,
  pluginRoot: PLUGIN_ROOT,
  obsidianRunning: false,
  fetch: () => Promise.reject(new Error('no network in tests')),
  now: new Date('2026-10-12T09:30:00Z'),
  ...o,
});

describe('runSetup', () => {
  it('plans a vault given relative to the current folder, or with ~', async () => {
    for (const vault of ['Trial Vault', 'Trial Vault/', '~/Trial Vault']) {
      const { output, exitCode } = await runSetup(['plan', '--vault', vault], context());
      expect(exitCode, vault).toBe(0);
      expect(JSON.parse(output)).toMatchObject({ vault: t.vault, mode: 'setup', applied: false });
    }
  });

  it('applies, taking the ids it is given', async () => {
    t.write('Home.md', 'mine\n');
    const { output } = await runSetup(['apply', '--vault', t.vault, '--take', 'Home.md'], context());
    expect(JSON.parse(output)).toMatchObject({
      applied: true,
      kiln: { config: join(t.root, 'kiln-home', 'config.json') },
    });
    expect(t.read('.kiln/backup/2026-10-12T09-30-00/Home.md')).toBe('mine\n');
  });

  it('exits 1 with the stop reasons', async () => {
    const { output, exitCode } = await runSetup(['plan', '--vault', join(t.root, 'nowhere')], context());
    expect(exitCode).toBe(1);
    expect(JSON.parse(output)).toMatchObject({ stop: [`${join(t.root, 'nowhere')} doesn't exist`] });
  });

  it('exits 2 with usage for bad arguments', async () => {
    for (const argv of [
      [],
      ['plan'],
      ['check', '--vault', 'x'],
      ['plan', '--vault', ' '],
      ['apply', '--vault', 'x', '--frobnicate'],
      ['--help'],
    ]) {
      expect(await runSetup(argv, context()), argv.join(' ')).toEqual({ output: USAGE, exitCode: 2 });
    }
  });
});

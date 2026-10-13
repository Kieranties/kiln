import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { makeVault } from '../support/vault.js';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const BUNDLE = join(REPO, 'claude-plugin', 'scripts', 'kiln-check.mjs');
const sample = makeVault();
const broken = makeVault({ broken: true });
afterAll(() => {
  for (const d of [sample, broken]) rmSync(d, { recursive: true, force: true });
});

const run = (...args: string[]) => spawnSync(process.execPath, [BUNDLE, ...args], { encoding: 'utf8' });

describe('kiln-check.mjs', () => {
  it('runs with plain node and passes the sample', () => {
    const r = run(sample);
    expect(r.stderr).toBe('');
    expect(r.stdout).toBe('Checked 16 notes: no problems.\n');
    expect(r.status).toBe(0);
  });
  it('exits 1 on errors', () => {
    expect(run(join(broken, 'Work', 'Chase renewal refunds.md')).status).toBe(1);
  });
  it('exits 2 on bad arguments', () => {
    expect(run().status).toBe(2);
  });
  it('carries the copyright and licence of each package it inlines', () => {
    const bundle = readFileSync(BUNDLE, 'utf8').replace(/\r\n/g, '\n');
    const packages = [
      ...new Set([...bundle.matchAll(/^\/\/ node_modules\/((?:@[^/]+\/)?[^/]+)\//gm)].map((m) => m[1])),
    ];
    expect(packages).toContain('yaml');
    for (const name of packages) {
      const licence = readFileSync(join(REPO, 'node_modules', name ?? '', 'LICENSE'), 'utf8').replace(/\r\n/g, '\n');
      const notice = licence
        .trim()
        .split('\n')
        .map((line) => ` * ${line}`.trimEnd())
        .join('\n');
      expect(bundle, name).toContain(notice);
    }
  });
});

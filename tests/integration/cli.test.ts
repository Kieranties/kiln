import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const CLI = join(REPO, 'dist', 'cli.js');

let root: string;
let cfgPath: string;

type Run = { code: number | null; stdout: string; stderr: string };

/** Runs `node dist/cli.js <args>` against the temp config. */
function kiln(args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}): Run {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: opts.cwd ?? root,
    env: { ...process.env, KILN_CONFIG: cfgPath, ...opts.env },
    encoding: 'utf8',
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function writeNote(base: string, rel: string, lines: string[]): void {
  const abs = join(base, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${lines.join('\n')}\n`, 'utf8');
}

beforeAll(() => {
  if (!existsSync(CLI)) throw new Error(`${CLI} is missing; the vitest globalSetup should have built it`);
  root = mkdtempSync(join(tmpdir(), 'kiln-cli-'));
  cfgPath = join(root, 'config.yaml');
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('kiln CLI', () => {
  it('init then status --line prints the orientation line with zero counts', () => {
    const base = join(root, 'northwind');
    const init = kiln(['init', base, '--name', 'northwind']);
    expect(init.code, init.stderr).toBe(0);
    expect(JSON.parse(init.stdout)).toEqual({ name: 'northwind', path: base });
    expect(loadConfig(cfgPath).bases.map((b) => b.name)).toEqual(['northwind']);

    const line = kiln(['status', '--line'], { cwd: base });
    expect(line.code, line.stderr).toBe(0);
    expect(line.stdout).toBe('kiln: base=northwind · inbox 0 · needs review 0\n');

    const json = kiln(['status', '--cwd', base]);
    expect(json.code, json.stderr).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({
      base: 'northwind',
      path: base,
      cwd: base,
      notes: 0,
      inbox: 0,
      needsReview: 0,
    });
  });

  it('validate exits 1 on a schema error and 0 on a clean base', () => {
    const clean = join(root, 'clean');
    expect(kiln(['init', clean, '--name', 'clean']).code).toBe(0);
    writeNote(clean, 'anchors/organisation/Northwind Arena.md', [
      '---',
      'type: anchor',
      'kind: organisation',
      'title: Northwind Arena',
      'role: self',
      'aliases: [NWA]',
      'summary: The 18,000-seat indoor arena on the Northwind waterfront.',
      '---',
      '',
      'Home of the Northwind Rovers.',
    ]);
    const ok = kiln(['validate', '--base', 'clean']);
    expect(ok.code, ok.stdout + ok.stderr).toBe(0);
    expect(ok.stdout.trim().split('\n').at(-1)).toMatch(/^0 findings/);

    const broken = join(root, 'broken');
    expect(kiln(['init', broken, '--name', 'broken']).code).toBe(0);
    writeNote(broken, 'notes/Gate Staffing.md', [
      '---',
      'type: not-a-real-type',
      'title: Gate Staffing',
      '---',
      '',
      'Northwind Arena gate rota.',
    ]);
    const bad = kiln(['validate', '--base', 'broken']);
    expect(bad.code, bad.stdout + bad.stderr).toBe(1);
    const lines = bad.stdout.trim().split('\n');
    expect(lines.some((l) => l.startsWith('schema\tnotes/Gate Staffing.md\t'))).toBe(true);
    expect(lines.at(-1)).toMatch(/schema 1/);
  });

  it('reindex prints stats JSON', () => {
    const base = join(root, 'stats');
    expect(kiln(['init', base, '--name', 'stats']).code).toBe(0);
    writeNote(base, 'notes/Concourse Layout.md', [
      '---',
      'type: reference',
      'title: Concourse Layout',
      '---',
      '',
      'Level 2 concourse.',
    ]);
    const r = kiln(['reindex', '--base', 'stats']);
    expect(r.code, r.stderr).toBe(0);
    const stats = JSON.parse(r.stdout);
    expect(stats).toMatchObject({ scanned: 1, rebuilt: true });
    expect(typeof stats.ms).toBe('number');
  });

  it('status --line prints nothing when no base matches', () => {
    const lone = join(root, 'lone');
    mkdirSync(lone, { recursive: true });
    const emptyCfg = join(root, 'empty-config.yaml');
    for (const args of [['status', '--line'], ['status']]) {
      const r = kiln(args, { cwd: lone, env: { KILN_CONFIG: emptyCfg } });
      expect(r.code).toBe(0);
      expect(r.stdout).toBe('');
      expect(r.stderr).toBe('');
    }
  });

  it('exits 2 and prints usage on a usage error', () => {
    for (const args of [[], ['frobnicate'], ['init'], ['init', join(root, 'x')], ['status', '--nope']]) {
      const r = kiln(args);
      expect(r.code, args.join(' ')).toBe(2);
      expect(r.stderr).toContain('Usage:');
      expect(r.stdout).toBe('');
    }
  });

  it('rejects the reserved base name "all" with a validation error', () => {
    const target = join(root, 'reserved');
    const r = kiln(['init', target, '--name', 'ALL']);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/^validation: /);
    expect(existsSync(target)).toBe(false);
  });

  it('status reports an explicit unknown base as no_base and exits 1', () => {
    const r = kiln(['status', '--line', '--base', 'no-such-base']);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/^no_base: /);
  });

  it('prints a KilnError as "<code>: <message>" and exits 1', () => {
    const r = kiln(['validate', '--base', 'no-such-base']);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/^no_base: /);
  });
});

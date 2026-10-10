import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { saveConfig } from '../../src/config.js';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const CLI = join(REPO, 'dist', 'cli.js');

const GUARD_MESSAGE =
  "kiln: notes in base 'northwind' are written through kiln tools (capture, create_note, update_note, supersede, mark_source), not directly.\n";

let root: string;
let cfgPath: string;
let base: string;
let repos: string;

type Run = { code: number | null; stdout: string; stderr: string };

/** Runs `node dist/cli.js hook <name>` against the temp config, with `stdin` as the hook's input. */
function hook(name: string, stdin: string): Run {
  const r = spawnSync(process.execPath, [CLI, 'hook', name], {
    cwd: root,
    env: { ...process.env, KILN_CONFIG: cfgPath },
    input: stdin,
    encoding: 'utf8',
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function writeInput(filePath: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    session_id: 'test',
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: 'Gate 4 opens at 17:30.' },
    ...extra,
  });
}

beforeAll(() => {
  if (!existsSync(CLI)) throw new Error(`${CLI} is missing; the vitest globalSetup should have built it`);
  root = mkdtempSync(join(tmpdir(), 'kiln-hooks-'));
  cfgPath = join(root, 'config.yaml');
  base = join(root, 'northwind');
  repos = join(root, 'repos');
  mkdirSync(join(repos, 'turnstile-firmware'), { recursive: true });
  const init = spawnSync(process.execPath, [CLI, 'init', base, '--name', 'northwind'], {
    env: { ...process.env, KILN_CONFIG: cfgPath },
    encoding: 'utf8',
  });
  if (init.status !== 0) throw new Error(`kiln init failed: ${init.stderr}`);
  // A rule rather than a default base, so a cwd outside repos/ matches nothing.
  saveConfig({ bases: [{ name: 'northwind', path: base }], rules: [{ path: `${repos}/**`, base: 'northwind' }] }, cfgPath);
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('kiln hook write-guard', () => {
  it('write-guard blocks a Write inside a configured base (exit 2, message names base)', () => {
    const r = hook('write-guard', writeInput(join(base, 'notes', 'Gate Staffing.md')));
    expect(r.code).toBe(2);
    expect(r.stderr).toBe(GUARD_MESSAGE);
    expect(r.stdout).toBe('');
  });

  it('write-guard allows a Write outside any base (exit 0)', () => {
    const r = hook('write-guard', writeInput(join(repos, 'turnstile-firmware', 'README.md')));
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.stderr).toBe('');
  });

  it('write-guard blocks a NotebookEdit by notebook_path', () => {
    const input = JSON.stringify({
      tool_name: 'NotebookEdit',
      tool_input: { notebook_path: join(base, 'notes', 'Attendance.ipynb'), new_source: 'x = 1' },
    });
    const r = hook('write-guard', input);
    expect(r.code).toBe(2);
    expect(r.stderr).toBe(GUARD_MESSAGE);
  });

  it.skipIf(process.platform !== 'win32')('write-guard matches backslash and different-case paths on win32', () => {
    const backslash = join(base, 'notes', 'Gate Staffing.md').replaceAll('/', '\\');
    const upper = join(base, 'notes', 'Gate Staffing.md').toUpperCase().replaceAll('\\', '/');
    for (const p of [backslash, upper]) {
      const r = hook('write-guard', writeInput(p));
      expect(r.code, p).toBe(2);
      expect(r.stderr).toBe(GUARD_MESSAGE);
    }
  });

  it.skipIf(process.platform !== 'win32')('write-guard blocks an MSYS-style /x/... path into a base on win32', () => {
    const msys = (p: string): string => p.replace(/^([A-Za-z]):[\\/]/, (_, d: string) => `/${d.toLowerCase()}/`).replaceAll('\\', '/');
    const r = hook('write-guard', writeInput(msys(join(base, 'notes', 'Gate Staffing.md')), { cwd: msys(repos) }));
    expect(r.code, r.stderr).toBe(2);
    expect(r.stderr).toBe(GUARD_MESSAGE);
  });

  it('write-guard resolves a relative file_path against the stdin cwd', () => {
    const inside = hook('write-guard', writeInput(join('notes', 'Gate Staffing.md'), { cwd: base }));
    expect(inside.code).toBe(2);
    expect(inside.stderr).toBe(GUARD_MESSAGE);

    const outside = hook('write-guard', writeInput(join('notes', 'Gate Staffing.md'), { cwd: repos }));
    expect(outside.code).toBe(0);
    expect(outside.stderr).toBe('');
  });

  it('write-guard exits 0 silently on malformed or empty stdin, or no path', () => {
    for (const stdin of ['', '{not json', 'null', '[]', JSON.stringify({ tool_name: 'Write' }), JSON.stringify({ tool_input: {} })]) {
      const r = hook('write-guard', stdin);
      expect(r.code, stdin).toBe(0);
      expect(r.stdout, stdin).toBe('');
      expect(r.stderr, stdin).toBe('');
    }
  });
});

describe('kiln hook usage errors', () => {
  it('an unknown or missing hook name exits 1 (non-blocking), not 2', () => {
    for (const args of [['hook', 'no-such-hook'], ['hook'], ['hook', 'write-guard', 'extra']]) {
      const r = spawnSync(process.execPath, [CLI, ...args], {
        cwd: root,
        env: { ...process.env, KILN_CONFIG: cfgPath },
        input: writeInput(join(base, 'notes', 'Gate Staffing.md')),
        encoding: 'utf8',
      });
      expect(r.status, args.join(' ')).toBe(1);
      expect(r.stdout).toBe('');
      expect(r.stderr).toMatch(/^kiln hook: /);
    }
  });
});

describe('kiln hook session-start', () => {
  it('session-start prints the orientation line for a matching cwd and nothing otherwise', () => {
    // The hook never builds the index, so build it the way a user would after kiln init.
    const reindex = spawnSync(process.execPath, [CLI, 'reindex', '--base', 'northwind'], { env: { ...process.env, KILN_CONFIG: cfgPath }, encoding: 'utf8' });
    expect(reindex.status, reindex.stderr).toBe(0);
    const cwd = join(repos, 'turnstile-firmware');
    const match = hook('session-start', JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', cwd }));
    expect(match.code, match.stderr).toBe(0);
    expect(match.stdout).toBe('kiln: base=northwind · inbox 0 · needs review 0\n');

    const elsewhere = join(root, 'elsewhere');
    mkdirSync(elsewhere, { recursive: true });
    const none = hook('session-start', JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', cwd: elsewhere }));
    expect(none.code).toBe(0);
    expect(none.stdout).toBe('');
    expect(none.stderr).toBe('');
  });

  it('session-start never builds the index: a missing or outdated index prints a reindex hint and is left alone', () => {
    const fresh = join(root, 'fresh');
    const project = join(root, 'fresh-project', 'repo');
    mkdirSync(fresh, { recursive: true });
    mkdirSync(project, { recursive: true });
    const freshCfg = join(root, 'fresh.yaml');
    saveConfig({ bases: [{ name: 'fresh', path: fresh }], rules: [{ path: `${join(root, 'fresh-project')}/**`, base: 'fresh' }] }, freshCfg);
    const start = (): Run => {
      const r = spawnSync(process.execPath, [CLI, 'hook', 'session-start'], {
        cwd: root,
        env: { ...process.env, KILN_CONFIG: freshCfg },
        input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', cwd: project }),
        encoding: 'utf8',
      });
      return { code: r.status, stdout: r.stdout, stderr: r.stderr };
    };
    const file = join(fresh, '.kiln', 'index', 'kiln.sqlite');

    const missing = start();
    expect(missing.code, missing.stderr).toBe(0);
    expect(missing.stdout).toBe('kiln: base=fresh · index not built: run kiln reindex\n');
    expect(existsSync(file)).toBe(false);

    // An index from an older schema would be rebuilt by Index.open; the hook leaves it for kiln reindex.
    mkdirSync(dirname(file), { recursive: true });
    const old = new DatabaseSync(file);
    old.exec('PRAGMA user_version = 1');
    old.close();
    const outdated = start();
    expect(outdated.code, outdated.stderr).toBe(0);
    expect(outdated.stdout).toBe('kiln: base=fresh · index not built: run kiln reindex\n');
    const after = new DatabaseSync(file, { readOnly: true });
    expect((after.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(1);
    after.close();
  });

  it('session-start exits 0 with nothing on stdout for malformed stdin', () => {
    const r = hook('session-start', '{not json');
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
  });
});

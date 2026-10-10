import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFields, splitNote } from '../../src/frontmatter.js';
import { Index } from '../../src/index/db.js';
import { sha256 } from '../../src/index/reconcile.js';
import { KilnError, type Base } from '../../src/types.js';

const NOTE = 'work/2026/Fix turnstile firmware.md';
const TITLE = 'Fix turnstile firmware';
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const WRITER = 'tests/integration/writer.ts';
const CHECKPOINT = /^- (w[ab]) #(\d+)$/;

/** What a writer prints as its last stdout line. */
type WriterReport = { writer: string; written: number; conflicts: number; busy: number; revisions: string[] };

type WriterRun = { code: number | null; stdout: string; stderr: string; report: WriterReport | null };

let base: Base;

beforeEach(() => {
  base = { name: 'concurrency', path: mkdtempSync(join(tmpdir(), 'kiln-concurrency-')) };
  const abs = join(base.path, NOTE);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(
    abs,
    [
      '---',
      'type: work',
      'kind: bug',
      `title: ${TITLE}`,
      'status: active',
      'created: 2026-09-01',
      'updated: 2026-09-20',
      'anchors: ["[[Turnstile Network]]"]',
      '---',
      '',
      '## Summary',
      'Gates 3 and 4 at the North Stand reject mobile tickets.',
      '',
      '## Checkpoints',
      '',
      '## Outcome',
      '',
    ].join('\n'),
  );
  const ix = Index.open(base);
  ix.close();
});

afterEach(() => {
  rmSync(base.path, { recursive: true, force: true });
});

/**
 * Spawn one writer child (no shell) from the repo root. It prints `ready`, waits for `go` on stdin, then appends
 * `count` checkpoints. `started` resolves on `ready`; `done` resolves when the child exits.
 */
function startWriter(name: string, count: number): { started: Promise<void>; go: () => void; done: Promise<WriterRun> } {
  const child = spawn(process.execPath, ['--import', 'tsx', WRITER, base.path, NOTE, name, String(count)], {
    cwd: REPO_ROOT,
    env: { ...process.env, KILN_WRITER_GATE: 'stdin' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  // A child that dies before reading `go` closes its stdin; the exit code and stderr report that, not EPIPE.
  child.stdin.on('error', () => {});
  let stdout = '';
  let stderr = '';
  let onReady: () => void = () => {};
  const started = new Promise<void>((resolve) => (onReady = resolve));
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    stdout += chunk;
    if (stdout.split(/\r?\n/).includes('ready')) onReady();
  });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
  const done = new Promise<WriterRun>((resolve) => {
    child.on('close', (code) => {
      onReady();
      const last = stdout.trim().split(/\r?\n/).pop() ?? '';
      let report: WriterReport | null = null;
      try {
        report = JSON.parse(last) as WriterReport;
      } catch {
        report = null;
      }
      resolve({ code, stdout, stderr, report });
    });
  });
  return { started, go: () => child.stdin.end('go\n'), done };
}

/** Run two writers that start appending at the same moment; `during` runs until both have exited. */
async function runWriters(count: number, during?: () => void): Promise<WriterRun[]> {
  const writers = [startWriter('wa', count), startWriter('wb', count)];
  await Promise.all(writers.map((w) => w.started));
  for (const w of writers) w.go();
  let finished = false;
  const all = Promise.all(writers.map((w) => w.done)).finally(() => (finished = true));
  if (during) {
    while (!finished) {
      during();
      await new Promise((r) => setImmediate(r));
    }
  }
  return all;
}

function expectSucceeded(runs: WriterRun[], count: number): WriterReport[] {
  return runs.map((r) => {
    expect(r.code, `writer failed:\n${r.stderr}\n${r.stdout}`).toBe(0);
    expect(r.report, `no report in stdout:\n${r.stdout}`).not.toBeNull();
    expect(r.report!.written).toBe(count);
    return r.report!;
  });
}

/** The checkpoint lines in a note body, in file order. */
function checkpoints(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const start = lines.indexOf('## Checkpoints');
  const end = lines.indexOf('## Outcome');
  return lines.slice(start + 1, end).filter((l) => l.trim() !== '');
}

function isBusy(e: unknown): boolean {
  if (e instanceof KilnError) return e.code === 'busy';
  const code = (e as { errcode?: unknown }).errcode;
  return typeof code === 'number' && ((code & 0xff) === 5 || (code & 0xff) === 6);
}

function tempFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.kiln-tmp'));
}

describe('cross-process concurrency', () => {
  it('two processes appending checkpoints to the same note both land, file stays valid YAML, index matches file hash', async () => {
    const runs = await runWriters(50);
    const reports = expectSucceeded(runs, 50);

    const text = readFileSync(join(base.path, NOTE), 'utf8');
    const split = splitNote(text);
    const fields = parseFields(split.fmText);
    expect(fields.title).toBe(TITLE);
    expect(fields.type).toBe('work');

    const lines = checkpoints(split.body);
    expect(lines).toHaveLength(100);
    expect(lines.every((l) => CHECKPOINT.test(l))).toBe(true);
    expect(new Set(lines).size).toBe(100);
    for (const w of ['wa', 'wb']) {
      const mine = lines.filter((l) => l.startsWith(`- ${w} #`)).map((l) => Number(CHECKPOINT.exec(l)![2]));
      // Each writer's appends land once each, in the order it made them.
      expect(mine).toEqual(Array.from({ length: 50 }, (_, n) => n + 1));
    }

    // Stale writes are rejected. Both writers read the note before the gate opens, so whichever writes second
    // starts from a revision that is already stale: at least one stale_revision conflict is certain, not timing luck.
    expect(reports.reduce((n, r) => n + r.conflicts, 0)).toBeGreaterThan(0);

    // A fresh index sees nothing to change: the indexed hash matches the bytes on disk.
    const fresh = Index.open(base);
    try {
      expect(fresh.reconcile().changed).toBe(0);
      expect(fresh.get(NOTE).revision).toBe(sha256(readFileSync(join(base.path, NOTE))));
    } finally {
      fresh.close();
    }

    expect(tempFiles(base.path)).toEqual([]);
  }, 60_000);

  it('index readers see consistent results during writes', async () => {
    const initial = sha256(readFileSync(join(base.path, NOTE)));
    const ix = Index.open(base);
    const seen = new Set<string>();
    let reads = 0;
    let busy = 0;
    const failures: string[] = [];
    let lastCount = 0;

    try {
      const runs = await runWriters(30, () => {
        try {
          const rec = ix.get(NOTE);
          reads++;
          seen.add(rec.revision);
          if (rec.fields.title !== TITLE || rec.fields.type !== 'work') failures.push(`get: frontmatter did not parse at ${rec.revision}`);
          const lines = checkpoints(rec.body);
          if (!lines.every((l) => CHECKPOINT.test(l))) failures.push(`get: torn checkpoint lines at ${rec.revision}`);
          if (lines.length < lastCount) failures.push(`get: went backwards from ${lastCount} to ${lines.length} checkpoints`);
          lastCount = lines.length;

          const hits = ix.search({ q: 'turnstile firmware' });
          if (!hits.some((h) => h.path === NOTE)) failures.push('search: note missing');
          const refs = ix.query({ type: 'work' });
          if (refs.length !== 1 || refs[0]!.path !== NOTE) failures.push(`query: expected the one note, got ${refs.length}`);
        } catch (e) {
          if (isBusy(e)) busy++;
          else failures.push(`threw: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
        }
      });
      const reports = expectSucceeded(runs, 30);

      expect(failures.slice(0, 10)).toEqual([]);
      expect(reads).toBeGreaterThan(0);
      // Every revision get() reported is the hash of a complete version of the file: the original or one a writer
      // wrote. A torn or half-renamed read would hash to something else.
      const written = new Set([initial, ...reports.flatMap((r) => r.revisions)]);
      expect([...seen].filter((r) => !written.has(r))).toEqual([]);
    } finally {
      ix.close();
    }
  }, 60_000);
});

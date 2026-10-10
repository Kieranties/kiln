#!/usr/bin/env node
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { baseContaining, loadConfig, resolveBase } from './config.js';
import type { IndexStatus } from './index/read.js';
import { KilnError, type Base } from './types.js';

// Index-backed modules are imported lazily: loading node:sqlite prints an ExperimentalWarning to stderr, which the
// no-base paths (`init` aside), `--line` and the write guard should not emit.

const USAGE = `Usage:
  kiln mcp                                     Start the MCP stdio server
  kiln init <path> --name <base>               Create a base and register it
  kiln validate [--base <name>]                Print findings; exit 1 on schema errors
  kiln reindex [--base <name>]                 Rebuild the index and print its stats
  kiln status [--line] [--cwd <dir>] [--base <name>]
                                               Print the base's inbox and review counts
  kiln hook write-guard|session-start          Run a Claude Code hook; reads the hook JSON on stdin
`;

/** A bad command line: reported with usage, exit code 2. */
class UsageError extends Error {}

type Parsed = { values: Record<string, string | boolean | undefined>; positionals: string[] };

function parse(args: string[], options: Record<string, { type: 'string' | 'boolean' }>, positionals: number): Parsed {
  let parsed: Parsed;
  try {
    parsed = parseArgs({ args, options, allowPositionals: true, strict: true }) as Parsed;
  } catch (e) {
    throw new UsageError((e as Error).message);
  }
  if (parsed.positionals.length !== positionals) {
    throw new UsageError(
      positionals === 0
        ? `Unexpected argument "${parsed.positionals[0]}"`
        : `Expected ${positionals} argument${positionals === 1 ? '' : 's'}, got ${parsed.positionals.length}`,
    );
  }
  return parsed;
}

const str = (v: string | boolean | undefined): string | undefined => (typeof v === 'string' ? v : undefined);

async function withIndex<T>(base: Base, fn: (index: import('./index/db.js').Index) => T): Promise<T> {
  const { Index } = await import('./index/db.js');
  const index = Index.open(base);
  try {
    return await fn(index);
  } finally {
    index.close();
  }
}

function print(text: string): void {
  process.stdout.write(`${text}\n`);
}

async function cmdMcp(args: string[]): Promise<void> {
  parse(args, {}, 0);
  const { startMcpServer } = await import('./mcp/server.js');
  await startMcpServer({ cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd() });
}

async function cmdInit(args: string[]): Promise<void> {
  const { positionals, values } = parse(args, { name: { type: 'string' } }, 1);
  const name = str(values.name);
  if (name === undefined) throw new UsageError('Missing required option --name');
  const { initBase } = await import('./init.js');
  const base = initBase(positionals[0]!, name);
  print(JSON.stringify({ name: base.name, path: base.path }));
}

async function cmdValidate(args: string[]): Promise<void> {
  const { values } = parse(args, { base: { type: 'string' } }, 0);
  const base = resolveBase(loadConfig(), { explicit: str(values.base), cwd: process.cwd() });
  const { validateBase } = await import('./validate.js');
  const findings = await withIndex(base, (index) => {
    index.reconcile();
    return validateBase(index);
  });
  const counts = new Map<string, number>();
  for (const f of findings) {
    print(`${f.kind}\t${f.path}\t${f.message.replace(/\s*[\r\n]+\s*/g, ' ')}`);
    counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  }
  const perKind = [...counts].map(([kind, n]) => `${kind} ${n}`).join(', ');
  print(`${findings.length} findings${perKind === '' ? '' : `: ${perKind}`}`);
  if (counts.has('schema')) process.exitCode = 1;
}

async function cmdReindex(args: string[]): Promise<void> {
  const { values } = parse(args, { base: { type: 'string' } }, 0);
  const base = resolveBase(loadConfig(), { explicit: str(values.base), cwd: process.cwd() });
  const stats = await withIndex(base, (index) => index.reconcile({ force: true }));
  print(JSON.stringify(stats));
}

type BaseStatus = { base: Base; cwd: string; status: IndexStatus };

/** The status of the explicit base, or the one matched from `cwd`; null when nothing matches and none was named. */
async function baseStatus(cwd: string, explicit?: string): Promise<BaseStatus | null> {
  let base: Base;
  try {
    base = resolveBase(loadConfig(), { explicit, cwd });
  } catch (e) {
    // Nothing to orient on: stay silent. An explicit base that does not exist is a real error.
    if (e instanceof KilnError && e.code === 'no_base' && explicit === undefined) return null;
    throw e;
  }
  const status = await withIndex(base, (index) => {
    index.ensureFresh();
    return index.status();
  });
  return { base, cwd, status };
}

function orientationLine({ status }: BaseStatus): string {
  return `kiln: base=${status.base} · inbox ${status.inbox} · needs review ${status.needsReview}`;
}

async function cmdStatus(args: string[]): Promise<void> {
  const { values } = parse(args, { line: { type: 'boolean' }, cwd: { type: 'string' }, base: { type: 'string' } }, 0);
  const found = await baseStatus(str(values.cwd) ?? process.cwd(), str(values.base));
  if (!found) return;
  if (values.line === true) {
    print(orientationLine(found));
  } else {
    const { base, cwd, status } = found;
    print(
      JSON.stringify({
        base: status.base,
        path: base.path,
        cwd,
        notes: status.notes,
        inbox: status.inbox,
        needsReview: status.needsReview,
      }),
    );
  }
}

/** The hook's JSON input as an object, or null when stdin is empty, malformed or not an object. */
async function hookInput(): Promise<Record<string, unknown> | null> {
  if (process.stdin.isTTY) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/**
 * PreToolUse guard: exit 2 (block, message to stderr) when the tool would write a file inside a configured base.
 * Anything it cannot read as a file write passes silently, so unrelated tool calls are never broken.
 */
async function hookWriteGuard(): Promise<void> {
  const input = await hookInput();
  const toolInput = input?.tool_input;
  if (toolInput === null || typeof toolInput !== 'object') return;
  const { file_path, notebook_path } = toolInput as Record<string, unknown>;
  const target = text(file_path) ?? text(notebook_path);
  if (target === undefined) return;
  const base = baseContaining(loadConfig(), resolve(text(input!.cwd) ?? process.cwd(), target));
  if (!base) return;
  process.stderr.write(
    `kiln: notes in base '${base.name}' are written through kiln tools (capture, create_note, update_note, supersede, mark_source), not directly.\n`,
  );
  process.exitCode = 2;
}

/** SessionStart orientation: the `status --line` text for the session's cwd, or nothing. Never fails the session. */
async function hookSessionStart(): Promise<void> {
  try {
    const input = await hookInput();
    const found = await baseStatus(text(input?.cwd) ?? process.cwd());
    if (found) print(orientationLine(found));
  } catch (e) {
    process.stderr.write(`kiln hook session-start: ${e instanceof Error ? e.message : String(e)}\n`);
  }
}

const HOOKS: Record<string, () => Promise<void>> = {
  'write-guard': hookWriteGuard,
  'session-start': hookSessionStart,
};

async function cmdHook(args: string[]): Promise<void> {
  const { positionals } = parse(args, {}, 1);
  const name = positionals[0]!;
  const run = Object.hasOwn(HOOKS, name) ? HOOKS[name] : undefined;
  if (!run) throw new UsageError(`Unknown hook "${name}"`);
  await run();
}

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  mcp: cmdMcp,
  init: cmdInit,
  validate: cmdValidate,
  reindex: cmdReindex,
  status: cmdStatus,
  hook: cmdHook,
};

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  const run = command !== undefined && Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined;
  if (!run) {
    throw new UsageError(command === undefined ? 'Missing command' : `Unknown command "${command}"`);
  }
  await run(rest);
}

try {
  await main(process.argv.slice(2));
} catch (e) {
  if (e instanceof UsageError) {
    process.stderr.write(`${e.message}\n${USAGE}`);
    process.exitCode = 2;
  } else if (e instanceof KilnError) {
    process.stderr.write(`${e.code}: ${e.message}\n`);
    process.exitCode = 1;
  } else {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  }
}

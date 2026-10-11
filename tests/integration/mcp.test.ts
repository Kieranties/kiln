import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, saveConfig } from '../../src/config.js';
import { initBase } from '../../src/init.js';
import type { Base } from '../../src/types.js';

const CLI = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));

const TOOLS = [
  'brief',
  'capture',
  'create_note',
  'get',
  'inbox',
  'mark_source',
  'query',
  'resolve',
  'search',
  'status',
  'supersede',
  'update_note',
  'validate',
];

type ToolResult = { isError?: boolean; content: { type: string; text: string }[] };

let root: string;
let cfgPath: string;
let northwind: Base;
let ops: Base;
const clients: Client[] = [];

function writeNote(base: Base, rel: string, lines: string[]): void {
  const abs = join(base.path, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${lines.join('\n')}\n`, 'utf8');
}

/** A client over stdio to `node dist/cli.js mcp`, with its stderr collected so test output stays clean. */
async function connect(projectDir: string): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [CLI, 'mcp'],
    cwd: root,
    env: { KILN_CONFIG: cfgPath, CLAUDE_PROJECT_DIR: projectDir },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', () => {});
  const client = new Client({ name: 'kiln-test', version: '0.0.0' });
  await client.connect(transport);
  clients.push(client);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

/** The parsed JSON result of a successful tool call. */
async function ok<T = any>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const r = await call(client, name, args);
  expect(r.isError, r.content[0]?.text).toBeFalsy();
  return JSON.parse(r.content[0]!.text) as T;
}

/** The error text of a failed tool call. */
async function fail(client: Client, name: string, args: Record<string, unknown> = {}): Promise<string> {
  const r = await call(client, name, args);
  expect(r.isError, r.content[0]?.text).toBe(true);
  return r.content[0]!.text;
}

let client: Client;

beforeAll(async () => {
  if (!existsSync(CLI)) throw new Error(`${CLI} is missing; run "npm run build" first`);
  root = mkdtempSync(join(tmpdir(), 'kiln-mcp-'));
  cfgPath = join(root, 'config.yaml');
  // `ops` is registered first, so it is the default_base; a rule routes the northwind folder to `northwind`.
  ops = initBase(join(root, 'ops'), 'ops', cfgPath);
  northwind = initBase(join(root, 'northwind'), 'northwind', cfgPath);
  const cfg = loadConfig(cfgPath);
  cfg.rules = [{ path: `${northwind.path}/**`, base: 'northwind' }];
  saveConfig(cfg, cfgPath);

  writeNote(northwind, 'anchors/organisation/Northwind Arena.md', [
    '---',
    'type: anchor',
    'kind: organisation',
    'title: Northwind Arena',
    'role: self',
    'aliases: [NWA]',
    'summary: The 18,000-seat indoor arena on the Northwind waterfront.',
    '---',
    '',
    '## Summary',
    'Hosts ice hockey, concerts and conferences.',
  ]);
  writeNote(northwind, 'anchors/service/Turnstile Network.md', [
    '---',
    'type: anchor',
    'kind: service',
    'title: Turnstile Network',
    'summary: The ticket-scanning turnstiles at every arena entrance.',
    'anchors: ["[[Northwind Arena]]"]',
    '---',
    '',
    '## Summary',
    'Forty turnstiles across the North and South Stands, running vendor firmware.',
  ]);
  writeNote(northwind, 'references/Turnstile vendor runbook.md', [
    '---',
    'type: reference',
    'kind: doc',
    'title: Turnstile vendor runbook',
    'anchors: ["[[Turnstile Network]]"]',
    '---',
    '',
    'Reboot a stuck turnstile by holding the service key for ten seconds.',
  ]);
  writeNote(ops, 'notes/Turnstile maintenance rota.md', [
    '---',
    'type: note',
    'title: Turnstile maintenance rota',
    'summary: Who services the turnstiles each matchday.',
    '---',
    '',
    'The facilities team checks every turnstile before doors open.',
  ]);
  for (let i = 1; i <= 205; i++) {
    const n = String(i).padStart(3, '0');
    writeNote(ops, `notes/Shift log ${n}.md`, [
      '---',
      'type: note',
      `title: Shift log ${n}`,
      '---',
      '',
      `Concourse shift ${n} was quiet.`,
    ]);
  }

  client = await connect(join(northwind.path, 'projects'));
}, 60_000);

afterAll(async () => {
  await Promise.all(clients.map((c) => c.close()));
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('kiln mcp', () => {
  it('lists all 13 tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS);
    for (const t of tools) {
      expect(t.description, t.name).toBeTruthy();
      expect(Object.keys(t.inputSchema.properties ?? {}), t.name).toContain('base');
    }
  });

  it('status reports the base resolved from cwd', async () => {
    const s = await ok(client, 'status');
    expect(s).toMatchObject({
      base: 'northwind',
      path: northwind.path,
      cwd: join(northwind.path, 'projects'),
      notes: 3,
      inbox: 0,
      needsReview: 0,
    });
    const explicit = await ok(client, 'status', { base: 'ops' });
    expect(explicit).toMatchObject({ base: 'ops', path: ops.path, notes: 206 });
  });

  it('search returns hits with snippets', async () => {
    const hits = await ok<any[]>(client, 'search', { q: 'turnstile firmware' });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.map((h) => h.title)).toContain('Turnstile Network');
    for (const h of hits) expect(h.snippet, h.path).not.toBe('');
    const runbook = hits.find((h) => h.title === 'Turnstile vendor runbook');
    expect(runbook?.snippet).toBe('Reboot a stuck turnstile by holding the service key for ten seconds.');
  });

  it('search with base "all" merges hits from every base by score, tagged with their base', async () => {
    const hits = await ok<any[]>(client, 'search', { q: 'turnstile', base: 'all', auto_scope: false });
    expect(new Set(hits.map((h) => h.base))).toEqual(new Set(['northwind', 'ops']));
    expect(hits.find((h) => h.title === 'Turnstile maintenance rota')?.base).toBe('ops');
    expect(hits.find((h) => h.title === 'Turnstile Network')?.base).toBe('northwind');
    const scores = hits.map((h) => h.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));

    const limited = await ok<any[]>(client, 'search', { q: 'turnstile', base: 'all', auto_scope: false, limit: 2 });
    expect(limited).toEqual(hits.slice(0, 2));

    expect(await fail(client, 'get', { id_or_path: 'notes/Turnstile maintenance rota.md', base: 'all' })).toMatch(
      /^validation: /,
    );
  });

  it('clamps limits to 200 and rejects a limit that is not a positive integer', async () => {
    expect(await ok<any[]>(client, 'query', { type: 'note', base: 'ops', limit: 500 })).toHaveLength(200);
    expect(await ok<any[]>(client, 'query', { type: 'note', base: 'ops', limit: 3 })).toHaveLength(3);
    for (const limit of [0, -1, 1.5]) {
      expect(await fail(client, 'query', { type: 'note', base: 'ops', limit })).toMatch(/validation/i);
      expect(await fail(client, 'inbox', { limit })).toMatch(/validation/i);
      expect(await fail(client, 'search', { q: 'turnstile', limit })).toMatch(/validation/i);
    }
  });

  it('validate filters by kinds and caps findings at limit (default 100, max 1000), reporting total and truncated', async () => {
    // ops: 205 shift logs missing summary and aliases, and a rota missing aliases.
    const all = await ok(client, 'validate', { base: 'ops' });
    expect(all).toMatchObject({ total: 206, truncated: true });
    expect(all.findings).toHaveLength(100);
    expect(all.findings[0]).toMatchObject({ kind: 'missing_enrichment', path: 'notes/Shift log 001.md' });

    const five = await ok(client, 'validate', { base: 'ops', kinds: ['missing_enrichment'], limit: 5 });
    expect(five).toMatchObject({ total: 206, truncated: true });
    expect(five.findings).toEqual(all.findings.slice(0, 5));

    const clamped = await ok(client, 'validate', { base: 'ops', limit: 5000 });
    expect(clamped).toMatchObject({ total: 206, truncated: false });
    expect(clamped.findings).toHaveLength(206);

    expect(await ok(client, 'validate', { base: 'ops', kinds: ['possible_duplicate', 'schema'] })).toEqual({
      total: 0,
      truncated: false,
      findings: [],
    });
    expect(await fail(client, 'validate', { base: 'ops', kinds: ['typo'] })).toMatch(/validation/i);
    expect(await fail(client, 'validate', { base: 'ops', limit: 0 })).toMatch(/validation/i);
  });

  it('capture → inbox → create_note → mark_source flow works end to end', async () => {
    const captured = await ok(client, 'capture', {
      kind: 'jira',
      title: 'NWA-142 Turnstiles reject mobile tickets at North Stand',
      content: 'Gates 3 and 4 reject mobile tickets since the firmware update on Saturday.\n',
      source_id: 'NWA-142',
      url: 'https://jira.northwind-arena.test/browse/NWA-142',
      why: 'Matchday entry is slowed',
    });
    expect(captured).toMatchObject({ created: true });
    expect(captured.path).toMatch(/^sources\/jira\//);

    const pending = await ok<any[]>(client, 'inbox');
    expect(pending.map((n) => n.path)).toEqual([captured.path]);

    const work = await ok(client, 'create_note', {
      type: 'work',
      kind: 'bug',
      fields: {
        title: 'Fix North Stand turnstile firmware',
        status: 'active',
        summary: 'Gates 3 and 4 reject mobile tickets after the Saturday firmware update.',
        aliases: ['NWA-142'],
        sources: ['[[NWA-142 Turnstiles reject mobile tickets at North Stand]]'],
        confidence: 'verbatim',
        anchors: ['[[Turnstile Network]]'],
      },
      sections: [{ heading: 'Summary', text: 'Roll back or patch the firmware on gates 3 and 4.' }],
    });
    expect(work).toMatchObject({ created: true });
    expect(work.path).toMatch(/^work\/\d{4}\//);

    const source = await ok(client, 'get', { id_or_path: captured.id });
    expect(source.revision).toBe(captured.revision);
    const marked = await ok(client, 'mark_source', {
      id_or_path: captured.id,
      if_revision: source.revision,
      triage: 'linked',
      outcome: 'new-work-item',
      linked_to: ['[[Fix North Stand turnstile firmware]]'],
    });
    expect(marked).toMatchObject({ id: captured.id, path: captured.path, created: false });

    expect(await ok<any[]>(client, 'inbox')).toEqual([]);
    const after = await ok(client, 'get', { id_or_path: captured.path });
    expect(after.fields).toMatchObject({
      triage: 'linked',
      triage_outcome: 'new-work-item',
      linked_to: ['[[Fix North Stand turnstile firmware]]'],
    });
    const brief = await ok(client, 'brief', { id_or_path: 'anchors/service/Turnstile Network.md' });
    expect(brief.openWork.map((n: any) => n.title)).toContain('Fix North Stand turnstile firmware');
  });

  it('update_note conflict is surfaced as a tool error with code conflict', async () => {
    const note = await ok(client, 'get', { id_or_path: 'references/Turnstile vendor runbook.md' });
    const text = await fail(client, 'update_note', {
      id_or_path: note.path,
      if_revision: '0'.repeat(64),
      set: { summary: 'How to reboot a stuck turnstile.' },
    });
    const [head, details] = text.split('\n');
    expect(head).toMatch(/^conflict: /);
    expect(JSON.parse(details!)).toEqual({ reason: 'stale_revision', current: note.revision });

    const updated = await ok(client, 'update_note', {
      id_or_path: note.path,
      if_revision: note.revision,
      set: { summary: 'How to reboot a stuck turnstile.' },
      sections: [{ heading: 'Escalation', mode: 'append', text: 'Call the vendor hotline if a reboot does not help.' }],
    });
    expect(updated.revision).not.toBe(note.revision);
  });

  it('surfaces no_base as a tool error when no base matches, without failing to start', async () => {
    const cfg = loadConfig(cfgPath);
    const elsewhere = join(root, 'elsewhere');
    mkdirSync(elsewhere, { recursive: true });
    delete cfg.default_base;
    saveConfig(cfg, cfgPath);
    try {
      const lost = await connect(elsewhere);
      expect((await lost.listTools()).tools).toHaveLength(13);
      expect(await fail(lost, 'status')).toMatch(/^no_base: /);
      expect(await fail(lost, 'search', { q: 'turnstile' })).toMatch(/^no_base: /);
      expect(await ok(lost, 'status', { base: 'ops' })).toMatchObject({ base: 'ops' });
      expect(await fail(lost, 'status', { base: 'nowhere' })).toMatch(/^no_base: Unknown base "nowhere"/);
    } finally {
      cfg.default_base = 'ops';
      saveConfig(cfg, cfgPath);
    }
  });
});

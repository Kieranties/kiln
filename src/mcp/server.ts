import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { loadConfig, normalise, resolveBase } from '../config.js';
import { Index } from '../index/db.js';
import type { SearchHit } from '../index/read.js';
import { KINDS, TRIAGE, TRIAGE_OUTCOMES } from '../schema.js';
import { Store } from '../store.js';
import { KilnError, type Base, type NoteType } from '../types.js';
import { validateBase } from '../validate.js';

/** Highest `limit` any tool honours; larger values are clamped. */
const MAX_LIMIT = 200;
/** The `base` value that makes `search` cover every configured base. */
const ALL = 'all';

const INSTRUCTIONS = [
  "kiln holds the user's knowledge vault: markdown notes about their organisations, products, people, projects, work and decisions.",
  'Read and write the vault only through these kiln tools; never edit its files directly.',
  'To answer a question: resolve the names in it, then brief the anchors found, then search (with 2-4 rephrasings), then get the top hits, and cite [[links]] to the notes used.',
].join(' ');

const NOTE_TYPES = Object.keys(KINDS) as [NoteType, ...NoteType[]];
const KNOWLEDGE_TYPES = NOTE_TYPES.filter((t) => t !== 'source') as [NoteType, ...NoteType[]];

const base = z.string().optional().describe('Base name; defaults to the base matched from the working folder');
const limit = z.number().int().min(1).optional().describe(`Maximum results (1-${MAX_LIMIT}; larger values are clamped)`);
const idOrPath = z.string().describe('Note id, or base-relative path such as "work/2026/Fix turnstile firmware.md"');
const ifRevision = z.string().describe('The revision from your last get of this note');
const fields = z.record(z.string(), z.unknown());
const newSections = z.array(z.object({ heading: z.string(), text: z.string() }));
const wikilinks = z.array(z.string());

type Opened = { base: Base; index: Index; store: Store };

/** Indexes and stores per base name, opened on first use. Config is re-read per call so a new `kiln init` is seen. */
class Bases {
  readonly cwd: string;
  readonly #open = new Map<string, Opened>();

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  /** The named base, or the one matched from the working folder. `all` is refused: only `search` spans bases. */
  one(explicit: string | undefined): Opened {
    if (explicit === ALL) throw new KilnError('validation', 'base "all" is only supported by search; name a single base');
    return this.#opened(resolveBase(loadConfig(), { explicit, cwd: this.cwd }));
  }

  every(): Opened[] {
    const { bases } = loadConfig();
    if (bases.length === 0) throw new KilnError('no_base', 'No bases are configured; run "kiln init <path> --name <base>"');
    return bases.map((b) => this.#opened(b));
  }

  closeAll(): void {
    for (const o of this.#open.values()) o.index.close();
    this.#open.clear();
  }

  #opened(b: Base): Opened {
    const cached = this.#open.get(b.name);
    if (cached && normalise(cached.base.path) === normalise(b.path)) return cached;
    cached?.index.close();
    const index = Index.open(b);
    const opened = { base: b, index, store: new Store(b, index) };
    this.#open.set(b.name, opened);
    return opened;
  }
}

function clamp(n: number | undefined): number | undefined {
  return n === undefined ? undefined : Math.min(n, MAX_LIMIT);
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toolError(e: unknown): CallToolResult {
  let text: string;
  if (e instanceof KilnError) {
    text = `${e.code}: ${e.message}` + (e.details !== undefined ? `\n${stringify(e.details)}` : '');
  } else {
    process.stderr.write(`kiln mcp: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
    text = `internal: ${e instanceof Error ? e.message : String(e)}`;
  }
  return { isError: true, content: [{ type: 'text', text }] };
}

/** Run a tool body, returning its result as JSON text, or any error as a tool error (never a crash). */
function run(fn: () => unknown): CallToolResult {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(fn()) }] };
  } catch (e) {
    return toolError(e);
  }
}

function version(): string {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
  return pkg.version;
}

/** Every base's hits for `p`, merged by score (highest first), cut to the limit and tagged with their base. */
function searchAll(bases: Bases, p: Parameters<Index['search']>[0]): (SearchHit & { base: string })[] {
  const hits = bases.every().flatMap((o) => {
    o.index.ensureFresh();
    return o.index.search(p).map((h) => ({ ...h, base: o.base.name }));
  });
  return hits.sort((a, b) => b.score - a.score).slice(0, p.limit ?? 20);
}

function register(server: McpServer, bases: Bases): void {
  /** The base for a read tool, with its index brought up to date. */
  const reading = (b: string | undefined): Opened => {
    const o = bases.one(b);
    o.index.ensureFresh();
    return o;
  };

  server.registerTool(
    'resolve',
    {
      description:
        'Look up a name or alias (organisation, product, service, person, topic or project). Returns matching notes, anchors and projects first, plus a brief of the best match. The first step for most questions.',
      inputSchema: { name: z.string().describe('A name, alias or [[link]]'), base },
    },
    (a) => run(() => reading(a.base).index.resolve(a.name)),
  );

  server.registerTool(
    'query',
    {
      description:
        'List notes by structured filters, newest updated first. anchors matches notes linking any of the named anchors; project matches the project field; review=true lists notes flagged review: needed; triage filters sources.',
      inputSchema: {
        type: z.enum(NOTE_TYPES).optional(),
        kind: z.string().optional(),
        status: z.string().optional(),
        anchors: z.array(z.string()).optional().describe('Anchor names or [[links]]'),
        project: z.string().optional(),
        review: z.boolean().optional(),
        triage: z.enum(TRIAGE as [string, ...string[]]).optional(),
        updated_after: z.string().optional().describe('YYYY-MM-DD; notes updated after this date'),
        limit,
        base,
      },
    },
    (a) =>
      run(() =>
        reading(a.base).index.query({
          type: a.type,
          kind: a.kind,
          status: a.status,
          anchors: a.anchors,
          project: a.project,
          review: a.review,
          triage: a.triage,
          updatedAfter: a.updated_after,
          limit: clamp(a.limit),
        }),
      ),
  );

  server.registerTool(
    'search',
    {
      description:
        'Full-text search weighted title > aliases > summary > keywords > body, boosting anchors and active decisions. Pass 2-4 rephrasings in variants. Notes in or linking scope_anchors rank first; auto_scope (default true) scopes to anchors named in q. base "all" searches every base and tags each hit with its base.',
      inputSchema: {
        q: z.string(),
        variants: z.array(z.string()).optional().describe('Rephrasings of q, OR-ed with it'),
        scope_anchors: z.array(z.string()).optional().describe('Anchor names or [[links]] to search within first'),
        auto_scope: z.boolean().optional(),
        limit,
        base: z.string().optional().describe('Base name, or "all" for every base; defaults to the base matched from the working folder'),
      },
    },
    (a) =>
      run(() => {
        const p = { q: a.q, variants: a.variants, scopeAnchors: a.scope_anchors, autoScope: a.auto_scope, limit: clamp(a.limit) };
        return a.base === ALL ? searchAll(bases, p) : reading(a.base).index.search(p);
      }),
  );

  server.registerTool(
    'brief',
    {
      description:
        'Capped overview of an anchor or project: its summary, current truth (its Summary section), active decisions, open work and recently updated notes linking to it.',
      inputSchema: { id_or_path: idOrPath, base },
    },
    (a) => run(() => reading(a.base).index.brief(a.id_or_path)),
  );

  server.registerTool(
    'get',
    {
      description: 'Read a full note: fields, body and revision. Pass the revision as if_revision when you then update it.',
      inputSchema: { id_or_path: idOrPath, base },
    },
    (a) => run(() => reading(a.base).index.get(a.id_or_path)),
  );

  server.registerTool(
    'inbox',
    {
      description: 'Captured sources waiting for triage, oldest first.',
      inputSchema: { limit, base },
    },
    (a) => run(() => reading(a.base).index.inbox(clamp(a.limit))),
  );

  server.registerTool(
    'status',
    {
      description: 'The base this session uses (matched from the working folder unless base is given), with its note, inbox and needs-review counts.',
      inputSchema: { base },
    },
    (a) =>
      run(() => {
        const o = reading(a.base);
        const s = o.index.status();
        return { base: o.base.name, path: o.base.path, cwd: bases.cwd, notes: s.notes, inbox: s.inbox, needsReview: s.needsReview };
      }),
  );

  server.registerTool(
    'capture',
    {
      description: `Capture text or an external item into the inbox as a source note. kind is one of: ${KINDS.source.join(', ')}. With source_id, capturing the same kind and source_id again refreshes that source instead of duplicating it; when the content changed, the refreshed source returns to the inbox.`,
      inputSchema: {
        kind: z.string(),
        title: z.string(),
        content: z.string().describe('The captured text, as markdown'),
        url: z.string().optional(),
        source_id: z.string().optional().describe('The item key in its system, e.g. a Jira key'),
        why: z.string().optional().describe('Why this is worth keeping'),
        base,
      },
    },
    (a) =>
      run(() =>
        bases.one(a.base).store.capture({ kind: a.kind, title: a.title, content: a.content, url: a.url, sourceId: a.source_id, why: a.why }),
      ),
  );

  server.registerTool(
    'create_note',
    {
      description:
        'Create a knowledge note in its conventional folder. fields must include title, summary (1-2 plain sentences), aliases (at least one), sources (at least one) and confidence (verbatim or inferred); decisions also need decided_on. When you are not sure of it, set review: needed with a review_reason. A conflict means a similar note exists: update that note instead, or retry with new_reason.',
      inputSchema: {
        type: z.enum(KNOWLEDGE_TYPES),
        kind: z.string().optional(),
        fields: fields.describe('Frontmatter fields; a link is "[[<file stem>|<title>]]", where the stem is the path basename of the linked note, without .md'),
        sections: newSections.optional().describe('Body sections, in order'),
        new_reason: z.string().optional().describe('Why this is not a duplicate of the conflicting note'),
        base,
      },
    },
    (a) =>
      run(() =>
        bases.one(a.base).store.createNote({ type: a.type, kind: a.kind, fields: a.fields, sections: a.sections ?? [], newReason: a.new_reason }),
      ),
  );

  server.registerTool(
    'update_note',
    {
      description:
        'Change fields (set, unset) and/or append to or replace named sections of a note. Guarded by if_revision: a conflict means the note changed since you read it, so re-read it with get and retry. id and created cannot be changed.',
      inputSchema: {
        id_or_path: idOrPath,
        if_revision: ifRevision,
        set: fields.optional(),
        unset: z.array(z.string()).optional(),
        sections: z.array(z.object({ heading: z.string(), mode: z.enum(['append', 'replace']), text: z.string() })).optional(),
        base,
      },
    },
    (a) =>
      run(() =>
        bases.one(a.base).store.updateNote({ idOrPath: a.id_or_path, ifRevision: a.if_revision, set: a.set, unset: a.unset, sections: a.sections }),
      ),
  );

  server.registerTool(
    'supersede',
    {
      description:
        'Replace a decision: creates new_decision (fields as for create_note), marks the old one superseded with links both ways, and flags the new one review: needed. Guarded by the old decision\'s if_revision: on conflict, re-read it with get and retry.',
      inputSchema: {
        old_id_or_path: idOrPath,
        if_revision: ifRevision,
        new_decision: z.object({ fields, sections: newSections.optional() }),
        base,
      },
    },
    (a) =>
      run(() =>
        bases.one(a.base).store.supersede({
          oldIdOrPath: a.old_id_or_path,
          ifRevision: a.if_revision,
          newDecision: { fields: a.new_decision.fields, sections: a.new_decision.sections ?? [] },
        }),
      ),
  );

  server.registerTool(
    'mark_source',
    {
      description:
        'Record the triage outcome on a captured source: linked or dismissed, the outcome, and linked_to wikilinks to the notes it was filed into. Guarded by if_revision: on conflict, re-read it with get and retry.',
      inputSchema: {
        id_or_path: idOrPath,
        if_revision: ifRevision,
        triage: z.enum(['linked', 'dismissed']),
        outcome: z.enum(TRIAGE_OUTCOMES as [string, ...string[]]),
        linked_to: wikilinks.optional().describe('Links such as "[[2026-10-08 Patch turnstile firmware|Patch turnstile firmware]]": "[[<file stem>|<title>]]", with the stem taken from the path of the note'),
        base,
      },
    },
    (a) =>
      run(() =>
        bases.one(a.base).store.markSource({ idOrPath: a.id_or_path, ifRevision: a.if_revision, triage: a.triage, outcome: a.outcome, linkedTo: a.linked_to }),
      ),
  );

  server.registerTool(
    'validate',
    {
      description: 'Check a base for schema problems, broken links, notes missing a summary or aliases, and likely duplicates. Reports only; fixes nothing.',
      inputSchema: { base },
    },
    (a) => run(() => validateBase(reading(a.base).index)),
  );
}

/** Serve the kiln tools over stdio. `cwd` is the working folder that base rules are matched against. */
export async function startMcpServer(opts: { cwd: string }): Promise<void> {
  const bases = new Bases(opts.cwd);
  const server = new McpServer({ name: 'kiln', version: version() }, { instructions: INSTRUCTIONS });
  register(server, bases);

  let closed = false;
  const shutdown = (): void => {
    if (closed) return;
    closed = true;
    bases.closeAll();
    void server.close();
  };
  process.stdin.once('close', shutdown);
  process.stdin.once('end', shutdown);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      shutdown();
      process.exit(0);
    });
  }

  await server.connect(new StdioServerTransport());
}

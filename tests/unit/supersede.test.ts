import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFields, splitNote } from '../../src/frontmatter.js';
import { Index } from '../../src/index/db.js';
import { Store } from '../../src/store.js';
import { KilnError, type Base, type Fields } from '../../src/types.js';

let base: Base;
let ix: Index;
let clock: Date;

beforeEach(() => {
  base = { name: 'test', path: mkdtempSync(join(tmpdir(), 'kiln-supersede-')) };
  ix = Index.open(base);
  // Midday UTC, so the local date is the same in every common time zone.
  clock = new Date('2026-10-01T12:00:00.000Z');
});

afterEach(() => {
  ix.close();
  rmSync(base.path, { recursive: true, force: true });
});

function store(io: ConstructorParameters<typeof Store>[2] = {}): Store {
  return new Store(base, ix, { now: () => clock, ...io });
}

function abs(rel: string): string {
  return join(base.path, rel);
}

function read(rel: string): string {
  return readFileSync(abs(rel), 'utf8');
}

function fieldsOf(rel: string): Fields {
  return parseFields(splitNote(read(rel)).fmText);
}

function rev(rel: string): string {
  return createHash('sha256')
    .update(readFileSync(abs(rel)))
    .digest('hex');
}

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected an error');
}

function kilnError(fn: () => unknown): KilnError {
  const e = thrown(fn);
  if (e instanceof KilnError) return e;
  throw e;
}

/** A complete Claude-written Northwind Arena decision; override any field. */
function decision(title: string, extra: Fields = {}) {
  return {
    fields: {
      title,
      status: 'active',
      decided_on: '2026-03-02',
      summary: 'How away supporters get their match tickets at Northwind Arena.',
      aliases: [`${title} decision`],
      sources: ['[[2026-03-01 Ticketing board minutes]]'],
      confidence: 'verbatim',
      anchors: ['[[Ticketing]]'],
      ...extra,
    },
    sections: [{ heading: 'Decision', text: `${title}.` }],
  };
}

const OLD = 'Paper tickets for away fans';
const NEW = 'Mobile-only tickets for away fans';
const OLD_PATH = `decisions/2026/2026-03-02 ${OLD}.md`;
const NEW_PATH = `decisions/2026/2026-10-09 ${NEW}.md`;
/** The Obsidian-resolvable links supersede writes: `[[<file stem>|<title>]]`. */
const OLD_LINK = `[[2026-03-02 ${OLD}|${OLD}]]`;
const NEW_LINK = `[[2026-10-09 ${NEW}|${NEW}]]`;

/** The decision to supersede, created on 2026-10-01. */
function oldDecision(s: Store) {
  return s.createNote({ type: 'decision', ...decision(OLD) });
}

/** Rename that throws `err` on the calls listed and renames normally otherwise. */
function failingRename(failOn: (call: number) => Error | undefined) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    rename: (from: Parameters<typeof renameSync>[0], to: Parameters<typeof renameSync>[1]) => {
      const err = failOn(++calls);
      if (err) throw err;
      renameSync(from, to);
    },
  };
}

function errno(code: string): Error {
  return Object.assign(new Error(`${code}: injected rename failure`), { code });
}

describe('supersede', () => {
  it('supersede links both directions and flags the new decision for review', () => {
    const old = oldDecision(store());
    clock = new Date('2026-10-10T12:00:00.000Z');

    const r = store().supersede({
      oldIdOrPath: old.id!,
      ifRevision: old.revision,
      newDecision: decision(NEW, { decided_on: '2026-10-09' }),
    });

    expect(r.created.created).toBe(true);
    expect(r.created.path).toBe(NEW_PATH);
    expect(r.created.revision).toBe(rev(NEW_PATH));
    expect(fieldsOf(NEW_PATH)).toMatchObject({
      id: r.created.id,
      type: 'decision',
      title: NEW,
      status: 'active',
      decided_on: '2026-10-09',
      created: '2026-10-10',
      supersedes: [OLD_LINK],
      review: 'needed',
      review_reason: `supersedes ${OLD}`,
    });

    expect(r.superseded).toEqual({ id: old.id, path: OLD_PATH, revision: rev(OLD_PATH), created: false });
    const oldFields = fieldsOf(OLD_PATH);
    expect(oldFields).toMatchObject({
      status: 'superseded',
      superseded_by: [NEW_LINK],
      updated: '2026-10-10',
      created: '2026-10-01',
      title: OLD,
    });
    expect(oldFields).not.toHaveProperty('review');

    expect(ix.get(old.id!).fields).toMatchObject({ status: 'superseded', superseded_by: [NEW_LINK] });
    expect(ix.get(r.created.id!).revision).toBe(r.created.revision);
    expect(ix.status().needsReview).toBe(1);
  });

  it('old decision must be type decision', () => {
    const s = store();
    const work = s.createNote({
      type: 'work',
      kind: 'chore',
      fields: {
        title: 'Print paper tickets for away fans',
        status: 'active',
        summary: 'Print and post paper tickets for the away end.',
        aliases: ['Away ticket printing'],
        sources: ['[[2026-03-01 Ticketing board minutes]]'],
        confidence: 'verbatim',
      },
      sections: [],
    });
    const before = read(work.path);

    const e = kilnError(() =>
      s.supersede({
        oldIdOrPath: work.path,
        ifRevision: work.revision,
        newDecision: decision(NEW, { decided_on: '2026-10-09' }),
      }),
    );

    expect(e.code).toBe('validation');
    expect(e.message).toContain('decision');
    expect(existsSync(abs('decisions'))).toBe(false);
    expect(read(work.path)).toBe(before);
  });

  it('a decision that is not active or proposed cannot be superseded, so its successor link is never overwritten', () => {
    const s = store();
    const old = oldDecision(s);
    clock = new Date('2026-10-10T12:00:00.000Z');
    s.supersede({
      oldIdOrPath: old.id!,
      ifRevision: old.revision,
      newDecision: decision(NEW, { decided_on: '2026-10-09' }),
    });
    const before = read(OLD_PATH);
    const files = readdirSync(abs('decisions/2026')).sort();

    const e = kilnError(() =>
      s.supersede({
        oldIdOrPath: old.id!,
        ifRevision: rev(OLD_PATH),
        newDecision: decision('Season card entry for away fans', { decided_on: '2026-10-10' }),
      }),
    );

    expect(e.code).toBe('validation');
    expect(e.message).toContain('superseded');
    expect(read(OLD_PATH)).toBe(before);
    expect(fieldsOf(OLD_PATH).superseded_by).toEqual([NEW_LINK]);
    expect(readdirSync(abs('decisions/2026')).sort()).toEqual(files);
  });

  it('stale revision on old decision raises conflict and creates nothing', () => {
    const s = store();
    const old = oldDecision(s);
    const before = read(OLD_PATH);

    const e = kilnError(() =>
      s.supersede({
        oldIdOrPath: old.id!,
        ifRevision: '0'.repeat(64),
        newDecision: decision(NEW, { decided_on: '2026-10-09' }),
      }),
    );

    expect(e.code).toBe('conflict');
    expect(e.details).toEqual({ reason: 'stale_revision', current: old.revision });
    expect(readdirSync(abs('decisions/2026'))).toEqual([`2026-03-02 ${OLD}.md`]);
    expect(read(OLD_PATH)).toBe(before);
    expect(ix.status().notes).toBe(1);
  });

  it('an unknown old decision raises not_found and creates nothing', () => {
    const e = kilnError(() =>
      store().supersede({
        oldIdOrPath: 'decisions/2026/Nope.md',
        ifRevision: 'x',
        newDecision: decision(NEW, { decided_on: '2026-10-09' }),
      }),
    );
    expect(e.code).toBe('not_found');
    expect(existsSync(abs('decisions'))).toBe(false);
  });

  it('failure patching old decision removes the new file from the vault and leaves old unchanged', () => {
    const old = oldDecision(store());
    const before = readFileSync(abs(OLD_PATH));
    clock = new Date('2026-10-10T12:00:00.000Z');
    // Call 1 lands the new decision; calls 2-6 are the locked old file (5 attempts); call 7 moves the new file to trash.
    const io = failingRename((n) => (n >= 2 && n <= 6 ? errno('EPERM') : undefined));

    const e = kilnError(() =>
      store({ rename: io.rename }).supersede({
        oldIdOrPath: old.id!,
        ifRevision: old.revision,
        newDecision: decision(NEW, { decided_on: '2026-10-09' }),
      }),
    );

    expect(e.code).toBe('locked_file');
    expect(e.details).toEqual({ path: OLD_PATH });
    expect(io.calls).toBe(7);
    expect(readdirSync(abs('decisions/2026'))).toEqual([`2026-03-02 ${OLD}.md`]);
    expect(readFileSync(abs(OLD_PATH)).equals(before)).toBe(true);
  });

  it('after a rollback the index does not hold the new note and .kiln/trash does', () => {
    const old = oldDecision(store());
    clock = new Date('2026-10-10T12:00:00.000Z');
    const injected = errno('EIO');
    const io = failingRename((n) => (n === 2 ? injected : undefined));

    const e = thrown(() =>
      store({ rename: io.rename }).supersede({
        oldIdOrPath: old.id!,
        ifRevision: old.revision,
        newDecision: decision(NEW, { decided_on: '2026-10-09' }),
      }),
    );

    expect(e).toBe(injected);
    expect((e as { details?: unknown }).details).toBeUndefined();
    const trashed = `.kiln/trash/2026-10-10T12-00-00-000Z-2026-10-09 ${NEW}.md`;
    expect(readdirSync(abs('.kiln/trash'))).toEqual([trashed.slice('.kiln/trash/'.length)]);
    expect(fieldsOf(trashed)).toMatchObject({ title: NEW, supersedes: [OLD_LINK] });
    expect(readdirSync(abs('decisions/2026'))).toEqual([`2026-03-02 ${OLD}.md`]);
    expect(kilnError(() => ix.get(NEW_PATH)).code).toBe('not_found');
    expect(ix.status()).toMatchObject({ notes: 1, needsReview: 0 });
    expect(ix.get(old.id!).fields.status).toBe('active');
    expect(ix.get(old.id!).revision).toBe(old.revision);
  });

  it('.kiln/trash is not indexed', () => {
    const old = oldDecision(store());
    const io = failingRename((n) => (n === 2 ? errno('EIO') : undefined));
    thrown(() =>
      store({ rename: io.rename }).supersede({
        oldIdOrPath: old.id!,
        ifRevision: old.revision,
        newDecision: decision(NEW, { decided_on: '2026-10-09' }),
      }),
    );
    expect(readdirSync(abs('.kiln/trash'))).toHaveLength(1);

    ix.reconcile({ force: true });
    expect(ix.status().notes).toBe(1);
    expect(ix.resolve(NEW).matches).toEqual([]);
  });

  it('a second rollback with the same timestamp does not overwrite the first trashed file', () => {
    const old = oldDecision(store());
    const io = failingRename((n) => (n === 2 || n === 5 ? errno('EIO') : undefined));
    const s = store({ rename: io.rename });
    const input = {
      oldIdOrPath: old.id!,
      ifRevision: old.revision,
      newDecision: decision(NEW, { decided_on: '2026-10-09' }),
    };
    thrown(() => s.supersede(input));
    thrown(() => s.supersede(input));
    expect(readdirSync(abs('.kiln/trash')).sort()).toEqual([
      `2026-10-01T12-00-00-000Z-2026-10-09 ${NEW} (2).md`,
      `2026-10-01T12-00-00-000Z-2026-10-09 ${NEW}.md`,
    ]);
  });

  it('a trash move that is locked a few times is retried and the vault ends consistent', () => {
    const old = oldDecision(store());
    const before = readFileSync(abs(OLD_PATH));
    const injected = errno('EIO');
    // Call 2 fails the old file's write; calls 3-6 find the new file locked (4 attempts); call 7 moves it to trash.
    const io = failingRename((n) => (n === 2 ? injected : n >= 3 && n <= 6 ? errno('EPERM') : undefined));

    const e = thrown(() =>
      store({ rename: io.rename }).supersede({
        oldIdOrPath: old.id!,
        ifRevision: old.revision,
        newDecision: decision(NEW, { decided_on: '2026-10-09' }),
      }),
    );

    expect(e).toBe(injected);
    expect((e as { details?: unknown }).details).toBeUndefined();
    expect(io.calls).toBe(7);
    expect(readdirSync(abs('.kiln/trash'))).toHaveLength(1);
    expect(readdirSync(abs('decisions/2026'))).toEqual([`2026-03-02 ${OLD}.md`]);
    expect(readFileSync(abs(OLD_PATH)).equals(before)).toBe(true);
    expect(ix.status().notes).toBe(1);
  });

  it('a failed trash move is attached to the original error, which is rethrown', () => {
    const old = oldDecision(store());
    const before = readFileSync(abs(OLD_PATH));
    const injected = errno('EIO');
    // The new file stays locked through all 5 trash attempts (calls 3-7).
    const io = failingRename((n) => (n === 2 ? injected : n >= 3 ? errno('EACCES') : undefined));

    const e = thrown(() =>
      store({ rename: io.rename }).supersede({
        oldIdOrPath: old.id!,
        ifRevision: old.revision,
        newDecision: decision(NEW, { decided_on: '2026-10-09' }),
      }),
    );

    expect(e).toBe(injected);
    expect(io.calls).toBe(7);
    expect((e as { details?: unknown }).details).toMatchObject({
      rollback: { path: NEW_PATH, error: expect.stringContaining('is locked') },
    });
    // The move failed, so the new file is still in the vault, but the index has rolled back and the old file is intact.
    expect(existsSync(abs(NEW_PATH))).toBe(true);
    expect(kilnError(() => ix.get(NEW_PATH)).code).toBe('not_found');
    expect(readFileSync(abs(OLD_PATH)).equals(before)).toBe(true);
  });

  it('an index failure after both files landed leaves both, consistent, and rethrows', () => {
    const old = oldDecision(store());
    const injected = new Error('disk I/O error');
    const upsert = ix.upsertText.bind(ix);
    let upserts = 0;
    ix.upsertText = (...a) => {
      if (++upserts === 2) throw injected;
      upsert(...a);
    };

    const e = thrown(() =>
      store().supersede({
        oldIdOrPath: old.id!,
        ifRevision: old.revision,
        newDecision: decision(NEW, { decided_on: '2026-10-09' }),
      }),
    );

    expect(e).toBe(injected);
    expect(existsSync(abs('.kiln/trash'))).toBe(false);
    expect(fieldsOf(NEW_PATH)).toMatchObject({ supersedes: [OLD_LINK] });
    expect(fieldsOf(OLD_PATH)).toMatchObject({ status: 'superseded', superseded_by: [NEW_LINK] });
    // The index rolled back; the next reconcile brings it in line with the two files.
    expect(kilnError(() => ix.get(NEW_PATH)).code).toBe('not_found');
    ix.reconcile({ force: true });
    expect(ix.get(old.id!).fields.status).toBe('superseded');
    expect(ix.get(NEW_PATH).fields.supersedes).toEqual([OLD_LINK]);
  });

  it('an index failure on the new decision moves it to trash and leaves old unchanged', () => {
    const old = oldDecision(store());
    const before = readFileSync(abs(OLD_PATH));
    const injected = new Error('disk I/O error');
    ix.upsertText = () => {
      throw injected;
    };

    const e = thrown(() =>
      store().supersede({
        oldIdOrPath: old.id!,
        ifRevision: old.revision,
        newDecision: decision(NEW, { decided_on: '2026-10-09' }),
      }),
    );

    expect(e).toBe(injected);
    expect(readdirSync(abs('.kiln/trash'))).toHaveLength(1);
    expect(readdirSync(abs('decisions/2026'))).toEqual([`2026-03-02 ${OLD}.md`]);
    expect(readFileSync(abs(OLD_PATH)).equals(before)).toBe(true);
  });

  it('a new title the old decision cannot link to raises validation and writes nothing', () => {
    const old = oldDecision(store());
    const before = read(OLD_PATH);
    let calls = 0;
    const s = store({
      rename: (from, to) => {
        calls++;
        renameSync(from, to);
      },
    });

    const e = kilnError(() =>
      s.supersede({
        oldIdOrPath: old.id!,
        ifRevision: old.revision,
        newDecision: decision('Mobile tickets [draft]', { decided_on: '2026-10-09' }),
      }),
    );

    expect(e.code).toBe('validation');
    expect(e.message).toContain('superseded_by');
    expect(calls).toBe(0);
    expect(readdirSync(abs('decisions/2026'))).toEqual([`2026-03-02 ${OLD}.md`]);
    expect(existsSync(abs('.kiln/trash'))).toBe(false);
    expect(read(OLD_PATH)).toBe(before);
  });

  it('a new decision without a title raises validation on title and writes nothing', () => {
    const old = oldDecision(store());
    const e = kilnError(() =>
      store().supersede({
        oldIdOrPath: old.id!,
        ifRevision: old.revision,
        newDecision: decision(NEW, { title: undefined, decided_on: '2026-10-09' }),
      }),
    );
    expect(e.code).toBe('validation');
    expect((e.details as { issues: { field: string }[] }).issues.map((i) => i.field)).toEqual(['title']);
    expect(readdirSync(abs('decisions/2026'))).toEqual([`2026-03-02 ${OLD}.md`]);
  });

  it('the duplicate check excludes the superseded decision, given by path in another case and with backslashes', () => {
    const old = oldDecision(store());
    const given =
      process.platform === 'win32' ? OLD_PATH.toUpperCase().replace(/\//g, '\\') : OLD_PATH.replace(/\//g, '\\');

    // Near-identical to the old title ("the" is a stopword): a duplicate of anything but the decision it replaces.
    const r = store().supersede({
      oldIdOrPath: given,
      ifRevision: old.revision,
      newDecision: decision('Paper tickets for the away fans', { decided_on: '2026-10-09' }),
    });

    expect(r.created.path).toBe('decisions/2026/2026-10-09 Paper tickets for the away fans.md');
    expect(r.superseded.path).toBe(OLD_PATH);
    expect(fieldsOf(OLD_PATH).superseded_by).toEqual([
      '[[2026-10-09 Paper tickets for the away fans|Paper tickets for the away fans]]',
    ]);
  });

  it('the duplicate check still runs against other decisions', () => {
    const s = store();
    const old = oldDecision(s);
    const other = s.createNote({
      type: 'decision',
      ...decision(NEW, { decided_on: '2026-09-15', sources: ['[[2026-09-14 Away fan survey]]'] }),
    });
    const before = read(OLD_PATH);

    const e = kilnError(() =>
      s.supersede({
        oldIdOrPath: old.id!,
        ifRevision: old.revision,
        newDecision: decision(NEW, { decided_on: '2026-10-09' }),
      }),
    );

    expect(e.code).toBe('conflict');
    expect(e.details).toMatchObject({ reason: 'duplicate', existing: { path: other.path } });
    expect(readdirSync(abs('decisions/2026')).sort()).toEqual([`2026-03-02 ${OLD}.md`, `2026-09-15 ${NEW}.md`]);
    expect(read(OLD_PATH)).toBe(before);
  });

  it('a new decision missing Claude-written fields raises validation and changes nothing', () => {
    const s = store();
    const old = oldDecision(s);
    const before = read(OLD_PATH);
    const e = kilnError(() =>
      s.supersede({
        oldIdOrPath: old.id!,
        ifRevision: old.revision,
        newDecision: decision(NEW, { decided_on: undefined }),
      }),
    );
    expect(e.code).toBe('validation');
    expect(e.message).toContain('decided_on');
    expect(readdirSync(abs('decisions/2026'))).toEqual([`2026-03-02 ${OLD}.md`]);
    expect(read(OLD_PATH)).toBe(before);
  });

  it('an old decision without a title is named by its filename stem', () => {
    const s = store();
    const rel = 'decisions/2025/2025-11-20 Season ticket pricing.md';
    const text = '---\ntype: decision\nstatus: active\ndecided_on: 2025-11-20\n---\nFlat pricing for all stands.\n';
    // Hand-written, then indexed.
    mkdirSync(abs('decisions/2025'), { recursive: true });
    writeFileSync(abs(rel), text);
    ix.reconcile();

    const r = s.supersede({
      oldIdOrPath: rel,
      ifRevision: rev(rel),
      newDecision: decision('Tiered season ticket pricing', { decided_on: '2026-10-09' }),
    });

    expect(fieldsOf(r.created.path)).toMatchObject({
      supersedes: ['[[2025-11-20 Season ticket pricing]]'],
      review_reason: 'supersedes 2025-11-20 Season ticket pricing',
    });
    expect(r.superseded.id).toBeNull();
    expect(fieldsOf(rel)).toMatchObject({
      status: 'superseded',
      superseded_by: ['[[2026-10-09 Tiered season ticket pricing|Tiered season ticket pricing]]'],
    });
  });
});

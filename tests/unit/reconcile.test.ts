import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Index, SCHEMA_VERSION } from '../../src/index/db.js';
import { KilnError, type Base } from '../../src/types.js';

let base: Base;
const open: Index[] = [];

function openIndex(opts?: { now?: () => number }): Index {
  const ix = Index.open(base, opts);
  open.push(ix);
  return ix;
}

function write(rel: string, text: string): void {
  const abs = join(base.path, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
}

function anchor(title: string, extra = ''): string {
  return `---\nid: 01ANCHOR${title.replace(/\W/g, '').toUpperCase()}\ntype: anchor\nkind: topic\ntitle: ${title}\nstatus: active\n${extra}---\n\n## Summary\n${title} body text.\n`;
}

/** Ten small typed notes so that one or two changes stay under the 30% rebuild threshold. */
function writeTen(): void {
  for (let i = 0; i < 10; i++) write(`anchors/topic/Topic ${i}.md`, anchor(`Topic ${i}`));
}

function rows<T = Record<string, unknown>>(ix: Index, sql: string, ...params: (string | number | null)[]): T[] {
  return ix.db.prepare(sql).all(...params) as T[];
}

function count(ix: Index, table: string): number {
  return (ix.db.prepare(`select count(*) as c from ${table}`).get() as { c: number }).c;
}

function ftsPaths(ix: Index, query: string): string[] {
  return rows<{ path: string }>(
    ix,
    'select notes.path from fts join notes on notes.rowid = fts.rowid where fts match ? order by notes.path',
    query,
  ).map((r) => r.path);
}

beforeEach(() => {
  base = { name: 'northwind', path: mkdtempSync(join(tmpdir(), 'kiln-reconcile-')) };
});

afterEach(() => {
  while (open.length > 0) open.pop()!.close();
  rmSync(base.path, { recursive: true, force: true });
});

describe('Index reconcile', () => {
  it('indexes a typed note and a hand-written note without frontmatter', () => {
    const typed =
      '---\n' +
      'id: 01J9ZK3Q7V2M8N4P6R0S1T2U3V\n' +
      'type: anchor\n' +
      'kind: person\n' +
      'title: Emmanuel Park\n' +
      'status: active\n' +
      'created: 2026-10-01\n' +
      'updated: 2026-10-09\n' +
      'aliases:\n  - Manny\n  - E. Park\n' +
      'summary: Head of venue operations at Northwind Arena.\n' +
      'keywords:\n  - turnstiles\n  - stewarding\n' +
      'anchors:\n  - "[[Northwind Arena]]"\n' +
      'review: needed\n' +
      '---\n\n## Summary\nOwns the matchday plan with [[Ticketing Platform]].\n';
    write('anchors/person/Emmanuel Park.md', typed);
    write('notes/scratch idea.md', 'Just a loose thought about gate queues.\n');

    const ix = openIndex();
    ix.reconcile();

    const notes = rows(ix, 'select * from notes order by path');
    expect(notes).toHaveLength(2);
    const [person, scratch] = notes;
    expect(person).toMatchObject({
      path: 'anchors/person/Emmanuel Park.md',
      id: '01J9ZK3Q7V2M8N4P6R0S1T2U3V',
      type: 'anchor',
      kind: 'person',
      title: 'Emmanuel Park',
      status: 'active',
      triage: null,
      review: 'needed',
      created: '2026-10-01',
      updated: '2026-10-09',
    });
    expect(JSON.parse(person!.fields_json as string)).toMatchObject({ title: 'Emmanuel Park', aliases: ['Manny', 'E. Park'] });
    expect(scratch).toMatchObject({ path: 'notes/scratch idea.md', id: null, type: null, title: 'scratch idea' });

    const file = rows(ix, "select * from files where path = 'anchors/person/Emmanuel Park.md'")[0]!;
    const bytes = readFileSync(join(base.path, 'anchors/person/Emmanuel Park.md'));
    expect(file).toMatchObject({
      size: bytes.length,
      hash: createHash('sha256').update(bytes).digest('hex'),
      id: '01J9ZK3Q7V2M8N4P6R0S1T2U3V',
    });

    expect(rows(ix, "select name_lc from aliases where path = 'anchors/person/Emmanuel Park.md' order by name_lc")).toEqual([
      { name_lc: 'e. park' },
      { name_lc: 'emmanuel park' },
      { name_lc: 'manny' },
    ]);
    expect(rows(ix, "select name_lc from aliases where path = 'notes/scratch idea.md'")).toEqual([{ name_lc: 'scratch idea' }]);
    expect(rows(ix, 'select src_path, target, target_lc from links order by target')).toEqual([
      { src_path: 'anchors/person/Emmanuel Park.md', target: 'Northwind Arena', target_lc: 'northwind arena' },
      { src_path: 'anchors/person/Emmanuel Park.md', target: 'Ticketing Platform', target_lc: 'ticketing platform' },
    ]);

    expect(ftsPaths(ix, 'manny')).toEqual(['anchors/person/Emmanuel Park.md']);
    expect(ftsPaths(ix, 'stewarding')).toEqual(['anchors/person/Emmanuel Park.md']);
    expect(ftsPaths(ix, 'summary:operations')).toEqual(['anchors/person/Emmanuel Park.md']);
    expect(ftsPaths(ix, 'matchday')).toEqual(['anchors/person/Emmanuel Park.md']);
    expect(ftsPaths(ix, 'queue')).toEqual(['notes/scratch idea.md']);
    expect(ftsPaths(ix, 'title:scratch')).toEqual(['notes/scratch idea.md']);
  });

  it('reconcile with no changes reports changed 0', () => {
    writeTen();
    const ix = openIndex();
    ix.reconcile();
    const stats = ix.reconcile();
    expect(stats).toMatchObject({ scanned: 10, added: 0, changed: 0, removed: 0, rebuilt: false });
    expect(stats.ms).toBeGreaterThanOrEqual(0);
  });

  it('external edit is picked up', () => {
    writeTen();
    const ix = openIndex();
    ix.reconcile();

    write('anchors/topic/Topic 3.md', anchor('Topic Three Renamed').replace('body text', 'floodlights'));
    const stats = ix.reconcile();

    expect(stats).toMatchObject({ added: 0, changed: 1, removed: 0, rebuilt: false });
    expect(rows(ix, "select title from notes where path = 'anchors/topic/Topic 3.md'")).toEqual([{ title: 'Topic Three Renamed' }]);
    expect(ftsPaths(ix, 'floodlights')).toEqual(['anchors/topic/Topic 3.md']);
    expect(rows(ix, "select name_lc from aliases where path = 'anchors/topic/Topic 3.md'")).toEqual([
      { name_lc: 'topic three renamed' },
    ]);
    expect(count(ix, 'notes')).toBe(10);
  });

  it('a touched file with identical bytes is not counted as changed', () => {
    writeTen();
    const ix = openIndex();
    ix.reconcile();

    const abs = join(base.path, 'anchors/topic/Topic 4.md');
    const later = new Date(statSync(abs).mtimeMs + 60_000);
    utimesSync(abs, later, later);
    expect(ix.reconcile()).toMatchObject({ changed: 0, rebuilt: false });
    expect(rows(ix, "select mtime from files where path = 'anchors/topic/Topic 4.md'")).toEqual([
      { mtime: statSync(abs).mtimeMs },
    ]);
  });

  it('move/rename: old path removed, new path added, id preserved', () => {
    writeTen();
    const ix = openIndex();
    ix.reconcile();
    const id = (rows<{ id: string }>(ix, "select id from notes where path = 'anchors/topic/Topic 5.md'")[0]!).id;

    mkdirSync(join(base.path, 'notes'), { recursive: true });
    renameSync(join(base.path, 'anchors/topic/Topic 5.md'), join(base.path, 'notes/Moved five.md'));
    const stats = ix.reconcile();

    expect(stats).toMatchObject({ added: 1, removed: 1, changed: 0, rebuilt: false });
    expect(rows(ix, 'select path from notes where id = ?', id)).toEqual([{ path: 'notes/Moved five.md' }]);
    expect(rows(ix, 'select path, id from files where id = ?', id)).toEqual([{ path: 'notes/Moved five.md', id }]);
    for (const table of ['files', 'notes']) {
      expect(rows(ix, `select * from ${table} where path = 'anchors/topic/Topic 5.md'`)).toEqual([]);
    }
    expect(rows(ix, "select * from aliases where path = 'anchors/topic/Topic 5.md'")).toEqual([]);
  });

  it('deleted file is removed from all tables', () => {
    writeTen();
    write('notes/Gate plan.md', anchor('Gate plan', 'aliases:\n  - Turnstile rota\n').replace('body text', 'zeppelin [[Topic 1]]'));
    const ix = openIndex();
    ix.reconcile();
    expect(ftsPaths(ix, 'zeppelin')).toEqual(['notes/Gate plan.md']);

    unlinkSync(join(base.path, 'notes/Gate plan.md'));
    const stats = ix.reconcile();

    expect(stats).toMatchObject({ scanned: 10, added: 0, changed: 0, removed: 1, rebuilt: false });
    expect(rows(ix, "select * from files where path = 'notes/Gate plan.md'")).toEqual([]);
    expect(rows(ix, "select * from notes where path = 'notes/Gate plan.md'")).toEqual([]);
    expect(rows(ix, "select * from links where src_path = 'notes/Gate plan.md'")).toEqual([]);
    expect(rows(ix, "select * from aliases where path = 'notes/Gate plan.md'")).toEqual([]);
    expect(ftsPaths(ix, 'zeppelin')).toEqual([]);
    expect(rows(ix, "select rowid from fts where fts match 'zeppelin'")).toEqual([]);
  });

  it('ignores .kiln/.obsidian/views folders', () => {
    write('notes/Kept.md', 'kept\n');
    write('notes/views/Nested views kept.md', 'nested\n');
    write('.kiln/trash/Trashed.md', 'trashed\n');
    write('.obsidian/templates/Template.md', 'template\n');
    write('.git/Readme.md', 'git\n');
    write('notes/.trash/Hidden.md', 'hidden\n');
    write('views/Inbox.md', 'view\n');
    write('notes/Not markdown.txt', 'text\n');

    const ix = openIndex();
    const stats = ix.reconcile();

    expect(stats.scanned).toBe(2);
    expect(rows(ix, 'select path from files order by path')).toEqual([
      { path: 'notes/Kept.md' },
      { path: 'notes/views/Nested views kept.md' },
    ]);
  });

  it('rebuild triggers above 30% churn and produces same counts', () => {
    writeTen();
    write('notes/Linker.md', 'Links [[Topic 1]] and [[Topic 2]].\n');
    const ix = openIndex();
    ix.reconcile();
    const counts = () => ['files', 'notes', 'links', 'aliases'].map((t) => count(ix, t));
    const before = counts();

    // 3 of 11 changed (27%): incremental.
    for (const i of [0, 1, 2]) write(`anchors/topic/Topic ${i}.md`, anchor(`Topic ${i}`).replace('body text', 'revised once'));
    expect(ix.reconcile()).toMatchObject({ changed: 3, rebuilt: false });

    // 4 of 11 changed (36%): rebuild.
    for (const i of [3, 4, 5, 6]) write(`anchors/topic/Topic ${i}.md`, anchor(`Topic ${i}`).replace('body text', 'revised twice'));
    const stats = ix.reconcile();
    expect(stats).toMatchObject({ scanned: 11, added: 0, changed: 4, removed: 0, rebuilt: true });
    expect(counts()).toEqual(before);
    expect(ftsPaths(ix, 'twice')).toHaveLength(4);
    expect(ftsPaths(ix, 'once')).toHaveLength(3);
    expect(ftsPaths(ix, 'Topic')).toHaveLength(11);

    // A forced rebuild of the same files gives the same counts again.
    expect(ix.reconcile({ force: true })).toMatchObject({ changed: 0, rebuilt: true });
    expect(counts()).toEqual(before);
    expect(ix.reconcile()).toMatchObject({ changed: 0, rebuilt: false });
  });

  it('the first reconcile of an empty index is a rebuild', () => {
    const ix = openIndex();
    writeTen();
    expect(ix.reconcile()).toMatchObject({ scanned: 10, added: 10, rebuilt: true });
  });

  it('ensureFresh skips scan within 10s and rescans after', () => {
    writeTen();
    let now = 1_000_000;
    const ix = openIndex({ now: () => now });
    ix.ensureFresh();
    expect(count(ix, 'notes')).toBe(10);

    write('notes/Late.md', 'late arrival\n');
    now += 10_000;
    ix.ensureFresh();
    expect(count(ix, 'notes')).toBe(10);

    now += 1;
    ix.ensureFresh();
    expect(count(ix, 'notes')).toBe(11);

    write('notes/Later.md', 'later arrival\n');
    now += 500;
    ix.ensureFresh(100);
    expect(count(ix, 'notes')).toBe(12);
  });

  it('unparseable frontmatter is indexed as type null and does not throw', () => {
    write('notes/Broken note.md', '---\ntype: work\ntitle: [unclosed\n---\nBody mentions bollards.\n');
    write('notes/List note.md', '---\n- just\n- a list\n---\nBody mentions barriers.\n');
    const ix = openIndex();
    expect(() => ix.reconcile()).not.toThrow();

    expect(rows(ix, 'select path, type, title, fields_json from notes order by path')).toEqual([
      { path: 'notes/Broken note.md', type: null, title: 'Broken note', fields_json: '{}' },
      { path: 'notes/List note.md', type: null, title: 'List note', fields_json: '{}' },
    ]);
    expect(ftsPaths(ix, 'bollards')).toEqual(['notes/Broken note.md']);
  });

  it('a schema version mismatch on open rebuilds the tables in place', () => {
    writeTen();
    const first = openIndex();
    first.reconcile();
    first.db.exec("insert into notes(path, title, fields_json) values ('ghost.md', 'Ghost', '{}')");
    first.db.exec('pragma user_version = 0');
    first.close();
    open.pop();

    const ix = openIndex();
    expect((ix.db.prepare('pragma user_version').get() as { user_version: number }).user_version).toBe(SCHEMA_VERSION);
    expect(rows(ix, "select * from notes where path = 'ghost.md'")).toEqual([]);
    expect(count(ix, 'notes')).toBe(10);
    expect(ix.reconcile()).toMatchObject({ changed: 0, rebuilt: false });
  });
});

describe('Index recovery', () => {
  const indexDir = () => join(base.path, '.kiln', 'index');
  const writeGarbage = () => {
    mkdirSync(indexDir(), { recursive: true });
    writeFileSync(join(indexDir(), 'kiln.sqlite'), 'this is not a sqlite database, it is Northwind Arena noise\n'.repeat(40));
    writeFileSync(join(indexDir(), 'kiln.sqlite-wal'), 'stale wal\n');
  };

  it('a corrupt index file is set aside and rebuilt on open', () => {
    writeTen();
    writeGarbage();

    const ix = openIndex();

    expect(count(ix, 'notes')).toBe(10);
    expect(ftsPaths(ix, 'Topic')).toHaveLength(10);
    const names = readdirSync(indexDir());
    const corrupt = names.filter((n) => n.startsWith('kiln.sqlite.corrupt-'));
    expect(corrupt.some((n) => !n.endsWith('-wal') && !n.endsWith('-shm'))).toBe(true);
    expect(ix.reconcile()).toMatchObject({ changed: 0, rebuilt: false });
  });

  it.runIf(process.platform === 'win32')('a corrupt index held open elsewhere raises busy', () => {
    writeTen();
    writeGarbage();
    const holder = new DatabaseSync(join(indexDir(), 'kiln.sqlite'));
    try {
      let err: unknown;
      try {
        openIndex();
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(KilnError);
      expect((err as KilnError).code).toBe('busy');
      expect((err as KilnError).message).toMatch(/corrupt/);
    } finally {
      holder.close();
    }
  });

  it('ensureFresh proceeds on the existing snapshot while another session holds the write lock', () => {
    writeTen();
    let now = 0;
    const ix = openIndex({ now: () => now });
    ix.db.exec('pragma busy_timeout = 50');
    const other = new DatabaseSync(join(base.path, '.kiln', 'index', 'kiln.sqlite'));
    write('notes/Late.md', 'late arrival\n');
    now += 20_000;
    other.exec('BEGIN IMMEDIATE');
    try {
      expect(() => ix.ensureFresh()).not.toThrow();
      expect(count(ix, 'notes')).toBe(10);
      expect(() => ix.reconcile()).toThrow(KilnError);
    } finally {
      other.exec('ROLLBACK');
      other.close();
    }

    // The failed check did not count as a check, so the next call rescans without the clock moving.
    ix.ensureFresh();
    expect(count(ix, 'notes')).toBe(11);
  });
});

describe('Index writes', () => {
  it('upsertText indexes text with its hash and stat, and reconcile then sees no change', () => {
    writeTen();
    const ix = openIndex();
    ix.reconcile();

    const text = anchor('Steward rota').replace('body text', 'hi-vis');
    write('notes/Steward rota.md', text);
    const st = statSync(join(base.path, 'notes/Steward rota.md'));
    ix.transaction(() => ix.upsertText('notes/Steward rota.md', text, { size: st.size, mtimeMs: st.mtimeMs }));

    expect(rows(ix, "select hash from files where path = 'notes/Steward rota.md'")).toEqual([
      { hash: createHash('sha256').update(text, 'utf8').digest('hex') },
    ]);
    expect(ftsPaths(ix, 'vis')).toEqual(['notes/Steward rota.md']);
    expect(ix.reconcile()).toMatchObject({ added: 0, changed: 0, removed: 0 });

    // Re-upserting replaces rather than duplicates.
    const revised = text.replace('hi-vis', 'lanyards');
    ix.transaction(() => ix.upsertText('notes/Steward rota.md', revised, { size: 1, mtimeMs: 1 }));
    expect(ftsPaths(ix, 'vis')).toEqual([]);
    expect(ftsPaths(ix, 'lanyards')).toEqual(['notes/Steward rota.md']);
    expect(rows(ix, "select count(*) as c from aliases where path = 'notes/Steward rota.md'")).toEqual([{ c: 1 }]);
  });

  it('transaction is re-entrant and rolls back everything on error', () => {
    const ix = openIndex();
    const stat = { size: 1, mtimeMs: 1 };

    const result = ix.transaction(() => {
      ix.upsertText('notes/A.md', 'alpha\n', stat);
      return ix.transaction(() => {
        ix.upsertText('notes/B.md', 'bravo\n', stat);
        return 'done';
      });
    });
    expect(result).toBe('done');
    expect(count(ix, 'notes')).toBe(2);

    expect(() =>
      ix.transaction(() => {
        ix.upsertText('notes/C.md', 'charlie\n', stat);
        ix.transaction(() => {
          throw new Error('boom');
        });
      }),
    ).toThrow('boom');
    expect(count(ix, 'notes')).toBe(2);
    expect(ix.db.isTransaction).toBe(false);

    // The index is usable again after a rollback.
    ix.transaction(() => ix.upsertText('notes/D.md', 'delta\n', stat));
    expect(count(ix, 'notes')).toBe(3);
  });

  it('a second writer gets KilnError busy after the busy timeout', () => {
    const a = openIndex();
    const b = openIndex();
    b.db.exec('pragma busy_timeout = 50');

    a.transaction(() => {
      let err: unknown;
      try {
        b.transaction(() => 1);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(KilnError);
      expect((err as KilnError).code).toBe('busy');
    });
    expect(b.db.isTransaction).toBe(false);
    expect(b.transaction(() => 2)).toBe(2);
  });
});

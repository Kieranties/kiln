import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Index } from '../../src/index/db.js';
import { KilnError, type Base } from '../../src/types.js';

let base: Base;
let ix: Index;

function write(rel: string, text: string): void {
  const abs = join(base.path, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
}

/** Frontmatter from `key: raw YAML value` pairs, then the body. */
function note(fm: Record<string, string>, body: string): string {
  return `---\n${Object.entries(fm)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n---\n${body}`;
}

const P = {
  arena: 'anchors/organisation/Northwind Arena.md',
  manny: 'anchors/person/Emmanuel Park.md',
  turnstiles: 'anchors/service/Turnstile Network.md',
  upgrade: 'projects/Gate Upgrade.md',
  paper: 'decisions/2026/2026-09-01 Paper tickets at gates.md',
  mobile: 'decisions/2026/2026-10-01 Mobile tickets at gates.md',
  marshals: 'decisions/2026/2026-10-05 Queue marshals.md',
  firmware: 'work/2026/Fix turnstile firmware.md',
  rota: 'work/2026/Stewarding rota.md',
  radio: 'work/2026/Radio audit.md',
  email: 'sources/email/2026-10-02 Firmware vendor email.md',
  web: 'sources/web/2026-09-30 Stadium news.md',
  slack: 'sources/slack/2026-09-28 Gate queue chatter.md',
};

const MANNY_ID = '01J9ZK3Q7V2M8N4P6R0S1T2U3V';
const MOBILE_ID = '01J9ZK3Q7V2M8N4P6R0S1T2MOB';

/** A small Northwind Arena base: 3 anchors, a project, 3 decisions, 3 work items and 3 sources. */
function writeBase(): void {
  write(
    P.arena,
    note(
      {
        id: '01J9ZK3Q7V2M8N4P6R0S1ARENA',
        type: 'anchor',
        kind: 'organisation',
        role: 'self',
        title: 'Northwind Arena',
        status: 'active',
        updated: '2026-09-01',
        aliases: '["Northwind", "Nordvind Årena"]',
        summary: 'The stadium and events company.',
      },
      '\n## Summary\nRuns the stadium.\n',
    ),
  );
  write(
    P.manny,
    note(
      {
        id: MANNY_ID,
        type: 'anchor',
        kind: 'person',
        title: 'Emmanuel Park',
        status: 'active',
        updated: '2026-09-15',
        aliases: '["Manny", "EP"]',
        summary: 'Head of venue operations at Northwind Arena.',
        anchors: '["[[Northwind Arena]]"]',
      },
      '\n## Summary\nOwns the matchday operations plan.\nReports to the board.\n\n## Facts\n- Joined in 2024.\n',
    ),
  );
  write(
    P.turnstiles,
    note(
      {
        id: '01J9ZK3Q7V2M8N4P6R0S1TURNS',
        type: 'anchor',
        kind: 'service',
        title: 'Turnstile Network',
        status: 'active',
        updated: '2026-09-10',
        aliases: '["Gates"]',
        summary: 'The turnstiles and scanners at every entrance.',
      },
      '\n## Summary\nForty turnstiles across four stands.\n',
    ),
  );
  write(
    P.upgrade,
    note(
      {
        id: '01J9ZK3Q7V2M8N4P6R0S1UPGRD',
        type: 'project',
        title: 'Gate Upgrade',
        status: 'active',
        updated: '2026-10-03',
        summary: 'Replace the turnstile controllers before the new season.',
        anchors: '["[[Turnstile Network]]"]',
      },
      '\n## Goal\nNew controllers.\n',
    ),
  );
  write(
    P.paper,
    note(
      {
        id: '01J9ZK3Q7V2M8N4P6R0S1PAPER',
        type: 'decision',
        title: 'Paper tickets at gates',
        status: 'superseded',
        updated: '2026-09-20',
        summary: 'Paper tickets at gates stay accepted at gates.',
      },
      '\n## Decision\nKeep paper tickets at gates.\n',
    ),
  );
  write(
    P.mobile,
    note(
      {
        id: MOBILE_ID,
        type: 'decision',
        title: 'Mobile tickets at gates',
        status: 'active',
        updated: '2026-10-01',
        summary: 'Only phones are scanned.',
        anchors: '["[[Turnstile Network]]", "[[Manny]]"]',
        project: '"[[Gate Upgrade]]"',
      },
      '\n## Decision\nMobile only.\n',
    ),
  );
  write(
    P.marshals,
    note(
      {
        id: '01J9ZK3Q7V2M8N4P6R0S1MRSHL',
        type: 'decision',
        title: 'Queue marshals',
        status: 'proposed',
        updated: '2026-10-05',
        summary: 'Add marshals to the north stand queues.',
      },
      '\n## Context\nRaised by [[Emmanuel Park]].\n',
    ),
  );
  write(
    P.firmware,
    note(
      {
        id: '01J9ZK3Q7V2M8N4P6R0S1FIRMW',
        type: 'work',
        kind: 'bug',
        title: 'Fix turnstile firmware',
        status: 'active',
        updated: '2026-10-08',
        summary: 'Turnstiles reboot during updates.',
        anchors: '["[[Turnstile Network]]", "[[Emmanuel Park]]"]',
        project: '"[[Gate Upgrade]]"',
        review: 'needed',
      },
      '\n## Summary\nReboot loop.\n',
    ),
  );
  write(
    P.rota,
    note(
      {
        id: '01J9ZK3Q7V2M8N4P6R0S1ROTAA',
        type: 'work',
        kind: 'chore',
        title: 'Stewarding rota',
        status: 'blocked',
        updated: '2026-10-06',
        project: 'gate upgrade',
      },
      '\n## Summary\nWaiting on [[emmanuel park]] to approve the rota.\n',
    ),
  );
  write(
    P.radio,
    note(
      {
        id: '01J9ZK3Q7V2M8N4P6R0S1RADIO',
        type: 'work',
        kind: 'research',
        title: 'Radio audit',
        status: 'done',
        updated: '2026-10-09',
      },
      '\n## Outcome\n[[EMMANUEL PARK]] signed off the radio audit.\n',
    ),
  );
  write(
    P.email,
    note(
      {
        id: '01J9ZK3Q7V2M8N4P6R0S1EMAIL',
        type: 'source',
        kind: 'email',
        title: 'Firmware vendor email',
        triage: 'pending',
        created: '2026-10-02',
        captured_at: '2026-09-29T09:00:00.000Z',
      },
      '\nFrom the vendor.\n\n  The turnstile network firmware 4.2 fixes the turnstile firmware reboot loop.  \nMore firmware notes for the turnstile network follow.\n',
    ),
  );
  write(
    P.web,
    note(
      {
        id: '01J9ZK3Q7V2M8N4P6R0S1WEBSR',
        type: 'source',
        kind: 'web',
        title: 'Stadium news',
        triage: 'pending',
        created: '2026-09-30',
      },
      '\n[[NORDVIND ÅRENA]] will issue new staff lanyards.\n',
    ),
  );
  write(
    P.slack,
    note(
      {
        id: '01J9ZK3Q7V2M8N4P6R0S1SLACK',
        type: 'source',
        kind: 'slack',
        title: 'Gate queue chatter',
        triage: 'linked',
        created: '2026-09-28',
        captured_at: '2026-09-28T18:00:00.000Z',
      },
      '\nLong queues at the north stand.\n',
    ),
  );
}

const paths = (refs: { path: string }[]): string[] => refs.map((r) => r.path);

beforeEach(() => {
  base = { name: 'northwind', path: mkdtempSync(join(tmpdir(), 'kiln-read-')) };
  writeBase();
  ix = Index.open(base);
});

afterEach(() => {
  ix.close();
  rmSync(base.path, { recursive: true, force: true });
});

describe('search', () => {
  it('superseded decision ranks below active decision for the same query', () => {
    const hits = ix.search({ q: 'tickets at gates', autoScope: false });
    const order = paths(hits);
    expect(order).toContain(P.paper);
    expect(order.indexOf(P.mobile)).toBeLessThan(order.indexOf(P.paper));
    // The superseded decision matches the words more strongly; only the status boost puts it below.
    const paper = hits.find((h) => h.path === P.paper)!;
    const mobile = hits.find((h) => h.path === P.mobile)!;
    expect(paper.score / 0.4).toBeGreaterThan(mobile.score / 1.6);
    expect(mobile).toMatchObject({
      id: MOBILE_ID,
      title: 'Mobile tickets at gates',
      type: 'decision',
      kind: null,
      status: 'active',
    });
    expect(mobile.score).toBeGreaterThan(0);
  });

  it('autoScope puts the matched anchor first, then notes linking it', () => {
    const q = 'Turnstile Network firmware';
    const scoped = paths(ix.search({ q }));
    expect(scoped[0]).toBe(P.turnstiles);
    const linking = [P.firmware, P.upgrade];
    for (const p of linking) expect(scoped.indexOf(p)).toBeGreaterThan(0);
    expect(scoped.indexOf(P.email)).toBeGreaterThan(Math.max(...linking.map((p) => scoped.indexOf(p))));

    // Without scope the vendor email outranks the project on score alone.
    const global = ix.search({ q, autoScope: false });
    const g = paths(global);
    expect(g.indexOf(P.email)).toBeLessThan(g.indexOf(P.upgrade));
    expect(new Set(g)).toEqual(new Set(scoped));
  });

  it('explicit scope lists the anchor even when it is not a hit, then hits that link it by any name', () => {
    const hits = ix.search({ q: 'operations rota plan', scopeAnchors: ['[[Emmanuel Park]]'] });
    expect(paths(hits)[0]).toBe(P.manny);
    // The rota links [[emmanuel park]] in lower case.
    expect(paths(hits)).toContain(P.rota);

    const notHit = ix.search({ q: 'firmware', scopeAnchors: ['Northwind Arena'], limit: 3 });
    expect(paths(notHit)[0]).toBe(P.arena);
    expect(notHit[0]!.score).toBe(0);
    expect(notHit).toHaveLength(3);
  });

  it('boosts multiply the BM25 score by type and status', () => {
    const kinds: Record<string, Record<string, string>> = {
      note: {},
      anchor: { type: 'anchor' },
      project: { type: 'project' },
      work: { type: 'work' },
      active: { type: 'decision', status: 'active' },
      proposed: { type: 'decision', status: 'proposed' },
      superseded: { type: 'decision', status: 'superseded' },
      reference: { type: 'reference' },
    };
    // Identical indexed text, so the raw BM25 is identical and only the boost differs.
    for (const [k, fm] of Object.entries(kinds))
      write(`notes/z/${k}.md`, note({ ...fm, title: 'Zamboni bay' }, 'The zamboni bay.\n'));
    ix.reconcile();
    const score = new Map(ix.search({ q: 'zamboni', autoScope: false }).map((h) => [h.path.slice(8, -3), h.score]));
    const raw = score.get('note')!;
    // An unboosted note scores exactly the negated BM25 with the spec's field weights.
    const bm25 = ix.db
      .prepare(
        "SELECT -bm25(fts, 5, 3, 2, 0.5, 1) AS s FROM fts JOIN notes n ON n.rowid = fts.rowid WHERE fts MATCH 'zamboni' AND n.path = ?",
      )
      .get('notes/z/note.md') as { s: number };
    expect(raw).toBe(bm25.s);
    const expected = {
      anchor: 1.6,
      project: 1.3,
      work: 1.3,
      active: 1.6,
      proposed: 1.3,
      superseded: 0.4,
      reference: 1.0,
    };
    for (const [k, boost] of Object.entries(expected)) expect(score.get(k)! / raw).toBeCloseTo(boost, 9);
  });

  it('variants widen recall', () => {
    expect(ix.search({ q: 'accreditation badges' })).toEqual([]);
    const hits = ix.search({ q: 'accreditation badges', variants: ['staff lanyard'] });
    expect(paths(hits)).toEqual([P.web]);
  });

  it('snippet is the summary, else the first body line with a term, trimmed and capped', () => {
    const hits = ix.search({ q: 'firmware', autoScope: false });
    expect(hits.find((h) => h.path === P.firmware)!.snippet).toBe('Turnstiles reboot during updates.');
    expect(hits.find((h) => h.path === P.email)!.snippet).toBe(
      'The turnstile network firmware 4.2 fixes the turnstile firmware reboot loop.',
    );
    write('notes/Long line.md', `\n${'firmware '.repeat(40)}\n`);
    ix.reconcile();
    const long = ix.search({ q: 'firmware', autoScope: false }).find((h) => h.path === 'notes/Long line.md')!;
    expect(long.snippet).toHaveLength(200);
  });

  it('returns nothing when the query has only stopwords, and respects limit', () => {
    expect(ix.search({ q: 'the and of' })).toEqual([]);
    expect(ix.search({ q: 'gates tickets turnstile', autoScope: false, limit: 2 })).toHaveLength(2);
  });
});

describe('matchAnchors', () => {
  it("matchAnchors finds alias 'Manny' for anchor Emmanuel Park", () => {
    expect(ix.matchAnchors('Ask Manny about the queues')).toEqual(['Emmanuel Park']);
    expect(ix.matchAnchors("What did manny's team decide for the gates?")).toEqual([
      'Emmanuel Park',
      'Turnstile Network',
    ]);
    expect(ix.matchAnchors('Gate Upgrade status at NORDVIND ÅRENA')).toEqual(['Gate Upgrade', 'Northwind Arena']);
  });

  it('needs word boundaries and ignores aliases of two characters or fewer', () => {
    expect(ix.matchAnchors('Mannyfest tickets')).toEqual([]);
    expect(ix.matchAnchors('Gate Upgrades are planned')).toEqual([]);
    expect(ix.matchAnchors('(Gate Upgrade)')).toEqual(['Gate Upgrade']);
    expect(ix.matchAnchors('the EP said so')).toEqual([]);
    expect(ix.matchAnchors('')).toEqual([]);
    expect(ix.matchAnchors('Manny')).toEqual(['Emmanuel Park']);
  });
});

describe('resolve and brief', () => {
  it('resolve exact alias returns brief with active decisions and open work', () => {
    const r = ix.resolve('manny');
    expect(r.matches[0]).toEqual({
      id: MANNY_ID,
      path: P.manny,
      title: 'Emmanuel Park',
      type: 'anchor',
      kind: 'person',
      status: 'active',
      updated: '2026-09-15',
    });
    const b = r.brief!;
    expect(b.note.path).toBe(P.manny);
    expect(b.summary).toBe('Head of venue operations at Northwind Arena.');
    expect(b.currentTruth).toBe('Owns the matchday operations plan.\nReports to the board.');
    expect(paths(b.activeDecisions)).toEqual([P.marshals, P.mobile]);
    expect(paths(b.openWork)).toEqual([P.firmware, P.rota]);
    expect(paths(b.recent)).toEqual([P.radio, P.firmware, P.rota, P.marshals, P.mobile]);
  });

  it('resolve falls back to FTS over anchors and projects, and returns no brief when nothing matches', () => {
    const r = ix.resolve('stadium company');
    expect(paths(r.matches)).toEqual([P.arena]);
    expect(r.brief!.note.title).toBe('Northwind Arena');
    expect(ix.resolve('[[Gate Upgrade]]').matches[0]!.path).toBe(P.upgrade);
    expect(ix.resolve('nobody at all')).toEqual({ matches: [], brief: null });
  });

  it('brief accepts a path and caps current truth', () => {
    write(
      'anchors/topic/Pitch.md',
      note({ type: 'anchor', kind: 'topic', title: 'Pitch' }, `\n## summary\n${'grass '.repeat(400)}\n`),
    );
    ix.reconcile();
    const b = ix.brief('anchors/topic/Pitch.md');
    expect(b.currentTruth).toHaveLength(1500);
    expect(b.summary).toBe('');
    expect(b).toMatchObject({ activeDecisions: [], openWork: [], recent: [] });
  });
});

describe('query', () => {
  it('query filters by type/status/anchor/review', () => {
    expect(paths(ix.query({ type: 'decision' }))).toEqual([P.marshals, P.mobile, P.paper]);
    expect(paths(ix.query({ type: 'decision', status: 'active' }))).toEqual([P.mobile]);
    expect(paths(ix.query({ type: 'work', kind: 'bug' }))).toEqual([P.firmware]);
    expect(paths(ix.query({ anchors: ['Turnstile Network'] }))).toEqual([P.firmware, P.upgrade, P.mobile]);
    expect(paths(ix.query({ anchors: ['[[Emmanuel Park]]'], type: 'work' }))).toEqual([P.radio, P.firmware, P.rota]);
    // A non-ASCII link in another case still counts.
    expect(paths(ix.query({ anchors: ['Northwind Arena'] }))).toEqual([P.manny, P.web]);
    expect(paths(ix.query({ review: true }))).toEqual([P.firmware]);
    expect(ix.query({ review: false })).toHaveLength(12);
    expect(paths(ix.query({ project: 'Gate Upgrade' }))).toEqual([P.firmware, P.rota, P.mobile]);
    expect(paths(ix.query({ project: '[[gate upgrade]]', status: 'active' }))).toEqual([P.firmware, P.mobile]);
    expect(paths(ix.query({ updatedAfter: '2026-10-05' }))).toEqual([P.radio, P.firmware, P.rota]);
    expect(paths(ix.query({ triage: 'linked' }))).toEqual([P.slack]);
    expect(ix.query({})).toHaveLength(13);
    expect(ix.query({ limit: 2 })).toHaveLength(2);
  });

  it('a piped [[stem|Title]] link to a date-prefixed decision counts as linking for brief and query anchors', () => {
    const lanes = 'decisions/2026/2026-10-10 Phone-only entry lanes.md';
    write(
      lanes,
      note(
        {
          type: 'decision',
          title: 'Phone-only entry lanes',
          status: 'active',
          updated: '2026-10-10',
          anchors: '["[[2026-10-01 Mobile tickets at gates|Mobile tickets at gates]]"]',
        },
        '\n## Decision\nTwo lanes per stand.\n',
      ),
    );
    ix.reconcile();
    expect(paths(ix.brief(P.mobile).activeDecisions)).toEqual([lanes]);
    expect(paths(ix.query({ anchors: ['Mobile tickets at gates'] }))).toEqual([lanes]);
    expect(paths(ix.query({ anchors: ['[[2026-10-01 Mobile tickets at gates|Mobile tickets at gates]]'] }))).toEqual([
      lanes,
    ]);
  });

  it('project matches a piped [[stem|Title]] link by the project title, alias or stem', () => {
    write(
      'projects/Gate Upgrade Phase 2.md',
      note({ type: 'project', title: '"Gate Upgrade: Phase 2"', status: 'active', aliases: '["GU2"]' }, ''),
    );
    write(
      'work/2026/Wire gate 9.md',
      note(
        {
          type: 'work',
          kind: 'chore',
          title: 'Wire gate 9',
          status: 'active',
          project: '"[[Gate Upgrade Phase 2|Gate Upgrade: Phase 2]]"',
        },
        '',
      ),
    );
    ix.reconcile();
    for (const name of [
      'Gate Upgrade: Phase 2',
      '[[Gate Upgrade Phase 2|Gate Upgrade: Phase 2]]',
      'gu2',
      'Gate Upgrade Phase 2',
    ]) {
      expect(paths(ix.query({ project: name })), name).toEqual(['work/2026/Wire gate 9.md']);
    }
  });

  it('project matches case-insensitively beyond ASCII', () => {
    write(
      'work/2026/Bar refit.md',
      note({ type: 'work', kind: 'chore', title: 'Bar refit', status: 'active', project: '"[[Ölstand Refit]]"' }, ''),
    );
    ix.reconcile();
    expect(paths(ix.query({ project: 'ÖLSTAND REFIT' }))).toEqual(['work/2026/Bar refit.md']);
  });
});

describe('get', () => {
  it('get by id and by path; revision equals sha256 of file bytes', () => {
    const bytes = readFileSync(join(base.path, P.manny));
    const expected = createHash('sha256').update(bytes).digest('hex');

    const byId = ix.get(MANNY_ID);
    expect(byId).toMatchObject({ id: MANNY_ID, path: P.manny, revision: expected });
    expect(byId.fields).toMatchObject({ title: 'Emmanuel Park', aliases: ['Manny', 'EP'] });
    expect(byId.body).toBe(
      '\n## Summary\nOwns the matchday operations plan.\nReports to the board.\n\n## Facts\n- Joined in 2024.\n',
    );

    expect(ix.get(P.manny)).toEqual(byId);
    expect(ix.get(P.manny.replace(/\//g, '\\'))).toEqual(byId);
    if (process.platform === 'win32') expect(ix.get(P.manny.toUpperCase())).toEqual(byId);
  });

  it('get returns empty fields for unparseable frontmatter and raises not_found for unknown notes', () => {
    write('notes/Broken.md', '---\ntitle: [unclosed\n---\nBody text.\n');
    ix.reconcile();
    expect(ix.get('notes/Broken.md')).toMatchObject({ id: null, fields: {}, body: 'Body text.\n' });

    let err: unknown;
    try {
      ix.get('notes/Missing.md');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(KilnError);
    expect((err as KilnError).code).toBe('not_found');
    expect(() => ix.brief('01NOSUCHNOTE')).toThrow(KilnError);
  });
});

describe('inbox and status', () => {
  it('inbox lists pending sources oldest first', () => {
    // The email was captured 2026-09-29 (created 10-02); the web source has no captured_at, so its created date
    // (2026-09-30) orders it. The linked slack source is excluded.
    expect(paths(ix.inbox())).toEqual([P.email, P.web]);
    expect(paths(ix.inbox(1))).toEqual([P.email]);
  });

  it('status counts notes, inbox and review', () => {
    expect(ix.status()).toEqual({ base: 'northwind', notes: 13, inbox: 2, needsReview: 1 });
  });
});

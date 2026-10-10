import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFields, splitNote } from '../../src/frontmatter.js';
import { Index } from '../../src/index/db.js';
import { Store } from '../../src/store.js';
import { KilnError, type Base, type Fields } from '../../src/types.js';

let base: Base;
let ix: Index;
let clock: Date;

beforeEach(() => {
  base = { name: 'test', path: mkdtempSync(join(tmpdir(), 'kiln-store-')) };
  ix = Index.open(base);
  // Midday UTC, so the local date is 2026-10-10 in every common time zone.
  clock = new Date('2026-10-10T12:00:00.000Z');
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
  return createHash('sha256').update(readFileSync(abs(rel))).digest('hex');
}

/** A hand-written file, indexed by an explicit reconcile. */
function handWrite(rel: string, text: string): void {
  mkdirSync(dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), text);
  ix.reconcile();
}

function kilnError(fn: () => unknown): KilnError {
  try {
    fn();
  } catch (e) {
    if (e instanceof KilnError) return e;
    throw e;
  }
  throw new Error('expected a KilnError');
}

/** A complete Claude-written work item about Northwind Arena; override any field. */
function workNote(title: string, extra: Fields = {}) {
  return {
    type: 'work' as const,
    kind: 'bug',
    fields: {
      title,
      status: 'active',
      summary: 'Turnstiles at the North Stand reject valid mobile tickets after the firmware update.',
      aliases: ['Turnstile firmware bug'],
      sources: ['[[2026-10-02 Firmware vendor email]]'],
      confidence: 'verbatim',
      anchors: ['[[Turnstile Network]]'],
      ...extra,
    },
    sections: [
      { heading: 'Summary', text: 'Gates 3 and 4 reject mobile tickets.' },
      { heading: 'Checkpoints', text: '- 2026-10-09: vendor contacted.' },
    ],
  };
}

describe('capture', () => {
  it('capture creates a pending source in sources/<kind>/ with dedupe_key', () => {
    const r = store().capture({
      kind: 'email',
      title: 'Firmware vendor email',
      content: 'From: support@turnstile-vendor.example\nThe patch ships on Friday.\n',
      url: 'https://mail.example/MSG-1042',
      sourceId: 'MSG-1042',
      why: 'Explains the gate outage',
    });

    expect(r.created).toBe(true);
    expect(r.id).toBeNull();
    expect(r.path).toBe('sources/email/2026-10-10 Firmware vendor email.md');
    expect(r.revision).toBe(rev(r.path));
    const f = fieldsOf(r.path);
    expect(f).toEqual({
      type: 'source',
      kind: 'email',
      title: 'Firmware vendor email',
      created: '2026-10-10',
      updated: '2026-10-10',
      captured_at: '2026-10-10T12:00:00.000Z',
      captured_by: 'manual',
      triage: 'pending',
      url: 'https://mail.example/MSG-1042',
      source_id: 'MSG-1042',
      dedupe_key: 'email:MSG-1042',
      why: 'Explains the gate outage',
    });
    expect(splitNote(read(r.path)).body).toBe('From: support@turnstile-vendor.example\nThe patch ships on Friday.\n');
    expect(ix.inbox().map((n) => n.path)).toEqual([r.path]);
    expect(ix.get(r.path).revision).toBe(r.revision);
  });

  it('a capture without sourceId gets no dedupe_key and never updates another', () => {
    const s = store();
    const a = s.capture({ kind: 'note', title: 'Gate idea', content: 'Queue marshals at Gate 2.' });
    const b = s.capture({ kind: 'note', title: 'Gate idea', content: 'Queue marshals at Gate 5.' });
    expect(fieldsOf(a.path)).not.toHaveProperty('dedupe_key');
    expect(fieldsOf(a.path)).not.toHaveProperty('source_id');
    expect(b.created).toBe(true);
    expect(b.path).toBe('sources/note/2026-10-10 Gate idea (2).md');
  });

  it('capturing the same kind+sourceId updates the existing source', () => {
    const s = store();
    const first = s.capture({ kind: 'jira', title: 'NWA-42 Turnstile outage', content: 'Status: open\n', sourceId: 'NWA-42' });
    s.markSource({ idOrPath: first.path, ifRevision: first.revision, triage: 'dismissed', outcome: 'dismiss' });

    clock = new Date('2026-10-12T12:00:00.000Z');
    const again = s.capture({ kind: 'jira', title: 'NWA-42 renamed upstream', content: 'Status: resolved\nFixed by firmware 4.2.\n', sourceId: 'NWA-42' });

    expect(again.created).toBe(false);
    expect(again.path).toBe(first.path);
    expect(readdirSync(abs('sources/jira'))).toEqual(['2026-10-10 NWA-42 Turnstile outage.md']);
    const f = fieldsOf(again.path);
    expect(f.captured_at).toBe('2026-10-12T12:00:00.000Z');
    expect(f.updated).toBe('2026-10-12');
    expect(f.created).toBe('2026-10-10');
    expect(f.title).toBe('NWA-42 Turnstile outage');
    expect(f.triage).toBe('dismissed');
    expect(f.triage_outcome).toBe('dismiss');
    expect(splitNote(read(again.path)).body).toBe('Status: resolved\nFixed by firmware 4.2.\n');
    expect(again.revision).toBe(rev(again.path));
    expect(ix.get(again.path).revision).toBe(again.revision);
  });

  it('a repeat capture into a CRLF source writes the new content with CRLF', () => {
    handWrite(
      'sources/slack/2026-09-28 Gate queue chatter.md',
      '---\r\ntype: source\r\nkind: slack\r\ntitle: Gate queue chatter\r\ncaptured_at: 2026-09-28\r\n' +
        'triage: pending\r\nsource_id: C42-1\r\ndedupe_key: "slack:C42-1"\r\nupdated: 2026-09-28\r\n---\r\nold\r\n',
    );
    const r = store().capture({ kind: 'slack', title: 'Gate queue chatter', content: 'line one\nline two\n', sourceId: 'C42-1' });
    expect(r.created).toBe(false);
    expect(read(r.path)).toBe(
      '---\r\ntype: source\r\nkind: slack\r\ntitle: Gate queue chatter\r\ncaptured_at: "2026-10-10T12:00:00.000Z"\r\n' +
        'triage: pending\r\nsource_id: C42-1\r\ndedupe_key: "slack:C42-1"\r\nupdated: 2026-10-10\r\n---\r\nline one\r\nline two\r\n',
    );
  });
});

describe('createNote', () => {
  it('createNote writes, places and indexes a Claude-written note', () => {
    const r = store().createNote(workNote('Fix turnstile firmware'));
    expect(r.created).toBe(true);
    expect(r.path).toBe('work/2026/Fix turnstile firmware.md');
    expect(r.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    const f = fieldsOf(r.path);
    expect(f).toMatchObject({ id: r.id, type: 'work', kind: 'bug', created: '2026-10-10', updated: '2026-10-10' });
    expect(read(r.path)).toContain('\n## Summary\nGates 3 and 4 reject mobile tickets.\n\n## Checkpoints\n');
    expect(read(r.path)).not.toContain('\r');
    expect(r.revision).toBe(rev(r.path));
    expect(ix.get(r.id!).path).toBe(r.path);
  });

  it('createNote rejects a Claude-written note without summary (validation, nothing written)', () => {
    const input = workNote('Fix turnstile firmware');
    delete (input.fields as Fields).summary;
    const e = kilnError(() => store().createNote(input));
    expect(e.code).toBe('validation');
    expect(e.message).toContain('summary');
    expect(e.message).toContain('add 1-2 plain-language sentences');
    expect((e.details as { issues: { field: string }[] }).issues.map((i) => i.field)).toEqual(['summary']);
    expect(existsSync(abs('work'))).toBe(false);
    expect(ix.status().notes).toBe(0);
  });

  it('createNote raises duplicate conflict for a near-identical title of the same type', () => {
    const s = store();
    const first = s.createNote(workNote('Replace turnstile firmware'));

    const e = kilnError(() => s.createNote(workNote('Replace the Turnstile firmware')));
    expect(e.code).toBe('conflict');
    expect(e.details).toMatchObject({ reason: 'duplicate', existing: { id: first.id, path: first.path, title: 'Replace turnstile firmware', type: 'work' } });
    expect(readdirSync(abs('work/2026'))).toEqual(['Replace turnstile firmware.md']);

    // A different type with the same title is not a duplicate.
    expect(s.createNote({ ...workNote('Replace turnstile firmware'), type: 'reference', kind: 'doc' }).created).toBe(true);
  });

  it('createNote raises duplicate conflict for the same sources and a similar title', () => {
    const s = store();
    const first = s.createNote(workNote('Turnstile firmware rejects mobile tickets', { sources: ['[[A]]', '[[B]]'] }));
    // Similarity 4/6: under 0.85, but the sources set is the same (order and case aside).
    const e = kilnError(() => s.createNote(workNote('Turnstile firmware rejects tickets at gates', { sources: ['[[b]]', '[[A]]'] })));
    expect(e.details).toMatchObject({ reason: 'duplicate', existing: { path: first.path } });
    // Different sources: no conflict at that similarity.
    expect(s.createNote(workNote('Turnstile firmware rejects tickets at gates', { sources: ['[[C]]'] })).created).toBe(true);
  });

  it('createNote treats equal titles made only of stopwords as duplicates', () => {
    const s = store();
    s.createNote(workNote('To be or not'));
    expect(kilnError(() => s.createNote(workNote(' to BE or not '))).code).toBe('conflict');
  });

  it('createNote raises duplicate conflict on an equal dedupe_key', () => {
    const s = store();
    const first = s.createNote(workNote('Stewarding rota', { dedupe_key: 'jira:NWA-7' }));
    const e = kilnError(() => s.createNote(workNote('Radio audit for stewards', { dedupe_key: 'jira:NWA-7' })));
    expect(e.details).toMatchObject({ reason: 'duplicate', existing: { path: first.path } });
  });

  it('createNote with newReason bypasses the duplicate check', () => {
    const s = store();
    const first = s.createNote(workNote('Replace turnstile firmware'));
    const second = s.createNote({ ...workNote('Replace turnstile firmware'), newReason: 'Second stand has a separate rollout' });
    expect(second.created).toBe(true);
    expect(second.id).not.toBe(first.id);
    expect(second.path).toBe('work/2026/Replace turnstile firmware (2).md');
  });

  it('review flag fields round-trip (review: needed, review_reason)', () => {
    const s = store();
    const r = s.createNote(workNote('Gate 4 scanner fault', { confidence: 'inferred', review: 'needed', review_reason: 'inferred from a Slack thread' }));
    const text = read(r.path);
    expect(text).toMatch(/\nreview: needed\nreview_reason: inferred from a Slack thread\n---\n/);
    expect(ix.status().needsReview).toBe(1);
    expect(ix.get(r.path).fields).toMatchObject({ review: 'needed', review_reason: 'inferred from a Slack thread' });

    const u = s.updateNote({ idOrPath: r.id!, ifRevision: r.revision, unset: ['review', 'review_reason'] });
    expect(fieldsOf(u.path)).not.toHaveProperty('review');
    expect(fieldsOf(u.path)).not.toHaveProperty('review_reason');
    expect(ix.status().needsReview).toBe(0);
  });
});

describe('updateNote', () => {
  it('updateNote with stale revision raises conflict and leaves file unchanged', () => {
    const s = store();
    const r = s.createNote(workNote('Fix turnstile firmware'));
    const before = read(r.path);
    const e = kilnError(() => s.updateNote({ idOrPath: r.id!, ifRevision: 'f'.repeat(64), set: { status: 'done' } }));
    expect(e.code).toBe('conflict');
    expect(e.details).toEqual({ reason: 'stale_revision', current: r.revision });
    expect(read(r.path)).toBe(before);
  });

  it('updateNote changes only targeted lines', () => {
    const original = [
      '---',
      'id: 01J9ZK3Q7V2M8N4P6R0S1T2WRK',
      'type: work   # hand-edited',
      'kind: bug',
      'title: "Fix turnstile firmware"',
      'status: active # was blocked',
      'created: 2026-09-01',
      'updated: 2026-09-20',
      'notes: |',
      '  Kept as a block scalar.',
      '  Two lines.',
      'aliases: [Firmware fix, NWA-42]',
      '---',
      '',
      '## Summary',
      'Gates 3 and 4 reject mobile tickets.',
      '',
      '## Checkpoints',
      '- 2026-09-20: vendor contacted.',
      '',
      '## Outcome',
      '',
    ].join('\r\n');
    handWrite('work/2026/Fix turnstile firmware.md', original);

    const r = store().updateNote({
      idOrPath: 'work/2026/Fix turnstile firmware.md',
      ifRevision: rev('work/2026/Fix turnstile firmware.md'),
      set: { status: 'done' },
      sections: [{ heading: 'Checkpoints', mode: 'append', text: '- 2026-10-10: firmware 4.2 deployed.' }],
    });

    const after = read(r.path);
    const a = original.split('\r\n');
    const b = after.split('\r\n');
    expect(after.replace(/\r\n/g, '')).not.toContain('\n');
    const changed = a.slice(0, 19).map((line, i) => (line === b[i] ? null : i)).filter((i) => i !== null);
    expect(changed).toEqual([5, 7]);
    expect(b[5]).toBe('status: done # was blocked');
    expect(b[7]).toBe('updated: 2026-10-10');
    // The appended checkpoint is the only inserted line; everything after it is the original tail.
    expect(b.length).toBe(a.length + 1);
    expect(b[19]).toBe('- 2026-10-10: firmware 4.2 deployed.');
    expect(b.slice(20)).toEqual(a.slice(19));
    expect(r).toEqual({ id: '01J9ZK3Q7V2M8N4P6R0S1T2WRK', path: 'work/2026/Fix turnstile firmware.md', revision: rev(r.path), created: false });
    expect(ix.get(r.id!).fields.status).toBe('done');
  });

  it('updateNote works by path on a hand-written note without frontmatter', () => {
    handWrite('notes/Gate checklist.md', '# Gate checklist\n\nCheck every turnstile before doors open.\n');
    const before = ix.get('notes/Gate checklist.md');
    expect(before.id).toBeNull();

    const r = store().updateNote({
      idOrPath: 'notes/Gate checklist.md',
      ifRevision: before.revision,
      set: { aliases: ['Matchday gate checklist'] },
      sections: [{ heading: 'Open items', mode: 'append', text: 'Spare scanner batteries.' }],
    });

    expect(r.id).toBeNull();
    expect(r.created).toBe(false);
    expect(read(r.path)).toBe(
      '---\nupdated: 2026-10-10\naliases:\n  - Matchday gate checklist\n---\n' +
        '# Gate checklist\n\nCheck every turnstile before doors open.\n\n## Open items\nSpare scanner batteries.\n',
    );
    expect(fieldsOf(r.path)).not.toHaveProperty('id');
    expect(ix.resolve('Matchday gate checklist').matches.map((m) => m.path)).toContain(r.path);
  });

  it('updateNote on a note with unparseable frontmatter raises validation and does not write', () => {
    const text = '---\ntype: work\ntitle: [unclosed\n---\nBody.\n';
    handWrite('work/2026/Broken.md', text);
    const e = kilnError(() => store().updateNote({ idOrPath: 'work/2026/Broken.md', ifRevision: rev('work/2026/Broken.md'), set: { status: 'done' } }));
    expect(e.code).toBe('validation');
    expect(read('work/2026/Broken.md')).toBe(text);
    expect(readdirSync(abs('work/2026'))).toEqual(['Broken.md']);
  });

  it('updateNote validates the merged fields and writes nothing on an invalid value', () => {
    const s = store();
    const r = s.createNote(workNote('Fix turnstile firmware'));
    const before = read(r.path);
    const e = kilnError(() => s.updateNote({ idOrPath: r.id!, ifRevision: r.revision, set: { status: 'finished' } }));
    expect(e.code).toBe('validation');
    expect(e.message).toContain('status');
    expect(read(r.path)).toBe(before);
  });

  it('updateNote of an unknown note raises not_found', () => {
    expect(kilnError(() => store().updateNote({ idOrPath: 'notes/Nope.md', ifRevision: 'x', set: { status: 'done' } })).code).toBe('not_found');
  });
});

describe('markSource', () => {
  it('markSource records triage, triage_outcome and linked_to', () => {
    const s = store();
    const c = s.capture({ kind: 'web', title: 'Stadium news', content: 'New gates open in spring.', url: 'https://news.example/gates' });
    const r = s.markSource({
      idOrPath: c.path,
      ifRevision: c.revision,
      triage: 'linked',
      outcome: 'link-to-anchor',
      linkedTo: ['[[Turnstile Network]]', '[[Gate Upgrade]]'],
    });
    expect(r.created).toBe(false);
    expect(fieldsOf(r.path)).toMatchObject({
      triage: 'linked',
      triage_outcome: 'link-to-anchor',
      linked_to: ['[[Turnstile Network]]', '[[Gate Upgrade]]'],
      updated: '2026-10-10',
    });
    expect(ix.inbox()).toEqual([]);
    expect(splitNote(read(r.path)).body).toBe('New gates open in spring.');
  });

  it('markSource rejects a bad outcome, triage or note type and writes nothing', () => {
    const s = store();
    const c = s.capture({ kind: 'web', title: 'Stadium news', content: 'x' });
    const before = read(c.path);
    expect(kilnError(() => s.markSource({ idOrPath: c.path, ifRevision: c.revision, triage: 'linked', outcome: 'ignore' })).code).toBe('validation');
    expect(
      kilnError(() => s.markSource({ idOrPath: c.path, ifRevision: c.revision, triage: 'pending' as 'linked', outcome: 'dismiss' })).code,
    ).toBe('validation');
    expect(
      kilnError(() => s.markSource({ idOrPath: c.path, ifRevision: c.revision, triage: 'linked', outcome: 'link-to-anchor', linkedTo: ['Turnstile Network'] })).code,
    ).toBe('validation');
    expect(read(c.path)).toBe(before);

    const w = s.createNote(workNote('Fix turnstile firmware'));
    const e = kilnError(() => s.markSource({ idOrPath: w.path, ifRevision: w.revision, triage: 'dismissed', outcome: 'dismiss' }));
    expect(e.code).toBe('validation');
    expect(fieldsOf(w.path)).not.toHaveProperty('triage');
  });

  it('markSource with a stale revision raises conflict', () => {
    const s = store();
    const c = s.capture({ kind: 'web', title: 'Stadium news', content: 'x' });
    expect(kilnError(() => s.markSource({ idOrPath: c.path, ifRevision: '0'.repeat(64), triage: 'dismissed', outcome: 'dismiss' })).details).toMatchObject({
      reason: 'stale_revision',
    });
  });
});

describe('atomic writes', () => {
  it('rename EPERM is retried then raises locked_file and leaves no .kiln-tmp', () => {
    const s = store();
    const r = s.createNote(workNote('Fix turnstile firmware'));
    const before = read(r.path);

    let calls = 0;
    const locked = store({
      rename: () => {
        calls++;
        throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
      },
    });
    const t0 = performance.now();
    const e = kilnError(() => locked.updateNote({ idOrPath: r.id!, ifRevision: r.revision, set: { status: 'done' } }));
    const elapsed = performance.now() - t0;

    expect(e.code).toBe('locked_file');
    expect(e.details).toEqual({ path: r.path });
    expect(calls).toBe(5);
    expect(elapsed).toBeGreaterThanOrEqual(350);
    expect(read(r.path)).toBe(before);
    expect(readdirSync(abs('work/2026'))).toEqual(['Fix turnstile firmware.md']);
    expect(ix.get(r.id!).revision).toBe(r.revision);
    expect(ix.get(r.id!).fields.status).toBe('active');
  });

  it('a rename that succeeds after transient EBUSY completes the write', () => {
    let calls = 0;
    const s = store({
      rename: (from, to) => {
        if (++calls < 3) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
        renameSync(from, to);
      },
    });
    const r = s.capture({ kind: 'note', title: 'Gate idea', content: 'Queue marshals.' });
    expect(calls).toBe(3);
    expect(read(r.path)).toContain('Queue marshals.');
    expect(readdirSync(abs('sources/note'))).toEqual(['2026-10-10 Gate idea.md']);
  });
});


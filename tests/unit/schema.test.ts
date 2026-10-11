import { describe, it, expect } from 'vitest';
import { KINDS, STATUSES, TRIAGE, TRIAGE_OUTCOMES, validateFields } from '../../src/schema.js';
import type { Fields, ValidationIssue } from '../../src/types.js';

const valid = (): Fields => ({
  type: 'work',
  kind: 'bug',
  title: 'Gate scanner drops badges',
  status: 'active',
  created: '2026-10-10',
  updated: '2026-10-10',
  aliases: ['gate scanner bug'],
  summary: 'Scanners at Gate 4 intermittently reject valid badges.',
  sources: ['https://northwind.example/tickets/NW-101'],
  confidence: 'verbatim',
});

const decision = (): Fields => ({
  ...valid(),
  type: 'decision',
  kind: undefined,
  status: 'proposed',
  decided_on: '2026-10-10',
});
const source = (): Fields => ({
  type: 'source',
  kind: 'jira',
  title: 'NW-101',
  captured_at: '2026-10-10T09:30:00.000Z',
  triage: 'pending',
});

const issuesFor = (fields: Fields, claudeWritten = false): ValidationIssue[] =>
  validateFields(fields, { claudeWritten });

/** Asserts exactly one issue on `field`, with a non-empty message and hint. */
function expectIssue(issues: ValidationIssue[], field: string): ValidationIssue {
  const found = issues.filter((i) => i.field === field);
  expect(found, `issues: ${JSON.stringify(issues)}`).toHaveLength(1);
  expect(found[0]!.message).not.toBe('');
  expect(found[0]!.hint).not.toBe('');
  return found[0]!;
}

describe('constants', () => {
  it('defines kinds per spec section 4', () => {
    expect(KINDS.anchor).toEqual(['organisation', 'product', 'service', 'person', 'topic']);
    expect(KINDS.work).toEqual(['feature', 'bug', 'chore', 'incident', 'research']);
    expect(KINDS.reference).toEqual(['doc', 'spec', 'code', 'post', 'thread', 'video', 'dashboard', 'sheet', 'slides']);
    expect(KINDS.source).toEqual(['jira', 'github', 'slack', 'email', 'meeting', 'web', 'note']);
    expect(KINDS.project).toEqual([]);
    expect(KINDS.note).toEqual([]);
    expect(KINDS.decision).toEqual([]);
  });

  it('defines statuses per spec section 4', () => {
    expect(STATUSES.anchor).toEqual(['active', 'archived']);
    expect(STATUSES.project).toEqual(['shaping', 'active', 'paused', 'closing', 'closed']);
    expect(STATUSES.work).toEqual(['active', 'blocked', 'paused', 'done', 'abandoned']);
    expect(STATUSES.decision).toEqual(['proposed', 'active', 'superseded']);
    expect(STATUSES.reference).toEqual(['active', 'archived']);
    expect(STATUSES.source).toEqual([]);
    expect(STATUSES.note).toEqual([]);
  });

  it('defines triage values and outcomes', () => {
    expect(TRIAGE).toEqual(['pending', 'linked', 'dismissed']);
    expect(TRIAGE_OUTCOMES).toEqual([
      'dismiss',
      'link-to-anchor',
      'update-work-item',
      'new-work-item',
      'new-decision',
      'supersede',
      'new-reference',
      'duplicate-of',
    ]);
  });
});

describe('validateFields', () => {
  it('a valid Claude-written work note yields no issues', () => {
    expect(issuesFor(valid(), true)).toEqual([]);
  });

  it('a valid decision, source and bare note yield no issues', () => {
    expect(issuesFor(decision(), true)).toEqual([]);
    expect(issuesFor(source(), true)).toEqual([]);
    expect(issuesFor({ type: 'note', title: 'Scratch' })).toEqual([]);
  });

  it('a missing optional field is not an issue', () => {
    expect(issuesFor({ type: 'work', title: 'Minimal' })).toEqual([]);
  });

  it('requires type', () => {
    const { type: _type, ...rest } = valid();
    expectIssue(issuesFor(rest), 'type');
  });

  it('rejects an unknown type with the list of types', () => {
    const issue = expectIssue(issuesFor({ ...valid(), type: 'epic' }), 'type');
    expect(issue.hint).toContain('anchor');
    expect(issue.hint).toContain('note');
  });

  it('rejects a kind outside the type kinds', () => {
    const issue = expectIssue(issuesFor({ ...valid(), kind: 'epic' }), 'kind');
    expect(issue.hint).toBe('use one of: feature, bug, chore, incident, research');
  });

  it('does not check kind for types without kinds', () => {
    expect(issuesFor({ type: 'project', title: 'P', kind: 'anything' })).toEqual([]);
  });

  it('rejects a status outside the type statuses', () => {
    const issue = expectIssue(issuesFor({ ...valid(), type: 'anchor', kind: 'topic', status: 'done' }), 'status');
    expect(issue.hint).toBe('use one of: active, archived');
  });

  it('does not check status for source or note', () => {
    expect(issuesFor({ ...source(), status: 'whatever' })).toEqual([]);
    expect(issuesFor({ type: 'note', title: 'N', status: 'whatever' })).toEqual([]);
  });

  it('requires a non-empty title', () => {
    expectIssue(issuesFor({ ...valid(), title: '' }), 'title');
    expectIssue(issuesFor({ ...valid(), title: '   ' }), 'title');
    expectIssue(issuesFor({ ...valid(), title: 42 }), 'title');
  });

  it('requires title on Claude-written notes only', () => {
    const { title: _title, ...rest } = valid();
    expectIssue(issuesFor(rest, true), 'title');
    expect(issuesFor(rest, false)).toEqual([]);
    expect(issuesFor({ type: 'work', status: 'active' })).toEqual([]);
  });

  it('still rejects a present but blank title when not Claude-written', () => {
    expectIssue(issuesFor({ ...valid(), title: '' }, false), 'title');
  });

  it.each(['created', 'updated'])('%s must be an ISO date', (field) => {
    const issue = expectIssue(issuesFor({ ...valid(), [field]: '10/10/2026' }), field);
    expect(issue.hint).toBe('use YYYY-MM-DD');
    expectIssue(issuesFor({ ...valid(), [field]: '2026-02-30' }), field);
    expectIssue(issuesFor({ ...valid(), [field]: '2026-10-10T09:30:00.000Z' }), field);
    expectIssue(issuesFor({ ...valid(), [field]: 20261010 }), field);
    expect(issuesFor({ ...valid(), [field]: '2028-02-29' })).toEqual([]);
  });

  it.each(['aliases', 'keywords', 'anchors', 'sources'])('%s must be an array of strings', (field) => {
    const value = field === 'anchors' ? '[[Gate]]' : 'one';
    expectIssue(issuesFor({ ...valid(), [field]: value }), field);
    expectIssue(issuesFor({ ...valid(), [field]: ['ok', 3] }), field);
  });

  it('anchors items must be wikilinks', () => {
    expectIssue(issuesFor({ ...valid(), anchors: ['Gate Scanners'] }), 'anchors');
    expectIssue(issuesFor({ ...valid(), anchors: ['[[]]'] }), 'anchors');
    expectIssue(issuesFor({ ...valid(), anchors: ['[[a]] and [[b]]'] }), 'anchors');
    expect(issuesFor({ ...valid(), anchors: ['[[Gate Scanners]]', '[[Northwind Arena|NA]]'] })).toEqual([]);
  });

  it('confidence must be verbatim or inferred', () => {
    const issue = expectIssue(issuesFor({ ...valid(), confidence: 'guess' }), 'confidence');
    expect(issue.hint).toBe('use one of: verbatim, inferred');
  });

  it('review, if present, must be needed', () => {
    const issue = expectIssue(issuesFor({ ...valid(), review: 'done' }), 'review');
    expect(issue.hint).toBe('use: needed');
    expect(issuesFor({ ...valid(), review: 'needed' })).toEqual([]);
  });

  describe('Claude-written notes', () => {
    it.each(['summary', 'aliases', 'sources', 'confidence'])('require %s', (field) => {
      const fields = valid();
      delete fields[field];
      expectIssue(issuesFor(fields, true), field);
      expect(issuesFor(fields, false)).toEqual([]);
    });

    it('require at least one alias and one source', () => {
      expectIssue(issuesFor({ ...valid(), aliases: [] }, true), 'aliases');
      expectIssue(issuesFor({ ...valid(), sources: [] }, true), 'sources');
    });

    it('require a non-empty summary', () => {
      expectIssue(issuesFor({ ...valid(), summary: '  ' }, true), 'summary');
    });

    it('do not apply to sources', () => {
      expect(issuesFor(source(), true)).toEqual([]);
    });

    it('report a malformed field once, not also as missing', () => {
      expectIssue(issuesFor({ ...valid(), aliases: 'nick' }, true), 'aliases');
    });
  });

  describe('decision', () => {
    it('requires decided_on', () => {
      const fields = decision();
      delete fields.decided_on;
      expectIssue(issuesFor(fields), 'decided_on');
    });

    it('decided_on must be an ISO date', () => {
      const issue = expectIssue(issuesFor({ ...decision(), decided_on: '2026-13-01' }), 'decided_on');
      expect(issue.hint).toBe('use YYYY-MM-DD');
    });

    it.each(['supersedes', 'superseded_by'])('%s must be a wikilink array', (field) => {
      expectIssue(issuesFor({ ...decision(), [field]: '[[Old]]' }), field);
      expectIssue(issuesFor({ ...decision(), [field]: ['Old'] }), field);
      expect(issuesFor({ ...decision(), [field]: ['[[Old]]'] })).toEqual([]);
    });
  });

  describe('source', () => {
    it.each(['captured_at', 'triage'])('requires %s', (field) => {
      const fields = source();
      delete fields[field];
      expectIssue(issuesFor(fields), field);
    });

    it('triage must be a known value', () => {
      const issue = expectIssue(issuesFor({ ...source(), triage: 'later' }), 'triage');
      expect(issue.hint).toBe('use one of: pending, linked, dismissed');
    });

    it('captured_at accepts an ISO date or datetime', () => {
      expect(issuesFor({ ...source(), captured_at: '2026-10-10' })).toEqual([]);
      expect(issuesFor({ ...source(), captured_at: new Date().toISOString() })).toEqual([]);
      expect(issuesFor({ ...source(), captured_at: '2026-10-10T09:30:00+01:00' })).toEqual([]);
    });

    it('captured_at rejects other shapes', () => {
      const issue = expectIssue(issuesFor({ ...source(), captured_at: 'yesterday' }), 'captured_at');
      expect(issue.hint).toContain('YYYY-MM-DD');
      expectIssue(issuesFor({ ...source(), captured_at: '2026-02-30T09:30:00Z' }), 'captured_at');
      expectIssue(issuesFor({ ...source(), captured_at: '2026-10-10T25:00:00Z' }), 'captured_at');
    });

    it('captured_by must be manual or watcher', () => {
      const issue = expectIssue(issuesFor({ ...source(), captured_by: 'robot' }), 'captured_by');
      expect(issue.hint).toBe('use one of: manual, watcher');
      expect(issuesFor({ ...source(), captured_by: 'manual' })).toEqual([]);
    });
  });

  describe('organisation role', () => {
    const org = (): Fields => ({ type: 'anchor', kind: 'organisation', title: 'Northwind Arena' });

    it('accepts a known role and a missing role', () => {
      expect(issuesFor({ ...org(), role: 'client' })).toEqual([]);
      expect(issuesFor(org())).toEqual([]);
    });

    it('rejects an unknown role', () => {
      const issue = expectIssue(issuesFor({ ...org(), role: 'rival' }), 'role');
      expect(issue.hint).toBe('use one of: client, vendor, partner, self');
    });
  });

  it('returns every issue, not just the first', () => {
    const issues = issuesFor({ type: 'work', kind: 'epic', title: '', status: 'nope', created: 'x', review: 'maybe' });
    expect(issues.map((i) => i.field).sort()).toEqual(['created', 'kind', 'review', 'status', 'title']);
  });
});

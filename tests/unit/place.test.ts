import { describe, it, expect } from 'vitest';
import { newId, safeFileName, placeNote } from '../../src/place.js';
import { KilnError } from '../../src/types.js';

const never = () => false;

describe('safeFileName', () => {
  it('strips Windows-illegal chars', () => {
    expect(safeFileName('Q3: plan? <draft>')).toBe('Q3 plan draft');
  });

  it('removes path separators, pipes, quotes, asterisks and control characters', () => {
    expect(safeFileName('a/b\\c|d"e*f\u0000g\u001fh\u007fi')).toBe('abcdefghi');
  });

  it('collapses whitespace and trims trailing dots and spaces', () => {
    expect(safeFileName('  Gate   scanner \t\n plan . . ')).toBe('Gate scanner plan');
  });

  it('returns untitled when nothing is left', () => {
    expect(safeFileName('')).toBe('untitled');
    expect(safeFileName('???')).toBe('untitled');
    expect(safeFileName(' ... ')).toBe('untitled');
  });

  it('truncates to 120 characters', () => {
    expect(safeFileName('a'.repeat(300))).toHaveLength(120);
  });

  it('does not split a surrogate pair when truncating', () => {
    const out = safeFileName('a'.repeat(119) + '\u{1F600}tail');
    expect(out).toBe('a'.repeat(119));
    expect(out).not.toMatch(/[\ud800-\udfff]/);
  });

  it('returns untitled when truncation leaves only dots and spaces', () => {
    expect(safeFileName('.'.repeat(130) + 'a')).toBe('untitled');
    expect(safeFileName('. '.repeat(70) + 'a')).toBe('untitled');
    expect(placeNote({ type: 'note', title: '.'.repeat(130) + 'a' }, never)).toBe('notes/untitled.md');
  });

  it('retrims after truncating', () => {
    expect(safeFileName('a'.repeat(119) + ' b')).toBe('a'.repeat(119));
  });

  it('guards Windows reserved device names, case-insensitively and with suffixes', () => {
    expect(safeFileName('CON')).toBe('CON_');
    expect(safeFileName('nul')).toBe('nul_');
    expect(safeFileName('Com1')).toBe('Com1_');
    expect(safeFileName('LPT9')).toBe('LPT9_');
    expect(safeFileName('aux.txt')).toBe('aux.txt_');
    expect(safeFileName('PRN.')).toBe('PRN_');
    expect(safeFileName('CON .v2')).toBe('CON .v2_');
  });

  it('leaves names that merely start with a reserved word alone', () => {
    expect(safeFileName('Console plan')).toBe('Console plan');
    expect(safeFileName('COM0')).toBe('COM0');
    expect(safeFileName('Northwind CON')).toBe('Northwind CON');
  });

  it('keeps the result within 120 characters even when a reserved name is long', () => {
    const out = safeFileName('con.' + 'a'.repeat(300));
    expect(out).toHaveLength(120);
    expect(out.endsWith('_')).toBe(true);
  });
});

describe('placeNote', () => {
  it('puts anchors under their kind', () => {
    expect(placeNote({ type: 'anchor', kind: 'person', title: 'Ada Reyes' }, never)).toBe(
      'anchors/person/Ada Reyes.md',
    );
  });

  it('puts projects, references and notes in their flat folders', () => {
    expect(placeNote({ type: 'project', title: 'Gate Modernisation' }, never)).toBe('projects/Gate Modernisation.md');
    expect(placeNote({ type: 'reference', kind: 'doc', title: 'Runbook' }, never)).toBe('references/Runbook.md');
    expect(placeNote({ type: 'note', title: 'Idea' }, never)).toBe('notes/Idea.md');
  });

  it('puts work under the year of created', () => {
    expect(
      placeNote({ type: 'work', kind: 'bug', title: 'Gate scanner drops badges', created: '2026-10-10' }, never),
    ).toBe('work/2026/Gate scanner drops badges.md');
  });

  it('puts decisions under year with date prefix', () => {
    expect(
      placeNote({ type: 'decision', title: 'Adopt QR badges', decided_on: '2025-12-31', created: '2026-01-02' }, never),
    ).toBe('decisions/2025/2025-12-31 Adopt QR badges.md');
  });

  it('puts sources under kind with the captured_at date prefix, for dates and datetimes', () => {
    expect(
      placeNote({ type: 'source', kind: 'jira', title: 'NW-101', captured_at: '2026-10-10T09:30:00.000Z' }, never),
    ).toBe('sources/jira/2026-10-10 NW-101.md');
    expect(placeNote({ type: 'source', kind: 'note', title: 'Call', captured_at: '2026-10-11' }, never)).toBe(
      'sources/note/2026-10-11 Call.md',
    );
  });

  it('sanitises the title', () => {
    expect(placeNote({ type: 'note', title: 'Q3: plan?' }, never)).toBe('notes/Q3 plan.md');
  });

  it('suffixes (2) on collision', () => {
    const taken = new Set(['notes/Idea.md']);
    expect(placeNote({ type: 'note', title: 'Idea' }, (rel) => taken.has(rel))).toBe('notes/Idea (2).md');
  });

  it('keeps counting past existing suffixes and passes the candidate relative path to exists', () => {
    const taken = new Set(['decisions/2026/2026-01-05 Pick DB.md', 'decisions/2026/2026-01-05 Pick DB (2).md']);
    const seen: string[] = [];
    const out = placeNote({ type: 'decision', title: 'Pick DB', decided_on: '2026-01-05' }, (rel) => {
      seen.push(rel);
      return taken.has(rel);
    });
    expect(out).toBe('decisions/2026/2026-01-05 Pick DB (3).md');
    expect(seen).toEqual([
      'decisions/2026/2026-01-05 Pick DB.md',
      'decisions/2026/2026-01-05 Pick DB (2).md',
      'decisions/2026/2026-01-05 Pick DB (3).md',
    ]);
  });

  it('falls back to untitled when the title is missing', () => {
    expect(placeNote({ type: 'note' }, never)).toBe('notes/untitled.md');
  });

  it.each([
    ['work without created', { type: 'work', kind: 'bug', title: 'x' }, 'created'],
    ['work with malformed created', { type: 'work', kind: 'bug', title: 'x', created: 'yesterday' }, 'created'],
    ['decision without decided_on', { type: 'decision', title: 'x' }, 'decided_on'],
    ['decision with malformed decided_on', { type: 'decision', title: 'x', decided_on: '2026-1-5' }, 'decided_on'],
    ['source without captured_at', { type: 'source', kind: 'jira', title: 'x' }, 'captured_at'],
    [
      'source with malformed captured_at',
      { type: 'source', kind: 'jira', title: 'x', captured_at: 'soon' },
      'captured_at',
    ],
    ['anchor without kind', { type: 'anchor', title: 'x' }, 'kind'],
    ['anchor with unknown kind', { type: 'anchor', kind: '../escape', title: 'x' }, 'kind'],
    ['source without kind', { type: 'source', title: 'x', captured_at: '2026-10-10' }, 'kind'],
    ['source with unknown kind', { type: 'source', kind: 'fax', title: 'x', captured_at: '2026-10-10' }, 'kind'],
  ])('throws a validation error naming the field: %s', (_label, fields, field) => {
    let caught: unknown;
    try {
      placeNote(fields, never);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(KilnError);
    expect((caught as KilnError).code).toBe('validation');
    expect((caught as KilnError).message).toContain(field);
  });

  it('throws a validation error for a missing or unknown type', () => {
    expect(() => placeNote({ title: 'x' }, never)).toThrow(KilnError);
    expect(() => placeNote({ type: 'bogus', title: 'x' }, never)).toThrow(/type/);
  });
});

describe('newId', () => {
  it('returns 26-char ULIDs that sort by time', () => {
    const ids = Array.from({ length: 200 }, () => newId());
    for (const id of ids) expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(new Set(ids).size).toBe(200);
    expect([...ids].sort()).toEqual(ids);
  });
});

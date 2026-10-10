import { describe, it, expect } from 'vitest';
import { parseFields, renderNote, renderScalar, splitNote } from '../../src/frontmatter.js';
import { KilnError } from '../../src/types.js';

describe('splitNote', () => {
  it('handles no frontmatter', () => {
    const text = '# Just a body\n\nNo fence here.\n';
    const r = splitNote(text);
    expect(r.fmText).toBeNull();
    expect(r.body).toBe(text);
    expect(r.eol).toBe('\n');
    expect([r.fmStart, r.fmEnd]).toEqual([0, 0]);
  });

  it('splits LF frontmatter with exact offsets', () => {
    const text = '---\nid: a\ntitle: T\n---\n## Body\n';
    const r = splitNote(text);
    expect(r.fmText).toBe('id: a\ntitle: T\n');
    expect(r.body).toBe('## Body\n');
    expect(r.eol).toBe('\n');
    expect(text.slice(r.fmStart, r.fmEnd)).toBe(r.fmText);
    expect(text.slice(0, r.fmStart)).toBe('---\n');
    expect(text.slice(r.fmEnd).startsWith('---\n')).toBe(true);
  });

  it('detects CRLF', () => {
    const text = '---\r\nid: a\r\ntitle: T\r\n---\r\n## Body\r\n';
    const r = splitNote(text);
    expect(r.eol).toBe('\r\n');
    expect(r.fmText).toBe('id: a\r\ntitle: T\r\n');
    expect(r.body).toBe('## Body\r\n');
    expect(text.slice(r.fmStart, r.fmEnd)).toBe(r.fmText);
    expect(text.slice(0, r.fmStart)).toBe('---\r\n');
    expect(text.slice(r.fmEnd)).toBe('---\r\n## Body\r\n');
  });

  it('yields an empty fmText for an empty block', () => {
    const lf = splitNote('---\n---\nbody\n');
    expect(lf.fmText).toBe('');
    expect(lf.body).toBe('body\n');
    expect([lf.fmStart, lf.fmEnd]).toEqual([4, 4]);
    const crlf = splitNote('---\r\n---\r\nbody\r\n');
    expect(crlf.fmText).toBe('');
    expect(crlf.eol).toBe('\r\n');
    expect([crlf.fmStart, crlf.fmEnd]).toEqual([5, 5]);
  });

  it('accepts a closing fence at end of file without a trailing newline', () => {
    const text = '---\nid: a\n---';
    const r = splitNote(text);
    expect(r.fmText).toBe('id: a\n');
    expect(r.body).toBe('');
    expect(r.fmEnd).toBe(text.length - 3);
  });

  it('only treats a line that is exactly --- as the closing fence', () => {
    const r = splitNote('---\nid: a\nnote: x\n----\n--- \n---\nbody\n');
    expect(r.fmText).toBe('id: a\nnote: x\n----\n--- \n');
    expect(r.body).toBe('body\n');
  });

  it('requires the opening fence at byte 0', () => {
    for (const text of ['\n---\nid: a\n---\nbody\n', ' ---\nid: a\n---\n', '----\nid: a\n---\n']) {
      const r = splitNote(text);
      expect(r.fmText).toBeNull();
      expect(r.body).toBe(text);
    }
  });

  it('treats an unterminated block as no frontmatter', () => {
    const text = '---\nid: a\nbody forever\n';
    const r = splitNote(text);
    expect(r.fmText).toBeNull();
    expect(r.body).toBe(text);
  });

  it('detects CRLF in a note without frontmatter', () => {
    expect(splitNote('line one\r\nline two\r\n').eol).toBe('\r\n');
  });
});

describe('parseFields', () => {
  it('returns an empty object for null and empty input', () => {
    expect(parseFields(null)).toEqual({});
    expect(parseFields('')).toEqual({});
    expect(parseFields('# only a comment\n')).toEqual({});
  });

  it('parses scalars and lists, leaving dates as strings', () => {
    const f = parseFields('id: a\ncreated: 2026-10-10\ncount: 3\nok: true\nanchors:\n  - "[[A]]"\n  - "[[B]]"\n');
    expect(f).toEqual({ id: 'a', created: '2026-10-10', count: 3, ok: true, anchors: ['[[A]]', '[[B]]'] });
    expect(typeof f.created).toBe('string');
  });

  it('parses CRLF text', () => {
    expect(parseFields('id: a\r\ntitle: T\r\n')).toEqual({ id: 'a', title: 'T' });
  });

  it('throws validation on bad YAML', () => {
    expect(() => parseFields('id: [unclosed\n')).toThrow(KilnError);
    try {
      parseFields('id: [unclosed\n');
    } catch (e) {
      expect((e as KilnError).code).toBe('validation');
    }
  });

  it('throws validation on duplicate keys', () => {
    expect(() => parseFields('id: a\nid: b\n')).toThrow(KilnError);
  });

  it('throws validation when the frontmatter is not a mapping', () => {
    expect(() => parseFields('- a\n- b\n')).toThrow(KilnError);
    expect(() => parseFields('just text\n')).toThrow(KilnError);
  });
});

describe('renderScalar', () => {
  it('quotes wikilinks, colons and booleans', () => {
    expect(renderScalar('[[A]]')).toBe('"[[A]]"');
    expect(renderScalar('a: b')).toBe('"a: b"');
    expect(renderScalar('true')).toBe('"true"');
  });

  it('leaves safe strings plain', () => {
    expect(renderScalar('Gate scanning (v2)')).toBe('Gate scanning (v2)');
    expect(renderScalar('a/b, c-d_e.f')).toBe('a/b, c-d_e.f');
  });

  it('quotes reserved words, numeric-looking strings and empty strings', () => {
    for (const s of ['false', 'null', '~', 'True', 'NULL', '', '42', '-1.5', '1e3', '0x1F', '.inf', '.nan', '2026']) {
      expect(renderScalar(s)).toBe(JSON.stringify(s));
    }
  });

  it('quotes strings with leading/trailing spaces, leading dashes and other YAML-significant starts', () => {
    for (const s of [' a', 'a ', '- a', '-', ',a']) {
      expect(renderScalar(s)).toBe(JSON.stringify(s));
    }
  });

  it('keeps a date-looking string plain and round-trips it as a string', () => {
    expect(renderScalar('2026-10-10')).toBe('2026-10-10');
    expect(parseFields(`created: ${renderScalar('2026-10-10')}\n`)).toEqual({ created: '2026-10-10' });
  });

  it('quotes non-ASCII and multi-line strings as JSON', () => {
    expect(renderScalar('line1\nline2')).toBe('"line1\\nline2"');
    expect(renderScalar('caf\u00e9')).toBe('"caf\u00e9"');
  });

  it('renders numbers, booleans and null bare', () => {
    expect(renderScalar(3)).toBe('3');
    expect(renderScalar(-1.5)).toBe('-1.5');
    expect(renderScalar(true)).toBe('true');
    expect(renderScalar(false)).toBe('false');
    expect(renderScalar(null)).toBe('null');
  });

  it('rejects non-finite numbers', () => {
    expect(() => renderScalar(Number.NaN)).toThrow(KilnError);
    expect(() => renderScalar(Number.POSITIVE_INFINITY)).toThrow(KilnError);
  });

  it('round-trips awkward strings as both mapping values and list items', () => {
    const awkward = [
      'a: b', '[[A]]', '- a', ',a', '#x', 'x #y', 'null', '-', '?', '&a', '*a', '!t', '%x', '@x', '`x',
      '|', '>', '"q"', "it's", 'a\tb', ' pad ', '0o7', '+1', '1_000', 'Yes', 'no',
    ];
    for (const s of awkward) {
      expect(parseFields(`k: ${renderScalar(s)}\n`)).toEqual({ k: s });
      expect(parseFields(`k:\n  - ${renderScalar(s)}\n`)).toEqual({ k: [s] });
    }
  });
});

describe('renderNote', () => {
  const decision = {
    summary: 'Use Postgres for ticketing.',
    title: 'Adopt Postgres',
    id: '01JTEST0000000000000000000',
    type: 'decision',
    status: 'active',
    anchors: ['[[Northwind Arena]]', '[[Ticketing]]'],
    decided_on: '2026-10-10',
    created: '2026-10-10',
    updated: '2026-10-10',
    aliases: [],
    confidence: 'verbatim',
    review_reason: 'check with finance',
    review: 'needed',
    skipped: undefined,
  };
  const sections = [
    { heading: 'Context', text: 'Ticketing needs a store.' },
    { heading: 'Decision', text: 'Use Postgres.' },
    { heading: 'Consequences', text: '' },
  ];

  it('orders keys and renders block lists', () => {
    const expected = [
      '---',
      'id: 01JTEST0000000000000000000',
      'type: decision',
      'title: Adopt Postgres',
      'status: active',
      'created: 2026-10-10',
      'updated: 2026-10-10',
      'aliases: []',
      'summary: Use Postgres for ticketing.',
      'anchors:',
      '  - "[[Northwind Arena]]"',
      '  - "[[Ticketing]]"',
      'confidence: verbatim',
      'decided_on: 2026-10-10',
      'review: needed',
      'review_reason: check with finance',
      '---',
      '',
      '## Context',
      'Ticketing needs a store.',
      '',
      '## Decision',
      'Use Postgres.',
      '',
      '## Consequences',
      '',
    ].join('\n');
    expect(renderNote(decision, sections)).toBe(expected);
  });

  it('renders remaining keys in insertion order after the known ones', () => {
    const out = renderNote({ zeta: 1, type: 'note', alpha: true, id: 'x', nothing: null }, []);
    expect(out).toBe('---\nid: x\ntype: note\nzeta: 1\nalpha: true\nnothing: null\n---\n');
  });

  it('uses CRLF throughout when asked', () => {
    const out = renderNote({ id: 'x', anchors: ['[[A]]'] }, [{ heading: 'Summary', text: 'a\nb' }], '\r\n');
    expect(out).toBe('---\r\nid: x\r\nanchors:\r\n  - "[[A]]"\r\n---\r\n\r\n## Summary\r\na\r\nb\r\n');
    expect(out.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
  });

  it('does not double blank lines when section text ends with a newline', () => {
    const out = renderNote({ id: 'x' }, [{ heading: 'A', text: 'one\n' }, { heading: 'B', text: 'two\r\n\r\n' }]);
    expect(out).toBe('---\nid: x\n---\n\n## A\none\n\n## B\ntwo\n');
  });

  it('renders no body when there are no sections', () => {
    expect(renderNote({ id: 'x' }, [])).toBe('---\nid: x\n---\n');
  });

  it('round-trips through parseFields (deep equal)', () => {
    const fields = {
      id: '01JTEST0000000000000000000',
      type: 'work',
      kind: 'bug',
      title: 'Gate: scanner "fails" on [[QR]] codes',
      status: 'active',
      created: '2026-10-10',
      updated: '2026-10-10',
      aliases: [],
      summary: 'Two\nlines, with: colons',
      keywords: ['true', '42', 'null', 'plain words'],
      anchors: ['[[Northwind Arena]]'],
      sources: ['jira:NW-12'],
      confidence: 'inferred',
      count: 7,
      flag: false,
      empty: null,
      ticket: 'NW-12',
      review: 'needed',
      review_reason: '',
    };
    const text = renderNote(fields, [{ heading: 'Summary', text: 'x' }]);
    const split = splitNote(text);
    expect(split.body).toBe('\n## Summary\nx\n');
    expect(parseFields(split.fmText)).toEqual(fields);
    const crlf = renderNote(fields, [{ heading: 'Summary', text: 'x' }], '\r\n');
    expect(parseFields(splitNote(crlf).fmText)).toEqual(fields);
  });

  it('throws validation on nested objects instead of guessing', () => {
    expect(() => renderNote({ id: 'x', nested: { a: 1 } }, [])).toThrow(KilnError);
    expect(() => renderNote({ id: 'x', list: [{ a: 1 }] }, [])).toThrow(KilnError);
    expect(() => renderNote({ id: 'x', list: [['a']] }, [])).toThrow(KilnError);
    try {
      renderNote({ nested: { a: 1 } }, []);
    } catch (e) {
      expect((e as KilnError).code).toBe('validation');
    }
  });
});

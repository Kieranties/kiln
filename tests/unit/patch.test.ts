import { describe, it, expect } from 'vitest';
import { patchFields } from '../../src/patch.js';
import { parseFields, splitNote } from '../../src/frontmatter.js';
import { KilnError } from '../../src/types.js';

const BOM = String.fromCharCode(0xfeff);

/** Join lines with LF and end with a trailing LF. */
const lf = (...ls: string[]) => ls.join('\n') + '\n';
/** Join lines with CRLF and end with a trailing CRLF. */
const crlf = (...ls: string[]) => ls.join('\r\n') + '\r\n';
/** Parse the patched note's frontmatter, proving it is still valid YAML inside an intact fence. */
const fieldsOf = (text: string) => {
  const { fmText } = splitNote(text);
  expect(fmText).not.toBeNull();
  return parseFields(fmText);
};
/** Number of line positions that differ (both texts must have the same line count). */
const changedLines = (a: string, b: string) => {
  const al = a.split('\n');
  const bl = b.split('\n');
  expect(bl.length).toBe(al.length);
  return al.filter((line, i) => line !== bl[i]).length;
};

describe('patchFields', () => {
  it('changes only the targeted scalar line', () => {
    const input = lf(
      '---',
      'id: 01JTEST0000000000000000001',
      'type: work',
      'kind: bug',
      'title: Gate scanners reject QR codes',
      'status: active',
      'created: 2026-10-01',
      'updated: 2026-10-02',
      'summary: Scanners at gate B reject mobile QR codes.',
      'confidence: verbatim',
      'ticket: NW-12',
      '---',
      '',
      '## Summary',
      'Gate B scanners fail on phone screens.',
    );
    const out = patchFields(input, { status: 'done' });
    expect(out).toBe(
      lf(
        '---',
        'id: 01JTEST0000000000000000001',
        'type: work',
        'kind: bug',
        'title: Gate scanners reject QR codes',
        'status: done',
        'created: 2026-10-01',
        'updated: 2026-10-02',
        'summary: Scanners at gate B reject mobile QR codes.',
        'confidence: verbatim',
        'ticket: NW-12',
        '---',
        '',
        '## Summary',
        'Gate B scanners fail on phone screens.',
      ),
    );
    expect(changedLines(input, out)).toBe(1);
  });

  it('preserves comments and blank lines elsewhere', () => {
    const input = lf(
      '---',
      '# Northwind Arena ticket',
      'id: a',
      '',
      'title: Old title   # shown in lists',
      '# lifecycle',
      'status: active',
      '',
      '',
      'tags:',
      '  # the first tag matters',
      '  - gate',
      '---',
      'body',
    );
    const out = patchFields(input, { status: 'done' });
    expect(out).toBe(
      lf(
        '---',
        '# Northwind Arena ticket',
        'id: a',
        '',
        'title: Old title   # shown in lists',
        '# lifecycle',
        'status: done',
        '',
        '',
        'tags:',
        '  # the first tag matters',
        '  - gate',
        '---',
        'body',
      ),
    );
    expect(changedLines(input, out)).toBe(1);
  });

  it('preserves a block scalar (|) under another key', () => {
    const input = lf(
      '---',
      'id: a',
      'description: |',
      '  Line one',
      '    indented: not a key',
      '',
      '  after a blank line',
      'status: active',
      'notes: >-',
      '  folded',
      '  text',
      '---',
    );
    const out = patchFields(input, { status: 'done', id: 'b' });
    expect(out).toBe(
      lf(
        '---',
        'id: b',
        'description: |',
        '  Line one',
        '    indented: not a key',
        '',
        '  after a blank line',
        'status: done',
        'notes: >-',
        '  folded',
        '  text',
        '---',
      ),
    );
    expect(fieldsOf(out)).toEqual({
      id: 'b',
      description: 'Line one\n  indented: not a key\n\nafter a blank line\n',
      status: 'done',
      notes: 'folded text',
    });
  });

  it('keeps flow-list style when replacing a flow list', () => {
    const input = lf('---', 'id: a', 'keywords:  [gate, "QR code", scanner]  # search terms', 'status: active', '---');
    const out = patchFields(input, { keywords: ['gate', 'a, b', '[[QR]]', 'plain words', 'true', 'x{y}'] });
    expect(out).toBe(
      lf(
        '---',
        'id: a',
        'keywords:  [gate, "a, b", "[[QR]]", plain words, "true", "x{y}"]  # search terms',
        'status: active',
        '---',
      ),
    );
    expect(fieldsOf(out).keywords).toEqual(['gate', 'a, b', '[[QR]]', 'plain words', 'true', 'x{y}']);
  });

  it('keeps block-list indent when replacing a block list', () => {
    const input = lf(
      '---',
      'anchors:',
      '    - "[[Northwind Arena]]"',
      '    - "[[Ticketing]]"',
      'sources:',
      '-   jira:NW-1',
      'status: active',
      '---',
    );
    const out = patchFields(input, { anchors: ['[[Gate B]]', 'plain'], sources: ['jira:NW-2', 'web'] });
    expect(out).toBe(
      lf(
        '---',
        'anchors:',
        '    - "[[Gate B]]"',
        '    - plain',
        'sources:',
        '-   "jira:NW-2"',
        '-   web',
        'status: active',
        '---',
      ),
    );
    expect(fieldsOf(out)).toEqual({
      anchors: ['[[Gate B]]', 'plain'],
      sources: ['jira:NW-2', 'web'],
      status: 'active',
    });
  });

  it("preserves single-quoted style for a scalar ('x' -> 'y')", () => {
    expect(patchFields(lf('---', "title: 'x'", '---'), { title: 'y' })).toBe(lf('---', "title: 'y'", '---'));
    // embedded quotes are doubled; a newline falls back to the double-quoted form
    const out = patchFields(lf('---', "title: 'x'", "owner: 'ops'", '---'), { title: "it's: [[A]]", owner: 'a\nb' });
    expect(out).toBe(lf('---', "title: 'it''s: [[A]]'", 'owner: "a\\nb"', '---'));
    expect(fieldsOf(out)).toEqual({ title: "it's: [[A]]", owner: 'a\nb' });
  });

  it('keeps double quotes on a double-quoted scalar, and quotes a plain original only when needed', () => {
    const input = lf('---', 'title: "Old"', 'summary: Plain text', 'kind: bug', '---');
    const out = patchFields(input, { title: 'New', summary: 'Gate: B', kind: 'feature' });
    expect(out).toBe(lf('---', 'title: "New"', 'summary: "Gate: B"', 'kind: feature', '---'));
    expect(fieldsOf(out)).toEqual({ title: 'New', summary: 'Gate: B', kind: 'feature' });
  });

  it('renders numbers, booleans and null bare over any scalar style', () => {
    const input = lf('---', 'count: "3"', "flag: 'no'", 'size: big', "review: 'x'", '---');
    const out = patchFields(input, { count: 4, flag: true, size: -1.5, review: null });
    expect(out).toBe(lf('---', 'count: 4', 'flag: true', 'size: -1.5', 'review: null', '---'));
    expect(fieldsOf(out)).toEqual({ count: 4, flag: true, size: -1.5, review: null });
  });

  it('keeps a trailing inline comment', () => {
    const input = lf(
      '---',
      'status: active # lifecycle',
      'title: "Old # not a comment" # display',
      "owner: 'ops'  # team",
      'tags: [a] # flow',
      'review:   # set by triage',
      '---',
    );
    const out = patchFields(input, { status: 'done', title: 'New', owner: 'gate', tags: ['b'], review: 'needed' });
    expect(out).toBe(
      lf(
        '---',
        'status: done # lifecycle',
        'title: "New" # display',
        "owner: 'gate'  # team",
        'tags: [b] # flow',
        'review: needed   # set by triage',
        '---',
      ),
    );
    expect(fieldsOf(out)).toEqual({ status: 'done', title: 'New', owner: 'gate', tags: ['b'], review: 'needed' });
  });

  it('appends a new key before closing fence', () => {
    const input = lf('---', 'id: a', '', '---', 'body');
    const out = patchFields(input, { zeta: 1, review: 'needed', anchors: ['[[A]]'], aliases: [], status: 'active' });
    expect(out).toBe(
      lf(
        '---',
        'id: a',
        '',
        'status: active',
        'aliases: []',
        'anchors:',
        '  - "[[A]]"',
        'zeta: 1',
        'review: needed',
        '---',
        'body',
      ),
    );
  });

  it('appends into an empty frontmatter block', () => {
    expect(patchFields('---\n---\nbody\n', { id: 'x' })).toBe('---\nid: x\n---\nbody\n');
  });

  it('unset removes the whole key range', () => {
    const input = lf(
      '---',
      'id: a',
      'anchors:',
      '  - "[[A]]"',
      '',
      '  - "[[B]]"',
      '  # trailing comment in the list',
      '',
      'status: active',
      'review: needed',
      '---',
      'body',
    );
    const out = patchFields(input, {}, ['anchors', 'review', 'missing']);
    expect(out).toBe(lf('---', 'id: a', '', 'status: active', '---', 'body'));
  });

  it('applies set, unset and new keys together, and unset wins over set', () => {
    const input = lf('---', 'id: a', 'status: active', 'review: needed', '---');
    const out = patchFields(input, { status: 'done', review: 'x', updated: '2026-10-10' }, ['review']);
    expect(out).toBe(lf('---', 'id: a', 'status: done', 'updated: 2026-10-10', '---'));
  });

  it('renders in renderNote style when the shape changes', () => {
    const input = lf(
      '---',
      'keywords: gate # was a scalar',
      'anchors:',
      '  - "[[A]]"',
      'aliases: []',
      'sources:',
      '    - web',
      'review:',
      'summary: null',
      'notes: |',
      '  text',
      'extra:',
      '  nested: map',
      '---',
    );
    const out = patchFields(input, {
      keywords: ['a', 'b'],
      anchors: 'Single',
      aliases: ['Gate B'],
      sources: [],
      review: 'needed',
      summary: 'Now set',
      notes: 'short',
      extra: ['x'],
    });
    expect(out).toBe(
      lf(
        '---',
        'keywords: # was a scalar',
        '  - a',
        '  - b',
        'anchors: Single',
        'aliases:',
        '  - Gate B',
        'sources: []',
        'review: needed',
        'summary: Now set',
        'notes: short',
        'extra:',
        '  - x',
        '---',
      ),
    );
    expect(fieldsOf(out)).toEqual({
      keywords: ['a', 'b'],
      anchors: 'Single',
      aliases: ['Gate B'],
      sources: [],
      review: 'needed',
      summary: 'Now set',
      notes: 'short',
      extra: ['x'],
    });
  });

  it('preserves CRLF throughout', () => {
    const input = crlf(
      '---',
      'id: a',
      'status: active',
      'anchors:',
      '  - "[[A]]"',
      'review: needed',
      '---',
      '',
      '## Summary',
      'Body.',
    );
    const out = patchFields(input, { status: 'done', anchors: ['[[B]]', '[[C]]'], tags: ['x'] }, ['review']);
    expect(out).toBe(
      crlf(
        '---',
        'id: a',
        'status: done',
        'anchors:',
        '  - "[[B]]"',
        '  - "[[C]]"',
        'tags:',
        '  - x',
        '---',
        '',
        '## Summary',
        'Body.',
      ),
    );
    expect(out.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
  });

  it('creates frontmatter when none exists', () => {
    expect(patchFields('# Title\n\nBody\n', { type: 'note', id: 'x' })).toBe(
      '---\nid: x\ntype: note\n---\n# Title\n\nBody\n',
    );
    expect(patchFields('# Title\r\nBody\r\n', { id: 'x' })).toBe('---\r\nid: x\r\n---\r\n# Title\r\nBody\r\n');
    expect(patchFields('', { id: 'x' })).toBe('---\nid: x\n---\n');
    // nothing to set: the text is returned unchanged rather than gaining an empty block
    expect(patchFields('# Title\n', {}, ['id'])).toBe('# Title\n');
  });

  it('leaves anchors/aliases (&x / *x) under other keys untouched', () => {
    const input = lf(
      '---',
      'defaults: &d',
      '  owner: ops',
      '  tier: 1',
      'venue: *d',
      'status: active',
      'pair: &p [a, b]',
      'copy: *p',
      '---',
    );
    const out = patchFields(input, { status: 'done' });
    expect(out).toBe(
      lf(
        '---',
        'defaults: &d',
        '  owner: ops',
        '  tier: 1',
        'venue: *d',
        'status: done',
        'pair: &p [a, b]',
        'copy: *p',
        '---',
      ),
    );
    expect(changedLines(input, out)).toBe(1);
    expect(fieldsOf(out).venue).toEqual({ owner: 'ops', tier: 1 });
  });

  it('preserves a leading BOM and patches the existing block instead of adding a second one', () => {
    const input = BOM + lf('---', 'id: a', 'status: active', '---', 'body');
    expect(patchFields(input, { status: 'done', updated: '2026-10-10' })).toBe(
      BOM + lf('---', 'id: a', 'status: done', 'updated: 2026-10-10', '---', 'body'),
    );
    // without frontmatter, the BOM stays first and the new block follows it
    expect(patchFields(BOM + '# T\r\n', { id: 'x' })).toBe(BOM + '---\r\nid: x\r\n---\r\n# T\r\n');
  });

  it('returns the text unchanged when nothing changes', () => {
    const input = lf('---', 'id: a', 'title:    spaced   ', '---', 'body');
    expect(patchFields(input, {})).toBe(input);
    expect(patchFields(input, {}, ['missing'])).toBe(input);
    expect(patchFields(input, { skipped: undefined })).toBe(input);
  });

  it('never throws on odd frontmatter and keeps the fence intact', () => {
    const odd = lf(
      '---',
      'id: a',
      'plain line without a colon',
      ': no key',
      '- stray item',
      '   ',
      'status: "unterminated',
      '  continues here"',
      'title: [unclosed',
      '---',
      'body',
    );
    const out = patchFields(odd, { status: 'done', title: 'T', added: 'yes' });
    expect(out).toBe(
      lf(
        '---',
        'id: a',
        'plain line without a colon',
        ': no key',
        '- stray item',
        '   ',
        'status: done',
        'title: T',
        'added: "yes"',
        '---',
        'body',
      ),
    );
    // an unterminated opening fence is not frontmatter: a new block goes on top and the old text is body
    const unterminated = lf('---', 'id: a', 'body forever');
    const fixed = patchFields(unterminated, { id: 'x' });
    expect(fixed).toBe(lf('---', 'id: x', '---', '---', 'id: a', 'body forever'));
    expect(splitNote(fixed).fmText).toBe('id: x\n');
  });

  it('finds keys whose values contain U+2028 or a lone CR, for set and unset', () => {
    for (const sep of [String.fromCharCode(0x2028), '\r']) {
      const input = lf(
        '---',
        `title: a${sep}b`,
        `summary: c${sep}d # note`,
        `kind: "e${sep}f" # q`,
        'status: active',
        '---',
      );
      expect(patchFields(input, { title: 'New', summary: 'S', kind: 'K' })).toBe(
        lf('---', 'title: New', 'summary: S # note', 'kind: "K" # q', 'status: active', '---'),
      );
      expect(patchFields(input, {}, ['title', 'summary', 'kind'])).toBe(lf('---', 'status: active', '---'));
    }
  });

  it("keeps a column-0 comment inside a value in that key's range", () => {
    const list = lf('---', 'tags:', '# c', '- x', 'status: active', '---');
    const replaced = patchFields(list, { tags: ['a', 'b'] });
    expect(replaced).toBe(lf('---', 'tags:', '- a', '- b', 'status: active', '---'));
    expect(fieldsOf(replaced)).toEqual({ tags: ['a', 'b'], status: 'active' });
    expect(patchFields(list, {}, ['tags'])).toBe(lf('---', 'status: active', '---'));

    const map = lf('---', 'extra:', '  a: 1', '# c', '  b: 2', '# about status', 'status: active', '---');
    const flat = patchFields(map, { extra: 'x' });
    expect(flat).toBe(lf('---', 'extra: x', '# about status', 'status: active', '---'));
    expect(fieldsOf(flat)).toEqual({ extra: 'x', status: 'active' });
  });

  it('refuses to set or unset a key whose anchor is aliased by another key', () => {
    const input = lf(
      '---',
      'defaults: &d',
      '  owner: ops',
      'venue: *d',
      'list:',
      '  - &item x',
      'copy: *item',
      'status: active',
      '---',
    );
    const cases: [Record<string, unknown>, string[], RegExp][] = [
      [{ defaults: 'x' }, [], /"defaults".*anchor &d/],
      [{}, ['defaults'], /"defaults".*anchor &d/],
      [{ list: ['y'] }, [], /"list".*anchor &item/],
      [{}, ['list'], /"list".*anchor &item/],
    ];
    for (const [set, unset, message] of cases) {
      expect(() => patchFields(input, set, unset)).toThrow(message);
      try {
        patchFields(input, set, unset);
      } catch (e) {
        expect((e as KilnError).code).toBe('validation');
      }
    }
    // fine when every alias user is touched too, or when the anchor is unused
    expect(patchFields(input, { venue: 'Main hall' }, ['defaults'])).toBe(
      lf('---', 'venue: Main hall', 'list:', '  - &item x', 'copy: *item', 'status: active', '---'),
    );
    expect(patchFields(lf('---', 'a: &x 1', 'b: 2', '---'), { a: 3 })).toBe(lf('---', 'a: 3', 'b: 2', '---'));
  });

  it('throws instead of returning frontmatter that no longer parses, when the input parsed', () => {
    // a quoted key is not recognised as an existing key, so appending would duplicate it
    const quotedKey = lf('---', '"title": Old', '---');
    expect(() => patchFields(quotedKey, { title: 'New' })).toThrow(/would not be valid YAML/);
    try {
      patchFields(quotedKey, { title: 'New' });
    } catch (e) {
      expect((e as KilnError).code).toBe('validation');
    }
    // input that never parsed skips the backstop: callers report it
    expect(patchFields(lf('---', 'title: [unclosed', '---'), { status: 'x' })).toBe(
      lf('---', 'title: [unclosed', 'status: x', '---'),
    );
  });

  it('throws validation for unsupported values', () => {
    const input = lf('---', 'id: a', '---');
    for (const set of [{ id: { a: 1 } }, { nested: { a: 1 } }, { id: [{ a: 1 }] }, { id: Number.NaN }]) {
      expect(() => patchFields(input, set)).toThrow(KilnError);
      try {
        patchFields(input, set);
      } catch (e) {
        expect((e as KilnError).code).toBe('validation');
      }
    }
  });
});

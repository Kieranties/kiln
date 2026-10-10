import { describe, it, expect } from 'vitest';
import { renderNote, splitNote } from '../../src/frontmatter.js';
import { editSections } from '../../src/sections.js';
import { KilnError } from '../../src/types.js';

const BOM = String.fromCharCode(0xfeff);
const FM = '---\nid: a\ntitle: T\n---\n';

describe('editSections', () => {
  it("replace changes only that section's lines", () => {
    const text = `${FM}\n## Summary\nold line 1\nold line 2\n\n## Notes\nkeep me\n`;
    const out = editSections(text, [{ heading: 'Summary', mode: 'replace', text: 'new line' }]);
    expect(out).toBe(`${FM}\n## Summary\nnew line\n\n## Notes\nkeep me\n`);
  });

  it('append adds before trailing blank lines', () => {
    const text = `${FM}\n## Log\nfirst\n\n\n## Next\nx\n`;
    const out = editSections(text, [{ heading: 'Log', mode: 'append', text: 'second' }]);
    expect(out).toBe(`${FM}\n## Log\nfirst\nsecond\n\n\n## Next\nx\n`);
  });

  it('missing section is created at end', () => {
    const text = `${FM}\n## Summary\nbody\n`;
    const out = editSections(text, [{ heading: 'Checkpoints', mode: 'append', text: '- 2026-10-10 did a thing' }]);
    expect(out).toBe(`${FM}\n## Summary\nbody\n\n## Checkpoints\n- 2026-10-10 did a thing\n`);
  });

  it('does not treat ### subheadings as boundaries', () => {
    const text = `${FM}\n## Parent\nintro\n### Child\nchild text\n\n## Other\no\n`;
    const appended = editSections(text, [{ heading: 'Parent', mode: 'append', text: 'tail' }]);
    expect(appended).toBe(`${FM}\n## Parent\nintro\n### Child\nchild text\ntail\n\n## Other\no\n`);
    const replaced = editSections(text, [{ heading: 'Parent', mode: 'replace', text: 'only' }]);
    expect(replaced).toBe(`${FM}\n## Parent\nonly\n\n## Other\no\n`);
    // ### headings never match a ## target
    const missing = editSections(text, [{ heading: 'Child', mode: 'append', text: 'x' }]);
    expect(missing.endsWith('## Other\no\n\n## Child\nx\n')).toBe(true);
  });

  it('preserves CRLF', () => {
    const fm = '---\r\nid: a\r\n---\r\n';
    const text = `${fm}\r\n## A\r\nold\r\n\r\n## B\r\nb\r\n`;
    const replaced = editSections(text, [{ heading: 'A', mode: 'replace', text: 'one\ntwo\n' }]);
    expect(replaced).toBe(`${fm}\r\n## A\r\none\r\ntwo\r\n\r\n## B\r\nb\r\n`);
    const created = editSections(text, [{ heading: 'C', mode: 'append', text: 'c1\nc2' }]);
    expect(created).toBe(`${text}\r\n## C\r\nc1\r\nc2\r\n`);
    expect(created.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('frontmatter is byte-identical after edit', () => {
    const fm = `---\n# a comment\nid:   a\ntitle: "T"   \nlist: [x,   y]\n---\n`;
    const text = `${fm}\n## A\nold\n`;
    for (const mode of ['append', 'replace'] as const) {
      for (const heading of ['A', 'Missing']) {
        const out = editSections(text, [{ heading, mode, text: 'z' }]);
        expect(out.startsWith(fm)).toBe(true);
      }
    }
    // A body line that looks like a fence close or key must not matter either.
    const tricky = `${fm}\n## A\n---\nnot: frontmatter\n`;
    const out = editSections(tricky, [{ heading: 'A', mode: 'replace', text: 'r' }]);
    expect(out).toBe(`${fm}\n## A\nr\n`);
  });

  it('keeps a leading BOM and the frontmatter byte-identical', () => {
    const text = `${BOM}${FM}\n## A\nold\n`;
    const out = editSections(text, [{ heading: 'A', mode: 'replace', text: 'new' }]);
    expect(out).toBe(`${BOM}${FM}\n## A\nnew\n`);
    const noFm = `${BOM}## A\nold\n`;
    expect(editSections(noFm, [{ heading: 'A', mode: 'append', text: 'more' }])).toBe(`${BOM}## A\nold\nmore\n`);
  });

  it('treats notes without frontmatter as all body', () => {
    const text = '# Title\n\n## A\nold\n\n## B\nb\n';
    expect(editSections(text, [{ heading: 'A', mode: 'replace', text: 'new' }])).toBe(
      '# Title\n\n## A\nnew\n\n## B\nb\n',
    );
    expect(editSections('', [{ heading: 'A', mode: 'append', text: 'x' }])).toBe('## A\nx\n');
  });

  it('ignores headings inside fenced code blocks', () => {
    const text = [
      '---', 'id: a', '---', '',
      '## Real', 'before', '```md', '## Real', '## Fake', '```', 'after', '',
      '~~~', '## Tilde', '~~~', '',
      '## Other', 'o', '',
    ].join('\n');

    // The fenced "## Real" does not match, and the fenced "## Fake" does not end the section.
    const appended = editSections(text, [{ heading: 'Real', mode: 'append', text: 'tail' }]);
    expect(appended).toBe(text.replace('~~~\n\n## Other', '~~~\ntail\n\n## Other'));
    const replaced = editSections(text, [{ heading: 'Real', mode: 'replace', text: 'r' }]);
    // The whole fenced region (and the tilde block, which is not a boundary either) belongs to "Real".
    expect(replaced).toBe(['---', 'id: a', '---', '', '## Real', 'r', '', '## Other', 'o', ''].join('\n'));

    // A heading that exists only inside a fence is missing: the section is created at the end.
    const created = editSections(text, [{ heading: 'Tilde', mode: 'append', text: 't' }]);
    expect(created).toBe(`${text}\n## Tilde\nt\n`);

    // A longer fence is not closed by a shorter one; an unclosed fence runs to EOF.
    const long = '## A\n````\n```\n## B\n````\n## C\nc\n';
    expect(editSections(long, [{ heading: 'B', mode: 'append', text: 'x' }])).toBe(`${long}\n## B\nx\n`);
    const open = '## A\na\n```\n## B\nstill code\n';
    expect(editSections(open, [{ heading: 'A', mode: 'append', text: 'x' }])).toBe(
      '## A\na\n```\n## B\nstill code\nx\n',
    );
  });

  it('matches case-insensitively with trimmed text, level 2 only', () => {
    const text = `${FM}\n#  Summary\nlevel one\n\n##   summary   \nold\n`;
    const out = editSections(text, [{ heading: '  SUMMARY ', mode: 'replace', text: 'new' }]);
    expect(out).toBe(`${FM}\n#  Summary\nlevel one\n\n##   summary   \nnew\n`);
    const closed = editSections('## Done ##\nx\n', [{ heading: 'done', mode: 'append', text: 'y' }]);
    expect(closed).toBe('## Done ##\nx\ny\n');
  });

  it('ends a section at a level-1 heading', () => {
    const text = `${FM}\n## A\na\n\n# Big\nbig body\n`;
    const out = editSections(text, [{ heading: 'A', mode: 'append', text: 'more' }]);
    expect(out).toBe(`${FM}\n## A\na\nmore\n\n# Big\nbig body\n`);
  });

  it('normalises inserted text to exactly one EOL, in the file EOL', () => {
    const base = `${FM}\n## A\nold\n\n## B\nb\n`;
    for (const t of ['x', 'x\n', 'x\n\n\n', 'x\r\n']) {
      expect(editSections(base, [{ heading: 'A', mode: 'replace', text: t }])).toBe(`${FM}\n## A\nx\n\n## B\nb\n`);
      expect(editSections(base, [{ heading: 'A', mode: 'append', text: t }])).toBe(`${FM}\n## A\nold\nx\n\n## B\nb\n`);
    }
    const crlf = '---\r\nid: a\r\n---\r\n\r\n## A\r\nold\r\n';
    expect(editSections(crlf, [{ heading: 'A', mode: 'append', text: 'l1\nl2\r\nl3\n' }])).toBe(
      '---\r\nid: a\r\n---\r\n\r\n## A\r\nold\r\nl1\r\nl2\r\nl3\r\n',
    );
  });

  it('handles a section at EOF without a trailing newline', () => {
    expect(editSections(`${FM}\n## A\nold`, [{ heading: 'A', mode: 'append', text: 'new' }])).toBe(`${FM}\n## A\nold\nnew\n`);
    expect(editSections(`${FM}\n## A`, [{ heading: 'A', mode: 'replace', text: 'new' }])).toBe(`${FM}\n## A\nnew\n`);
    expect(editSections(`${FM}\n## A\nold`, [{ heading: 'B', mode: 'append', text: 'b' }])).toBe(
      `${FM}\n## A\nold\n\n## B\nb\n`,
    );
  });

  it('appends to an empty section and keeps its trailing blank line', () => {
    const text = `${FM}\n## A\n\n## B\nb\n`;
    expect(editSections(text, [{ heading: 'A', mode: 'append', text: 'a' }])).toBe(`${FM}\n## A\na\n\n## B\nb\n`);
  });

  it('applies edits in order, so a created section can be edited again', () => {
    const out = editSections(`${FM}\n## A\na\n`, [
      { heading: 'New', mode: 'append', text: 'one' },
      { heading: 'new', mode: 'append', text: 'two' },
      { heading: 'A', mode: 'replace', text: 'A2' },
    ]);
    expect(out).toBe(`${FM}\n## A\nA2\n\n## New\none\ntwo\n`);
  });

  it('returns the text unchanged for no edits or an empty append to an existing section', () => {
    const text = `${FM}\n## A\na\n`;
    expect(editSections(text, [])).toBe(text);
    expect(editSections(text, [{ heading: 'A', mode: 'append', text: '' }])).toBe(text);
  });

  it('creates sections exactly as renderNote lays them out', () => {
    const fields = { id: 'a', type: 'note', title: 'T' };
    for (const eol of ['\n', '\r\n'] as const) {
      const start = renderNote(fields, [{ heading: 'Summary', text: 's' }], eol);
      const edited = editSections(start, [
        { heading: 'Log', mode: 'append', text: 'l1' },
        { heading: 'Extra', mode: 'replace', text: 'e1\ne2\n' },
      ]);
      const expected = renderNote(
        fields,
        [{ heading: 'Summary', text: 's' }, { heading: 'Log', text: 'l1' }, { heading: 'Extra', text: 'e1\ne2' }],
        eol,
      );
      expect(edited).toBe(expected);

      // A note with no sections at all gets the blank line after the closing fence.
      const bare = renderNote(fields, [], eol);
      expect(editSections(bare, [{ heading: 'Log', mode: 'append', text: 'l1' }])).toBe(
        renderNote(fields, [{ heading: 'Log', text: 'l1' }], eol),
      );
      expect(splitNote(edited).eol).toBe(eol);
    }
  });

  it('rejects headings that are empty or span lines', () => {
    for (const heading of ['', '   ', 'a\nb']) {
      expect(() => editSections('## A\n', [{ heading, mode: 'append', text: 'x' }])).toThrow(KilnError);
    }
  });
});

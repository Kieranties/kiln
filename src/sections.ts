import { splitNote, type Eol } from './frontmatter.js';
import { KilnError } from './types.js';

export type SectionEdit = { heading: string; mode: 'append' | 'replace'; text: string };

type Line = { content: string; term: '' | '\n' | '\r\n' };
type Heading = { level: number; text: string };

function toLines(body: string): Line[] {
  const lines: Line[] = [];
  let i = 0;
  while (i < body.length) {
    const nl = body.indexOf('\n', i);
    if (nl < 0) {
      lines.push({ content: body.slice(i), term: '' });
      break;
    }
    const crlf = nl > i && body[nl - 1] === '\r';
    lines.push({ content: body.slice(i, crlf ? nl - 1 : nl), term: crlf ? '\r\n' : '\n' });
    i = nl + 1;
  }
  return lines;
}

const join = (lines: Line[]): string => lines.map((l) => l.content + l.term).join('');
const isBlank = (l: Line): boolean => /^[ \t]*$/.test(l.content);

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;

/** The ATX heading on each line, or null. Lines inside fenced code blocks are never headings. */
function scanHeadings(lines: Line[]): (Heading | null)[] {
  let fence: { char: string; length: number } | null = null;
  return lines.map(({ content }) => {
    if (fence) {
      const close = FENCE_CLOSE.exec(content)?.[1];
      if (close && close[0] === fence.char && close.length >= fence.length) fence = null;
      return null;
    }
    const open = FENCE_OPEN.exec(content);
    if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
      fence = { char: open[1][0], length: open[1].length };
      return null;
    }
    const m = ATX.exec(content);
    if (!m) return null;
    const text = (m[2] ?? '').replace(/(?:^|[ \t]+)#+[ \t]*$/, '').trim();
    return { level: m[1].length, text };
  });
}

/** Inserted text with exactly one trailing EOL (none when empty), every line break in the file's EOL. */
function normalise(text: string, eol: Eol): string {
  const trimmed = text.replace(/(\r?\n)+$/, '').replace(/\r?\n/g, eol);
  return trimmed === '' ? '' : trimmed + eol;
}

function createSection(body: string, heading: string, text: string, eol: Eol, blankAfterFence: boolean): string {
  const block = `## ${heading}${eol}${text}`;
  if (body === '') return (blankAfterFence ? eol : '') + block;
  const lines = toLines(body);
  const last = lines[lines.length - 1];
  const terminated = body + (last.term === '' ? eol : '');
  return terminated + (isBlank(last) ? '' : eol) + block;
}

function applyEdit(body: string, edit: SectionEdit, eol: Eol, blankAfterFence: boolean): string {
  const heading = edit.heading.trim();
  if (heading === '' || /[\r\n]/.test(heading)) {
    throw new KilnError('validation', 'A section heading must be a non-empty single line');
  }
  const text = normalise(edit.text, eol);
  const lines = toLines(body);
  const headings = scanHeadings(lines);
  const target = heading.toLowerCase();
  const start = headings.findIndex((h) => h !== null && h.level === 2 && h.text.toLowerCase() === target);

  if (start < 0) return createSection(body, heading, text, eol, blankAfterFence);

  let end = start + 1;
  while (end < lines.length && !(headings[end] !== null && headings[end]!.level <= 2)) end++;
  // The section's trailing blank lines are the separator before the next heading; edits stay above them.
  let contentEnd = end;
  while (contentEnd > start + 1 && isBlank(lines[contentEnd - 1])) contentEnd--;

  if (edit.mode === 'replace') {
    const headingLine = lines[start];
    const headingEol = headingLine.term === '' && text !== '' ? eol : '';
    return join(lines.slice(0, start)) + headingLine.content + headingLine.term + headingEol + text + join(lines.slice(contentEnd));
  }

  if (text === '') return body;
  const prev = lines[contentEnd - 1];
  return join(lines.slice(0, contentEnd)) + (prev.term === '' ? eol : '') + text + join(lines.slice(contentEnd));
}

/**
 * Append to or replace named `## ` sections of a note body, in order. A section runs from its heading to the next
 * heading of level 2 or above (a level-1 heading ends it; `###` does not), ignoring headings inside fenced code.
 * Headings match case-insensitively on trimmed text. `replace` keeps the heading line; `append` inserts before the
 * section's trailing blank lines. A missing section is added at the end of the body as a new `## heading` block,
 * laid out as `renderNote` would. Everything up to the end of the frontmatter closing fence (BOM included) and
 * every other body byte is unchanged; inserted text is normalised to the file's EOL with exactly one trailing EOL.
 */
export function editSections(text: string, edits: SectionEdit[]): string {
  const { fmText, body, eol } = splitNote(text);
  let prefix = text.slice(0, text.length - body.length);
  let current = body;
  if (fmText === null && body.charCodeAt(0) === 0xfeff) {
    prefix = body.slice(0, 1);
    current = body.slice(1);
  }
  for (const edit of edits) current = applyEdit(current, edit, eol, fmText !== null);
  return prefix + current;
}

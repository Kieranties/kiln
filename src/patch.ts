import { isMap, isScalar, parseDocument, visit, type Document, type Node, type Pair } from 'yaml';
import { parseFields, renderNote, renderScalar, splitNote } from './frontmatter.js';
import { KilnError, type Fields } from './types.js';

type Scalar = string | number | boolean | null;
type Line = { text: string; eol: string };
type Range = { start: number; end: number; rest: string };

/**
 * How the original value of a key was written. `empty` covers no value, `null`/`~` and `[]`; `other` is anything
 * this patcher does not restyle (block scalars, nested mappings, multi-line scalars, anchors, tags, ...).
 */
type Shape = 'empty' | 'plain' | 'single' | 'double' | 'flow' | 'block' | 'other';
type Original = {
  shape: Shape;
  /** Whitespace between `key:` and the value, kept for same-style replacements. */
  gap: string;
  /** Text after the value on the key line: trailing whitespace and/or a ` # comment`. */
  suffix: string;
  /** Indent and dash prefix of a block list's items, e.g. `    - `. */
  prefix: string;
};

// The `s` flag matters: a line's text may contain a lone CR, U+2028 or U+2029, which `.` would not match.
const KEY_LINE = /^([A-Za-z_][\w-]*):(.*)$/s;
const ITEM = /^-(?:[ \t]|$)/;
const BLANK = /^[ \t]*$/;
const COMMENT = /^[ \t]*#/;
/** What may follow a closed quoted scalar or flow list on its line: whitespace, optionally then a comment. */
const AFTER_VALUE = /^(?:[ \t]*|[ \t]+#.*)$/s;
const NULL_WORD = /^(?:null|Null|NULL|~)$/;
const FLOW_UNSAFE = /[,[\]{}]/;

/**
 * Set and unset top-level frontmatter keys, changing only those keys' lines. Existing keys keep their style
 * (flow list, block list with its indent, or single/double/plain quoting plus any trailing comment); a value whose
 * shape differs from the original (scalar vs list, or an empty/null original) is written in `renderNote` style.
 * New keys are appended before the closing fence in `renderNote` style and order. A key in both `set` and `unset`
 * is removed. Undefined values are ignored. With no frontmatter, a block is created at the top (after a BOM).
 * Edits text lines; callers validate the frontmatter first. When the original frontmatter is valid YAML, the patch
 * is guarded: changing or removing a key that defines an anchor aliased by an untouched key, or producing
 * frontmatter that no longer parses, throws instead of writing.
 * Throws `KilnError('validation')` for those cases and for values that are not scalars or lists of scalars.
 */
export function patchFields(text: string, set: Fields, unset: string[] = []): string {
  const removed = new Set(unset);
  const toSet = Object.entries(set).filter(([k, v]) => v !== undefined && !removed.has(k));
  const split = splitNote(text);
  const { eol } = split;

  if (split.fmText === null) {
    if (toSet.length === 0) return text;
    const bom = text.charCodeAt(0) === 0xfeff ? text[0]! : '';
    return bom + renderNote(Object.fromEntries(toSet), [], eol) + text.slice(bom.length);
  }

  const validInput = parses(split.fmText);
  if (validInput) checkAnchors(parseDocument(split.fmText), new Set([...removed, ...toSet.map(([k]) => k)]));

  const lines = toLines(split.fmText);
  const ranges = keyRanges(lines);
  const edits: { start: number; end: number; lines: Line[] }[] = [];
  for (const key of removed) {
    const r = ranges.get(key);
    if (r) edits.push({ start: r.start, end: r.end, lines: [] });
  }
  const added: Fields = {};
  for (const [key, value] of toSet) {
    const r = ranges.get(key);
    if (!r) {
      added[key] = value;
      continue;
    }
    const texts = replacement(key, analyse(r.rest, lines.slice(r.start + 1, r.end)), value);
    const lastEol = lines[r.end - 1]!.eol || eol;
    edits.push({
      start: r.start,
      end: r.end,
      lines: texts.map((t, i) => ({ text: t, eol: i === texts.length - 1 ? lastEol : eol })),
    });
  }
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) lines.splice(e.start, e.end - e.start, ...e.lines);

  let fm = lines.map((l) => l.text + l.eol).join('');
  if (Object.keys(added).length > 0) {
    const fence = 3 + eol.length;
    const block = renderNote(added, [], eol);
    fm += block.slice(fence, block.length - fence);
  }
  if (validInput) {
    try {
      parseFields(fm);
    } catch (e) {
      throw new KilnError(
        'validation',
        `Cannot patch frontmatter safely: the result would not be valid YAML (${(e as Error).message})`,
      );
    }
  }
  return text.slice(0, split.fmStart) + fm + text.slice(split.fmEnd);
}

function parses(fmText: string): boolean {
  try {
    parseFields(fmText);
    return true;
  } catch {
    return false;
  }
}

/**
 * Throw when a key about to be replaced or removed defines an anchor (on its value or any node inside it) that an
 * alias outside the touched keys refers to: the patch would leave that alias dangling or silently change it.
 */
function checkAnchors(doc: Document, touched: Set<string>): void {
  if (!isMap(doc.contents)) return;
  const touchedPairs = doc.contents.items.filter((p) => isScalar(p.key) && touched.has(String(p.key.value)));
  for (const pair of touchedPairs) {
    const anchors = new Set<string>();
    visit(pair.value as Node | null, {
      Node(_, node) {
        if (node.anchor) anchors.add(node.anchor);
      },
    });
    if (anchors.size === 0) continue;
    let used: string | undefined;
    visit(doc, {
      Alias(_, node, path) {
        if (anchors.has(node.source) && !path.some((p) => touchedPairs.includes(p as Pair))) used = node.source;
      },
    });
    if (used !== undefined) {
      throw new KilnError(
        'validation',
        `Cannot patch "${String((pair.key as { value: unknown }).value)}": it defines the YAML anchor &${used}, ` +
          `which another key uses as *${used}; edit the note by hand`,
      );
    }
  }
}

function toLines(s: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  while (start < s.length) {
    const nl = s.indexOf('\n', start);
    if (nl < 0) {
      lines.push({ text: s.slice(start), eol: '' });
      break;
    }
    const cr = nl > start && s[nl - 1] === '\r';
    lines.push({ text: s.slice(start, cr ? nl - 1 : nl), eol: cr ? '\r\n' : '\n' });
    start = nl + 1;
  }
  return lines;
}

function isContinuation(t: string): boolean {
  return (/^[ \t]/.test(t) && !BLANK.test(t)) || ITEM.test(t);
}

/**
 * Map each top-level key (first occurrence) to its line range: the key line plus following indented or `- ` lines.
 * Blank lines and column-0 `#` comments belong to the range only when more continuation lines follow them, so a
 * comment directly above the next key stays outside. A top-level key or any other unindented line ends the range.
 */
function keyRanges(lines: Line[]): Map<string, Range> {
  const ranges = new Map<string, Range>();
  let i = 0;
  while (i < lines.length) {
    const m = KEY_LINE.exec(lines[i]!.text);
    if (!m) {
      i++;
      continue;
    }
    let end = i + 1;
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j]!.text;
      if (isContinuation(t)) end = j + 1;
      else if (!BLANK.test(t) && !t.startsWith('#')) break;
    }
    if (!ranges.has(m[1]!)) ranges.set(m[1]!, { start: i, end, rest: m[2]! });
    i = end;
  }
  return ranges;
}

/** Classify a key's original value from the text after `key:` and its continuation lines. */
function analyse(rest: string, continuation: Line[]): Original {
  const gap = /^[ \t]*/.exec(rest)![0];
  const v = rest.slice(gap.length);
  const result = (shape: Shape, suffix: string, prefix = '  - '): Original => ({ shape, gap, suffix, prefix });

  if (v === '' || (gap !== '' && v.startsWith('#'))) {
    const first = continuation.find((l) => !BLANK.test(l.text) && !COMMENT.test(l.text));
    if (!first) return result(continuation.length === 0 ? 'empty' : 'other', rest);
    const item = /^([ \t]*)-([ \t]*)/.exec(first.text);
    if (item && ITEM.test(first.text.slice(item[1]!.length))) {
      return result('block', rest, `${item[1]}-${item[2] || ' '}`);
    }
    return result('other', rest);
  }
  if (continuation.length > 0) return result('other', '');

  const quotedEnd =
    v[0] === '"' ? scanDouble(v, 0) : v[0] === "'" ? scanSingle(v, 0) : v[0] === '[' ? scanFlow(v) : null;
  if (quotedEnd !== null) {
    const after = v.slice(quotedEnd);
    if (quotedEnd < 0 || !AFTER_VALUE.test(after)) return result('other', '');
    if (v[0] === '"') return result('double', after);
    if (v[0] === "'") return result('single', after);
    return result(BLANK.test(v.slice(1, quotedEnd - 1)) ? 'empty' : 'flow', after);
  }
  if ('{|>&*!%@`'.includes(v[0]!)) return result('other', '');

  const plain = /^(.*?)([ \t]+#.*|[ \t]*)$/s.exec(v);
  if (!plain) return result('other', '');
  return result(NULL_WORD.test(plain[1]!) ? 'empty' : 'plain', plain[2]!);
}

/** Index just past the closing quote of a double-quoted scalar starting at `from`, or -1. */
function scanDouble(s: string, from: number): number {
  for (let i = from + 1; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === '"') return i + 1;
  }
  return -1;
}

/** Index just past the closing quote of a single-quoted scalar starting at `from` (`''` is an escaped quote), or -1. */
function scanSingle(s: string, from: number): number {
  for (let i = from + 1; i < s.length; i++) {
    if (s[i] !== "'") continue;
    if (s[i + 1] === "'") i++;
    else return i + 1;
  }
  return -1;
}

/** Index just past the `]` closing a single-line flow collection starting at 0, or -1. */
function scanFlow(s: string): number {
  let depth = 0;
  let atItemStart = true;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (atItemStart && (c === '"' || c === "'")) {
      const end = c === '"' ? scanDouble(s, i) : scanSingle(s, i);
      if (end < 0) return -1;
      i = end - 1;
      atItemStart = false;
    } else if (c === '[' || c === '{') {
      depth++;
      atItemStart = true;
    } else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return i + 1;
      atItemStart = false;
    } else if (c === ',' || c === ':') {
      atItemStart = true;
    } else if (c === '#' && /[ \t]/.test(s[i - 1]!)) {
      return -1;
    } else if (c !== ' ' && c !== '\t') {
      atItemStart = false;
    }
  }
  return -1;
}

/** The new lines (without EOLs) for a key, in the original's style where the shape allows. */
function replacement(key: string, o: Original, value: unknown): string[] {
  const comment = o.suffix.includes('#') ? o.suffix : '';
  if (Array.isArray(value)) {
    const items = value.map((item) => asScalar(key, item));
    if (o.shape === 'flow') return [`${key}:${o.gap}[${items.map(flowItem).join(', ')}]${o.suffix}`];
    if (items.length === 0) return [`${key}: []${comment}`];
    // a block list keeps its key line verbatim and its item prefix; anything else gets renderNote's `  - `
    if (o.shape === 'block') return [`${key}:${o.suffix}`, ...items.map((item) => o.prefix + renderScalar(item))];
    return [`${key}:${comment}`, ...items.map((item) => `  - ${renderScalar(item)}`)];
  }
  const v = asScalar(key, value);
  if (o.shape === 'plain' || o.shape === 'single' || o.shape === 'double') {
    return [`${key}:${o.gap}${styled(o.shape, v)}${o.suffix}`];
  }
  return [`${key}: ${renderScalar(v)}${comment}`];
}

function styled(shape: 'plain' | 'single' | 'double', v: Scalar): string {
  if (typeof v !== 'string') return renderScalar(v);
  if (shape === 'double') return JSON.stringify(v);
  if (shape === 'single' && !hasControl(v)) return `'${v.replaceAll("'", "''")}'`;
  return renderScalar(v);
}

/** A flow-list item: plain only when `renderScalar` keeps it plain and it has no flow indicator characters. */
function flowItem(v: Scalar): string {
  if (typeof v !== 'string') return renderScalar(v);
  return renderScalar(v) === v && !FLOW_UNSAFE.test(v) ? v : JSON.stringify(v);
}

/** True for line breaks and other control characters that a single-quoted scalar cannot carry safely. */
function hasControl(s: string): boolean {
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029 || c === 0xfeff) return true;
  }
  return false;
}

function asScalar(key: string, v: unknown): Scalar {
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  throw new KilnError(
    'validation',
    `Field "${key}" has an unsupported value; only scalars and lists of scalars are allowed`,
  );
}

import { parse } from 'yaml';
import { KilnError, type Fields } from './types.js';

export type Eol = '\n' | '\r\n';

export type SplitNote = {
  /** The frontmatter text, or null when the note has none. Empty (`''`) for `---` immediately followed by `---`. */
  fmText: string | null;
  /** Everything after the closing `---` line and its EOL; the whole text when there is no frontmatter. */
  body: string;
  eol: Eol;
  /**
   * Character (UTF-16 code unit) offsets into the original text, exact for LF and CRLF:
   * `fmStart` is where the frontmatter text begins (just after the opening `---` line and its EOL);
   * `fmEnd` is where it ends (the start of the closing `---` line). So `fmText === text.slice(fmStart, fmEnd)`,
   * and text can be spliced in at `fmEnd` to append a key. Both are 0 when there is no frontmatter.
   */
  fmStart: number;
  fmEnd: number;
};

/**
 * Split a note into frontmatter and body. The frontmatter must start at offset 0 with a `---` line and end at the
 * next line that is exactly `---`. An opening fence with no closing fence is treated as no frontmatter.
 */
export function splitNote(text: string): SplitNote {
  const opening = text.startsWith('---\r\n') ? '\r\n' : text.startsWith('---\n') ? '\n' : null;
  if (opening === null) {
    const nl = text.indexOf('\n');
    const eol: Eol = nl > 0 && text[nl - 1] === '\r' ? '\r\n' : '\n';
    return { fmText: null, body: text, eol, fmStart: 0, fmEnd: 0 };
  }

  const fmStart = 3 + opening.length;
  let lineStart = fmStart;
  while (lineStart <= text.length) {
    const nl = text.indexOf('\n', lineStart);
    const lineEnd = nl < 0 ? text.length : nl;
    const line = text.slice(lineStart, lineEnd).replace(/\r$/, '');
    if (line === '---') {
      return {
        fmText: text.slice(fmStart, lineStart),
        body: nl < 0 ? '' : text.slice(nl + 1),
        eol: opening,
        fmStart,
        fmEnd: lineStart,
      };
    }
    if (nl < 0) break;
    lineStart = nl + 1;
  }

  const nl = text.indexOf('\n');
  const eol: Eol = nl > 0 && text[nl - 1] === '\r' ? '\r\n' : '\n';
  return { fmText: null, body: text, eol, fmStart: 0, fmEnd: 0 };
}

/**
 * Parse frontmatter text into fields using the YAML core schema (so `2026-10-10` stays a string).
 * Null or empty text gives `{}`. Throws `KilnError('validation')` on invalid YAML or a non-mapping document.
 */
export function parseFields(fmText: string | null): Fields {
  if (fmText === null) return {};
  let value: unknown;
  try {
    value = parse(fmText);
  } catch (e) {
    throw new KilnError('validation', `Invalid frontmatter YAML: ${(e as Error).message}`);
  }
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new KilnError('validation', 'Frontmatter must be a YAML mapping of keys to values');
  }
  return value as Fields;
}

const PLAIN = /^[A-Za-z0-9 _.,()/-]+$/;
const RESERVED = /^(true|false|null|~|yes|no|y|n|on|off)$/i;

/** True when `s`, written unquoted, parses back to exactly `s` as a mapping value and as a block-list item. */
function survivesPlain(s: string): boolean {
  try {
    return parse(`k: ${s}\n`)?.k === s && parse(`k:\n  - ${s}\n`)?.k?.[0] === s;
  } catch {
    return false;
  }
}

/**
 * Render one scalar for frontmatter. Strings are plain when they match `PLAIN`, are not reserved words, and
 * parse back unchanged (which also excludes numeric-looking text); otherwise a JSON double-quoted string.
 * Numbers and booleans are bare; null is `null`.
 */
export function renderScalar(v: string | number | boolean | null): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new KilnError('validation', `Cannot render non-finite number ${v}`);
    return String(v);
  }
  if (PLAIN.test(v) && !RESERVED.test(v) && survivesPlain(v)) return v;
  return JSON.stringify(v);
}

const KEY_ORDER = [
  'id', 'type', 'kind', 'title', 'status', 'created', 'updated',
  'aliases', 'summary', 'keywords', 'anchors', 'sources', 'confidence',
];
const LAST_KEYS = ['review', 'review_reason'];

function orderedKeys(fields: Fields): string[] {
  const present = Object.keys(fields).filter((k) => fields[k] !== undefined);
  const first = KEY_ORDER.filter((k) => present.includes(k));
  const last = LAST_KEYS.filter((k) => present.includes(k));
  const rest = present.filter((k) => !KEY_ORDER.includes(k) && !LAST_KEYS.includes(k));
  return [...first, ...rest, ...last];
}

function scalarOf(key: string, v: unknown): string {
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return renderScalar(v);
  }
  throw new KilnError('validation', `Field "${key}" has an unsupported value; only scalars and lists of scalars are allowed`);
}

function renderKey(key: string): string {
  return /^[A-Za-z_][\w-]*$/.test(key) ? key : JSON.stringify(key);
}

/**
 * Render a new note: frontmatter (known keys first, then others in insertion order, `review`/`review_reason`
 * last), then `## <heading>` sections separated by blank lines. Arrays are block lists (`key: []` when empty).
 * Undefined values are skipped. Throws `KilnError('validation')` for nested objects.
 */
export function renderNote(
  fields: Fields,
  sections: { heading: string; text: string }[],
  eol: Eol = '\n',
): string {
  const lines = ['---'];
  for (const key of orderedKeys(fields)) {
    const v = fields[key];
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${renderKey(key)}: []`);
      } else {
        lines.push(`${renderKey(key)}:`);
        for (const item of v) lines.push(`  - ${scalarOf(key, item)}`);
      }
    } else {
      lines.push(`${renderKey(key)}: ${scalarOf(key, v)}`);
    }
  }
  lines.push('---');

  let out = lines.join(eol) + eol;
  if (sections.length > 0) {
    const blocks = sections.map(({ heading, text }) => {
      const body = text.replace(/(\r?\n)+$/, '').replace(/\r?\n/g, eol);
      return `## ${heading}${eol}${body === '' ? '' : body + eol}`;
    });
    out += eol + blocks.join(eol);
  }
  return out;
}

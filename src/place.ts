import { monotonicFactory } from 'ulid';
import { KINDS } from './schema.js';
import { KilnError } from './types.js';
import type { Fields, NoteType } from './types.js';

const nextUlid = monotonicFactory();

/** A new ULID. Monotonic within the process, so ids created in the same millisecond still sort in creation order. */
export function newId(): string {
  return nextUlid();
}

const MAX_NAME_LENGTH = 120;
const ILLEGAL_CHARS = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;
const RESERVED_DEVICE_NAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

/** Turns a title into a file name stem that is valid on Windows (and elsewhere). Never returns an empty string. */
export function safeFileName(title: string): string {
  let name = title
    .replace(/\s+/g, ' ')
    .replace(ILLEGAL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  if (name === '') return 'untitled';

  // Windows treats "CON", "CON.txt" and "CON .txt" alike as the console device; the extension is irrelevant.
  const reserved = RESERVED_DEVICE_NAME.test(name.split('.')[0]!.trimEnd());
  const limit = reserved ? MAX_NAME_LENGTH - 1 : MAX_NAME_LENGTH;
  if (name.length > limit) {
    name = name.slice(0, limit);
    // Do not leave half of a surrogate pair at the cut.
    if (/[\ud800-\udbff]$/.test(name)) name = name.slice(0, -1);
    name = name.replace(/[. ]+$/, '');
  }
  return reserved ? `${name}_` : name;
}

function invalid(field: string, message: string): KilnError {
  return new KilnError('validation', `${field}: ${message}`, { field });
}

/** The year of a `YYYY-MM-DD` field. */
function yearOf(fields: Fields, field: string): string {
  const value = fields[field];
  const m = typeof value === 'string' ? /^(\d{4})-\d{2}-\d{2}$/.exec(value) : null;
  if (!m) throw invalid(field, `needed to place the note; expected YYYY-MM-DD, got ${JSON.stringify(value)}`);
  return m[1]!;
}

/** The `YYYY-MM-DD` part of a date or ISO datetime field. */
function datePartOf(fields: Fields, field: string): string {
  const value = fields[field];
  const m = typeof value === 'string' ? /^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(value) : null;
  if (!m) throw invalid(field, `needed to place the note; expected an ISO date or datetime, got ${JSON.stringify(value)}`);
  return m[1]!;
}

/** The `kind` of an anchor or source, which names its folder. Must be a known kind (it becomes a path segment). */
function kindOf(fields: Fields, type: 'anchor' | 'source'): string {
  const value = fields.kind;
  if (typeof value !== 'string' || !KINDS[type].includes(value)) {
    throw invalid('kind', `needed to place a ${type}; use one of: ${KINDS[type].join(', ')}`);
  }
  return value;
}

function isNoteType(value: unknown): value is NoteType {
  return typeof value === 'string' && Object.hasOwn(KINDS, value);
}

/**
 * The base-relative path (forward slashes) for a new note, without a `.md` collision:
 * `exists` is asked about each candidate and ` (2)`, ` (3)`... is appended until one is free.
 */
export function placeNote(fields: Fields, exists: (rel: string) => boolean): string {
  const type = fields.type;
  if (!isNoteType(type)) throw invalid('type', `needed to place the note; got ${JSON.stringify(type)}`);
  const stem = safeFileName(typeof fields.title === 'string' ? fields.title : '');

  let dir: string;
  let name = stem;
  switch (type) {
    case 'anchor':
      dir = `anchors/${kindOf(fields, 'anchor')}`;
      break;
    case 'project':
      dir = 'projects';
      break;
    case 'work':
      dir = `work/${yearOf(fields, 'created')}`;
      break;
    case 'decision': {
      const year = yearOf(fields, 'decided_on');
      dir = `decisions/${year}`;
      name = `${fields.decided_on as string} ${stem}`;
      break;
    }
    case 'reference':
      dir = 'references';
      break;
    case 'note':
      dir = 'notes';
      break;
    case 'source': {
      const kind = kindOf(fields, 'source');
      dir = `sources/${kind}`;
      name = `${datePartOf(fields, 'captured_at')} ${stem}`;
      break;
    }
  }

  let candidate = `${dir}/${name}.md`;
  for (let n = 2; exists(candidate); n++) candidate = `${dir}/${name} (${n}).md`;
  return candidate;
}

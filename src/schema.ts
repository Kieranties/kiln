import type { Fields, NoteType, ValidationIssue } from './types.js';

export const KINDS: Record<NoteType, string[]> = {
  anchor: ['organisation', 'product', 'service', 'person', 'topic'],
  project: [],
  work: ['feature', 'bug', 'chore', 'incident', 'research'],
  decision: [],
  reference: ['doc', 'spec', 'code', 'post', 'thread', 'video', 'dashboard', 'sheet', 'slides'],
  source: ['jira', 'github', 'slack', 'email', 'meeting', 'web', 'note'],
  note: [],
};

export const STATUSES: Record<NoteType, string[]> = {
  anchor: ['active', 'archived'],
  project: ['shaping', 'active', 'paused', 'closing', 'closed'],
  work: ['active', 'blocked', 'paused', 'done', 'abandoned'],
  decision: ['proposed', 'active', 'superseded'],
  reference: ['active', 'archived'],
  source: [],
  note: [],
};

/** Triage state of a source (sources have no `status`). */
export const TRIAGE = ['pending', 'linked', 'dismissed'];

export const TRIAGE_OUTCOMES = [
  'dismiss',
  'link-to-anchor',
  'update-work-item',
  'new-work-item',
  'new-decision',
  'supersede',
  'new-reference',
  'duplicate-of',
];

const ROLES = ['client', 'vendor', 'partner', 'self'];
const CONFIDENCE = ['verbatim', 'inferred'];
const CAPTURED_BY = ['manual', 'watcher'];

const WIKILINK = /^\[\[[^[\]]+\]\]$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

const HINT_DATE = 'use YYYY-MM-DD';
const HINT_DATE_OR_DATETIME = 'use YYYY-MM-DD or an ISO datetime such as 2026-10-10T09:30:00.000Z';

const isPresent = (value: unknown): boolean => value !== undefined && value !== null;
const isString = (value: unknown): value is string => typeof value === 'string';
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const oneOf = (values: readonly string[]): string => `use one of: ${values.join(', ')}`;

/** True for `YYYY-MM-DD` that names a real calendar date. */
function isIsoDate(value: unknown): boolean {
  if (!isString(value)) return false;
  const m = DATE.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** True for an ISO date, or an ISO datetime with a real date, a valid time and a zone. */
function isIsoDateOrDateTime(value: unknown): boolean {
  if (isIsoDate(value)) return true;
  if (!isString(value)) return false;
  const m = DATETIME.exec(value);
  if (!m) return false;
  const [hour, minute, second] = [Number(m[2]), Number(m[3]), Number(m[4] ?? 0)];
  const offsetOk = m[5] === undefined || (Number(m[5]) <= 23 && Number(m[6]) <= 59);
  return isIsoDate(m[1]) && hour <= 23 && minute <= 59 && second <= 59 && offsetOk;
}

/** Validates the frontmatter of one note. Returns every issue found; an empty array means valid. */
export function validateFields(fields: Fields, opts: { claudeWritten: boolean }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (field: string, message: string, hint: string): void => {
    issues.push({ field, message, hint });
  };

  const types = Object.keys(KINDS);
  const type = fields.type;
  if (!isPresent(type)) {
    add('type', 'type is required', oneOf(types));
    return issues;
  }
  if (!isString(type) || !types.includes(type)) {
    add('type', `unknown type ${JSON.stringify(type)}`, oneOf(types));
    return issues;
  }
  const noteType = type as NoteType;

  const checkEnum = (field: string, allowed: readonly string[]): void => {
    const value = fields[field];
    if (!isPresent(value)) return;
    if (!isString(value) || !allowed.includes(value)) {
      add(field, `${field} ${JSON.stringify(value)} is not valid for type ${noteType}`, oneOf(allowed));
    }
  };

  const checkRequired = (field: string, hint: string): boolean => {
    if (isPresent(fields[field])) return true;
    add(field, `${field} is required`, hint);
    return false;
  };

  const checkDate = (field: string): void => {
    const value = fields[field];
    if (isPresent(value) && !isIsoDate(value)) {
      add(field, `${field} ${JSON.stringify(value)} is not a valid date`, HINT_DATE);
    }
  };

  const checkArray = (field: string, itemRule?: { test: RegExp; what: string; hint: string }): void => {
    const value = fields[field];
    if (!isPresent(value)) return;
    if (!isStringArray(value)) {
      add(field, `${field} must be a list of strings`, `use a list of strings, e.g. ${field}: ["one", "two"]`);
      return;
    }
    const bad = itemRule ? value.filter((item) => !itemRule.test.test(item)) : [];
    if (itemRule && bad.length > 0) {
      add(field, `${field} has ${itemRule.what}: ${bad.map((b) => JSON.stringify(b)).join(', ')}`, itemRule.hint);
    }
  };

  const wikilinks = { test: WIKILINK, what: 'entries that are not wikilinks', hint: 'use wikilinks like "[[Note title]]"' };

  // Common fields.
  if (KINDS[noteType].length > 0) checkEnum('kind', KINDS[noteType]);
  if (STATUSES[noteType].length > 0) checkEnum('status', STATUSES[noteType]);

  // Hand-written notes may omit `title` (the indexer falls back to the filename), so it is
  // required only on Claude-written notes; when present it must always be a non-empty string.
  if (!isPresent(fields.title)) {
    if (opts.claudeWritten) add('title', 'title is required on Claude-written notes', 'set title to a short non-empty string');
  } else if (!isString(fields.title) || fields.title.trim() === '') {
    add('title', 'title must be a non-empty string', 'set title to a short non-empty string');
  }

  checkDate('created');
  checkDate('updated');
  checkArray('aliases');
  checkArray('keywords');
  checkArray('anchors', wikilinks);
  checkArray('sources');
  checkEnum('confidence', CONFIDENCE);

  if (isPresent(fields.review) && fields.review !== 'needed') {
    add('review', `review ${JSON.stringify(fields.review)} is not valid`, 'use: needed');
  }

  // Claude-written knowledge notes carry provenance and a lookup summary.
  if (opts.claudeWritten && noteType !== 'source') {
    if (!isPresent(fields.summary) || (isString(fields.summary) && fields.summary.trim() === '')) {
      add('summary', 'summary is required on Claude-written notes', 'add 1-2 plain-language sentences');
    } else if (!isString(fields.summary)) {
      add('summary', 'summary must be a string', 'add 1-2 plain-language sentences');
    }
    for (const field of ['aliases', 'sources'] as const) {
      const value = fields[field];
      if (!isPresent(value) || (Array.isArray(value) && value.length === 0)) {
        add(field, `${field} needs at least one entry on Claude-written notes`, `add at least one entry to ${field}`);
      }
    }
    checkRequired('confidence', oneOf(CONFIDENCE));
  }

  // Type-specific fields.
  if (noteType === 'anchor' && fields.kind === 'organisation') checkEnum('role', ROLES);

  if (noteType === 'decision') {
    if (checkRequired('decided_on', HINT_DATE)) checkDate('decided_on');
    checkArray('supersedes', wikilinks);
    checkArray('superseded_by', wikilinks);
  }

  if (noteType === 'source') {
    if (checkRequired('captured_at', HINT_DATE_OR_DATETIME) && !isIsoDateOrDateTime(fields.captured_at)) {
      add('captured_at', `captured_at ${JSON.stringify(fields.captured_at)} is not a valid date or datetime`, HINT_DATE_OR_DATETIME);
    }
    if (checkRequired('triage', oneOf(TRIAGE))) checkEnum('triage', TRIAGE);
    checkEnum('captured_by', CAPTURED_BY);
  }

  return issues;
}

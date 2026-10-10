import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parseFields, renderNote, splitNote } from './frontmatter.js';
import type { Index } from './index/db.js';
import type { NoteRef } from './index/read.js';
import { linkTo } from './links.js';
import { sha256, titleOf } from './index/reconcile.js';
import { patchFields } from './patch.js';
import { newId, placeNote } from './place.js';
import { TRIAGE_OUTCOMES, validateFields } from './schema.js';
import { editSections, type SectionEdit } from './sections.js';
import { jaccard, titleTokens } from './similarity.js';
import { KilnError, type Base, type Fields, type NoteType, type ValidationIssue, type WriteResult } from './types.js';

export type CaptureInput = { kind: string; title: string; content: string; url?: string; sourceId?: string; why?: string };

export type CreateNoteInput = {
  type: NoteType;
  kind?: string;
  fields: Fields;
  sections: { heading: string; text: string }[];
  newReason?: string;
};

export type UpdateNoteInput = { idOrPath: string; ifRevision: string; set?: Fields; unset?: string[]; sections?: SectionEdit[] };

export type MarkSourceInput = {
  idOrPath: string;
  ifRevision: string;
  triage: 'linked' | 'dismissed';
  outcome: string;
  linkedTo?: string[];
};

export type SupersedeInput = {
  oldIdOrPath: string;
  ifRevision: string;
  newDecision: { fields: Fields; sections: { heading: string; text: string }[] };
};

export type SupersedeResult = { created: WriteResult; superseded: WriteResult };

export type StoreIo = { rename?: typeof renameSync; now?: () => Date };

/** File-lock retries: 5 attempts, 100 ms apart. */
const RENAME_ATTEMPTS = 5;
const RENAME_DELAY_MS = 100;
const LOCK_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

const SAME_TITLE = 0.85;
const SAME_SOURCES_TITLE = 0.5;

const WIKILINK = /^\[\[[^\[\]]+\]\]$/;

/** Fields kiln assigns itself; updates may not set or unset them. */
const KILN_OWNED = ['id', 'created'];

/** A base-relative path in comparable form: forward slashes, and lowercased on Windows (case-insensitive paths). */
export function pathKey(rel: string): string {
  const p = rel.replace(/\\/g, '/');
  return process.platform === 'win32' ? p.toLowerCase() : p;
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function invalid(issues: ValidationIssue[]): KilnError {
  const detail = issues.map((i) => `${i.field}: ${i.message} (${i.hint})`).join('; ');
  return new KilnError('validation', `Invalid note: ${detail}`, { issues });
}

function validate(fields: Fields, claudeWritten: boolean): void {
  const issues = validateFields(fields, { claudeWritten });
  if (issues.length > 0) throw invalid(issues);
}

/** Title similarity for duplicate detection: word-token Jaccard, with equal trimmed lowercase titles scoring 1. */
function similarity(a: string, b: string): number {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return 1;
  return jaccard(titleTokens(a), titleTokens(b));
}

/** A `sources` value as a lowercase set; a lone string counts as one entry. */
function sourceSet(value: unknown): Set<string> {
  const list = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
  return new Set(list.filter((s): s is string => typeof s === 'string').map((s) => s.trim().toLowerCase()));
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

type CandidateRow = NoteRef & { sources: string | null };

/** A write worked out and validated but not yet made: the target, its new text and id, and the note's fields. */
type Planned = { rel: string; text: string; id: string | null; fields: Fields };

/** A note read under the lock with its revision checked: its path, text and current fields. */
type Current = { rel: string; text: string; fields: Fields };

function toRef(r: NoteRef): NoteRef {
  return { id: r.id, path: r.path, title: r.title, type: r.type, kind: r.kind, status: r.status, updated: r.updated };
}

/**
 * The only way kiln writes notes. Every write validates first, then runs inside `index.transaction()` (the
 * cross-process write lock): re-read and check the revision where one is given, write `<file>.kiln-tmp`, rename it
 * over the target (retrying while the file is locked), then index the new text.
 */
export class Store {
  readonly base: Base;
  readonly index: Index;
  readonly #rename: typeof renameSync;
  readonly #now: () => Date;

  constructor(base: Base, index: Index, io: StoreIo = {}) {
    this.base = base;
    this.index = index;
    this.#rename = io.rename ?? renameSync;
    this.#now = io.now ?? (() => new Date());
  }

  /**
   * Capture a source into the inbox; a new source gets an `id`. With a `sourceId`, `dedupe_key` is `kind:sourceId`,
   * and a repeat capture of the same key replaces the existing source's body and bumps `captured_at` and `updated`.
   * When the body changed, `triage` returns to `pending` (`triage_outcome` and `linked_to` stay as history); the id and
   * everything else stay as they are.
   */
  capture(i: CaptureInput): WriteResult {
    this.index.ensureFresh();
    const now = this.#now();
    const today = localDate(now);
    const capturedAt = now.toISOString();
    const dedupeKey = i.sourceId !== undefined ? `${i.kind}:${i.sourceId}` : undefined;

    const fields: Fields = {
      type: 'source',
      kind: i.kind,
      title: i.title,
      created: today,
      updated: today,
      captured_at: capturedAt,
      captured_by: 'manual',
      triage: 'pending',
      url: i.url,
      source_id: i.sourceId,
      dedupe_key: dedupeKey,
      why: i.why,
    };
    for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k];
    validate(fields, false);

    return this.index.transaction(() => {
      const existing = dedupeKey === undefined ? undefined : this.#sourceByKey(dedupeKey);
      if (existing !== undefined) return this.#recapture(existing, dedupeKey!, i.content, today, capturedAt);
      const id = newId();
      const source = { id, ...fields };
      const rel = placeNote(source, (p) => existsSync(join(this.base.path, p)));
      const text = renderNote(source, []) + i.content.replace(/\r?\n/g, '\n');
      return this.#write(rel, text, id, true);
    });
  }

  /**
   * Create a Claude-written knowledge note in its conventional folder. Validates with `claudeWritten: true`, then
   * (unless `newReason` is given) raises `conflict` with `reason: 'duplicate'` when a matching note exists.
   */
  createNote(i: CreateNoteInput): WriteResult {
    this.index.ensureFresh();
    return this.index.transaction(() => {
      const p = this.#planCreate(i, new Set());
      return this.#write(p.rel, p.text, p.id, true);
    });
  }

  /**
   * Change fields and/or sections of a note, guarded by `ifRevision` (the sha256 of the bytes last read). Only the
   * targeted keys and sections change, and `updated` is bumped. Merged fields are validated when they have a `type`.
   */
  updateNote(i: UpdateNoteInput): WriteResult {
    this.index.ensureFresh();
    return this.#update(i);
  }

  /** Record the triage outcome on a source: `triage`, `triage_outcome` and, when given, `linked_to`. */
  markSource(i: MarkSourceInput): WriteResult {
    this.index.ensureFresh();
    const issues: ValidationIssue[] = [];
    if (i.triage !== 'linked' && i.triage !== 'dismissed') {
      issues.push({ field: 'triage', message: `triage ${JSON.stringify(i.triage)} is not a triage outcome`, hint: 'use one of: linked, dismissed' });
    }
    if (!TRIAGE_OUTCOMES.includes(i.outcome)) {
      issues.push({ field: 'triage_outcome', message: `unknown triage outcome ${JSON.stringify(i.outcome)}`, hint: `use one of: ${TRIAGE_OUTCOMES.join(', ')}` });
    }
    if (i.linkedTo !== undefined && !(Array.isArray(i.linkedTo) && i.linkedTo.every((l) => typeof l === 'string' && WIKILINK.test(l)))) {
      issues.push({ field: 'linked_to', message: 'linked_to must be a list of wikilinks', hint: 'use wikilinks like "[[Note title]]"' });
    }
    if (issues.length > 0) throw invalid(issues);

    const set: Fields = { triage: i.triage, triage_outcome: i.outcome };
    if (i.linkedTo !== undefined) set.linked_to = i.linkedTo;
    return this.#update({ idOrPath: i.idOrPath, ifRevision: i.ifRevision, set }, (fields) => {
      if (fields.type !== 'source') {
        throw invalid([{ field: 'type', message: `only a source can be triaged; this note's type is ${JSON.stringify(fields.type ?? null)}`, hint: 'call markSource on a source note' }]);
      }
    });
  }

  /**
   * Replace a decision with a new one, under one lock. Both writes are planned and validated before either is made:
   * the old note's revision and type; the new decision (validated and duplicate-checked, the old decision aside) with
   * `supersedes`, `review: needed` and `review_reason`; then the old note's patch to `status: superseded` with
   * `superseded_by`. Both links are `[[<file stem>|<title>]]` (see `linkTo`), so Obsidian resolves the date-prefixed
   * file names. Then the new file is written, then the old one. If a write fails while the old file is still unpatched on disk,
   * the new file is moved to `.kiln/trash/`; the index rolls back and the original error is rethrown. If both files
   * landed (the failure came after the old file's rename), both stay: they agree, and the next reconcile indexes them.
   */
  supersede(i: SupersedeInput): SupersedeResult {
    this.index.ensureFresh();
    return this.index.transaction(() => {
      const old = this.#readChecked(i.oldIdOrPath, i.ifRevision, (fields) => {
        if (fields.type !== 'decision') {
          throw invalid([
            { field: 'type', message: `only a decision can be superseded; this note's type is ${JSON.stringify(fields.type ?? null)}`, hint: 'call supersede on a decision note' },
          ]);
        }
      });
      // Plan the new decision first: the old one's superseded_by links to its file stem.
      const oldTitle = titleOf(old.fields, old.rel);
      const newPlan = this.#planCreate(
        {
          type: 'decision',
          fields: { ...i.newDecision.fields, supersedes: [linkTo(old.rel, oldTitle)], review: 'needed', review_reason: `supersedes ${oldTitle}` },
          sections: i.newDecision.sections,
        },
        new Set([old.rel]),
      );
      const oldPlan = this.#planPatch(old, {
        set: { status: 'superseded', superseded_by: [linkTo(newPlan.rel, newPlan.fields.title as string)] },
      });

      try {
        const created = this.#write(newPlan.rel, newPlan.text, newPlan.id, true);
        const superseded = this.#write(oldPlan.rel, oldPlan.text, oldPlan.id, false);
        return { created, superseded };
      } catch (e) {
        const newLanded = existsSync(join(this.base.path, newPlan.rel));
        if (newLanded && this.#revisionOf(oldPlan.rel) === i.ifRevision) this.#trash(newPlan.rel, e);
        throw e;
      }
    });
  }

  /** The sha256 of a file's bytes, or null when it cannot be read. */
  #revisionOf(rel: string): string | null {
    try {
      return sha256(readFileSync(join(this.base.path, rel)));
    } catch {
      return null;
    }
  }

  /**
   * Move a just-written file to `.kiln/trash/<timestamp>-<name>` (a rename, never a delete) while unwinding a failed
   * write. A failed move is attached to `cause`'s `details` as `rollback` so the original error still surfaces.
   */
  #trash(rel: string, cause: unknown): void {
    const stamp = this.#now().toISOString().replace(/[:.]/g, '-');
    const name = basename(rel, '.md');
    const dir = join(this.base.path, '.kiln', 'trash');
    try {
      mkdirSync(dir, { recursive: true });
      let target = join(dir, `${stamp}-${name}.md`);
      for (let n = 2; existsSync(target); n++) target = join(dir, `${stamp}-${name} (${n}).md`);
      this.#renameWithRetry(join(this.base.path, rel), target, rel);
    } catch (moveError) {
      if (cause !== null && typeof cause === 'object') {
        const prior = (cause as { details?: unknown }).details;
        const details = prior !== null && typeof prior === 'object' ? prior : prior === undefined ? {} : { original: prior };
        const message = moveError instanceof Error ? moveError.message : String(moveError);
        Object.assign(cause, { details: { ...details, rollback: { path: rel, error: `could not move the new file to .kiln/trash: ${message}` } } });
      }
    }
  }

  /**
   * Plan a new note without writing: assign id and dates, validate as Claude-written, run the duplicate check (unless
   * `newReason` is given) leaving out `excludePaths` (supersede excludes the decision it replaces), and place it. The
   * caller holds the transaction.
   */
  #planCreate(i: CreateNoteInput, excludePaths: Set<string>): Planned {
    const today = localDate(this.#now());
    const fields: Fields = { ...i.fields, type: i.type };
    if (i.kind !== undefined) fields.kind = i.kind;
    fields.id = newId();
    fields.created = today;
    fields.updated = today;
    validate(fields, true);

    if (i.newReason === undefined) {
      const existing = this.#findDuplicate(fields, excludePaths);
      if (existing) {
        throw new KilnError(
          'conflict',
          `A similar ${existing.type} already exists: "${existing.title}" (${existing.path}). Update it instead, or retry with newReason`,
          { reason: 'duplicate', existing },
        );
      }
    }
    const rel = placeNote(fields, (p) => existsSync(join(this.base.path, p)));
    return { rel, text: renderNote(fields, i.sections), id: fields.id as string, fields };
  }

  /**
   * The best existing match for a new note, or null. A note matches on an equal `dedupe_key` (preferred), or when it
   * has the same type and a title similarity of at least 0.85, or the same non-empty `sources` set and at least 0.5.
   */
  #findDuplicate(fields: Fields, excludePaths: Set<string>): NoteRef | null {
    const cols = 'n.id, n.path, n.title, n.type, n.kind, n.status, n.updated';
    const db = this.index.db;
    const excluded = new Set([...excludePaths].map(pathKey));
    const key = fields.dedupe_key;
    if (typeof key === 'string' && key !== '') {
      const rows = db
        .prepare(`SELECT ${cols} FROM notes n WHERE json_extract(n.fields_json, '$.dedupe_key') = ? ORDER BY n.path`)
        .all(key) as NoteRef[];
      const hit = rows.find((r) => !excluded.has(pathKey(r.path)));
      if (hit) return toRef(hit);
    }

    const title = fields.title as string;
    const sources = sourceSet(fields.sources);
    const rows = db
      .prepare(`SELECT ${cols}, n.fields_json -> '$.sources' AS sources FROM notes n WHERE n.type = ? ORDER BY n.path`)
      .all(fields.type as string) as CandidateRow[];
    let best: { ref: NoteRef; score: number } | null = null;
    for (const r of rows) {
      if (excluded.has(pathKey(r.path))) continue;
      const score = similarity(title, r.title);
      const matches =
        score >= SAME_TITLE ||
        (score >= SAME_SOURCES_TITLE && sources.size > 0 && r.sources !== null && sameSet(sources, sourceSet(JSON.parse(r.sources))));
      if (matches && (best === null || score > best.score)) best = { ref: toRef(r), score };
    }
    return best?.ref ?? null;
  }

  /** The indexed source with this `dedupe_key`, if any. */
  #sourceByKey(key: string): string | undefined {
    const row = this.index.db
      .prepare("SELECT path FROM notes WHERE type = 'source' AND json_extract(fields_json, '$.dedupe_key') = ? ORDER BY path LIMIT 1")
      .get(key) as { path: string } | undefined;
    return row?.path;
  }

  /**
   * Replace a captured source's body (in the file's EOL) and bump `captured_at` and `updated`; a changed body also sets
   * `triage: pending`.
   */
  #recapture(rel: string, key: string, content: string, today: string, capturedAt: string): WriteResult {
    const text = this.#read(rel);
    const split = splitNote(text);
    const fields = parseFields(split.fmText);
    if (fields.dedupe_key !== key) {
      throw new KilnError('conflict', `"${rel}" changed on disk and no longer has dedupe_key ${key}; re-read it and try again`, {
        reason: 'stale_revision',
        current: sha256(Buffer.from(text, 'utf8')),
      });
    }
    let head = text.slice(0, text.length - split.body.length);
    // A file that ends at the closing fence with no EOL: start the body on a line of its own.
    if (!head.endsWith('\n')) head += split.eol;
    const body = content.replace(/\r?\n/g, split.eol);
    const replaced = head + body;
    const set: Fields = { captured_at: capturedAt, updated: today };
    // New content means the item moved on: back to the inbox. triage_outcome and linked_to stay as history.
    if (body !== split.body && fields.triage !== 'pending') set.triage = 'pending';
    const id = typeof fields.id === 'string' && fields.id !== '' ? fields.id : null;
    return this.#write(rel, patchFields(replaced, set), id, false);
  }

  /** The revision-guarded update path shared by updateNote and markSource: plan, then write, under one lock. */
  #update(i: UpdateNoteInput, check?: (fields: Fields) => void): WriteResult {
    return this.index.transaction(() => {
      const p = this.#planUpdate(i, check);
      return this.#write(p.rel, p.text, p.id, false);
    });
  }

  /**
   * Plan a revision-guarded update without writing: refuse kiln-owned keys, resolve the note, re-read it and check
   * `ifRevision`, run `check` on its current fields (it may throw to refuse), merge, validate and patch the text. The
   * result's `fields` are the note's fields before the update. The caller holds the transaction.
   */
  #planUpdate(i: UpdateNoteInput, check?: (fields: Fields) => void): Planned {
    const owned = KILN_OWNED.filter((k) => (i.set !== undefined && Object.hasOwn(i.set, k)) || (i.unset ?? []).includes(k));
    if (owned.length > 0) {
      throw invalid(owned.map((k) => ({ field: k, message: `${k} is assigned by kiln and cannot be changed`, hint: `remove ${k} from set and unset` })));
    }
    return this.#planPatch(this.#readChecked(i.idOrPath, i.ifRevision, check), i);
  }

  /** Resolve a note, re-read it, check `ifRevision`, and run `check` on its current fields (it may throw to refuse). */
  #readChecked(idOrPath: string, ifRevision: string, check?: (fields: Fields) => void): Current {
    const rel = this.index.get(idOrPath).path;
    const bytes = this.#readBytes(rel);
    const current = sha256(bytes);
    if (current !== ifRevision) {
      throw new KilnError('conflict', `"${rel}" has changed since revision ${ifRevision}; re-read it and redo the change`, {
        reason: 'stale_revision',
        current,
      });
    }
    const text = bytes.toString('utf8');
    const fields = parseFields(splitNote(text).fmText);
    check?.(fields);
    return { rel, text, fields };
  }

  /** Merge, validate and patch an already read and checked note. The result's `fields` are those before the update. */
  #planPatch({ rel, text, fields }: Current, i: Pick<UpdateNoteInput, 'set' | 'unset' | 'sections'>): Planned {
    const updated = localDate(this.#now());
    const unset = i.unset ?? [];
    const set: Fields = { ...i.set, updated };
    const merged: Fields = { ...fields, ...set };
    for (const k of unset) if (k !== 'updated') delete merged[k];
    if (merged.type !== undefined && merged.type !== null) validate(merged, false);

    let next = patchFields(text, set, unset.filter((k) => k !== 'updated'));
    if (i.sections && i.sections.length > 0) next = editSections(next, i.sections);
    const id = typeof merged.id === 'string' && merged.id !== '' ? merged.id : null;
    return { rel, text: next, id, fields };
  }

  #readBytes(rel: string): Buffer {
    try {
      return readFileSync(join(this.base.path, rel));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new KilnError('not_found', `Note file "${rel}" no longer exists`);
      throw e;
    }
  }

  #read(rel: string): string {
    return this.#readBytes(rel).toString('utf8');
  }

  /**
   * Write `text` to `rel` atomically and index it: write `<file>.kiln-tmp`, rename it over the target with
   * `#renameWithRetry`, then upsert the index. A failed rename removes the temp file. The caller holds the transaction.
   */
  #write(rel: string, text: string, id: string | null, created: boolean): WriteResult {
    const abs = join(this.base.path, rel);
    const tmp = `${abs}.kiln-tmp`;
    const bytes = Buffer.from(text, 'utf8');
    mkdirSync(dirname(abs), { recursive: true });
    try {
      writeFileSync(tmp, bytes);
    } catch (e) {
      rmSync(tmp, { force: true });
      throw e;
    }

    try {
      this.#renameWithRetry(tmp, abs, rel);
    } catch (e) {
      rmSync(tmp, { force: true });
      throw e;
    }

    this.index.upsertText(rel, text, statSync(abs));
    return { id, path: rel, revision: sha256(bytes), created };
  }

  /**
   * Rename `from` to `to`, retrying while the file is locked (EPERM/EBUSY/EACCES: 5 attempts, 100 ms apart). A lock
   * that outlasts the retries raises `locked_file` naming `rel`; any other error is rethrown as is.
   */
  #renameWithRetry(from: string, to: string, rel: string): void {
    for (let attempt = 1; ; attempt++) {
      try {
        this.#rename(from, to);
        return;
      } catch (e) {
        const locked = LOCK_CODES.has((e as NodeJS.ErrnoException).code ?? '');
        if (locked && attempt < RENAME_ATTEMPTS) {
          sleepSync(RENAME_DELAY_MS);
          continue;
        }
        if (!locked) throw e;
        throw new KilnError(
          'locked_file',
          `"${rel}" is locked by another program (Obsidian, sync or antivirus); close it or wait, then try again`,
          { path: rel },
        );
      }
    }
  }
}

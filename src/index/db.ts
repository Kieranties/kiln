import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { KilnError, type Base } from '../types.js';
import { IndexWriter, reconcileFiles, sha256, type FileStat, type ReconcileStats } from './reconcile.js';

export type { ReconcileStats } from './reconcile.js';

/** Bump when the DDL below changes; a mismatch drops, recreates and repopulates the tables in one transaction. */
export const SCHEMA_VERSION = 1;

const BUSY_TIMEOUT_MS = 5_000;
const FRESH_MS = 10_000;

const TABLES = ['files', 'notes', 'links', 'aliases', 'fts'];

const DDL = `
CREATE TABLE files (
  path  TEXT PRIMARY KEY,
  size  INTEGER NOT NULL,
  mtime REAL NOT NULL,
  hash  TEXT NOT NULL,
  id    TEXT
);
CREATE TABLE notes (
  rowid       INTEGER PRIMARY KEY,
  path        TEXT NOT NULL UNIQUE,
  id          TEXT,
  type        TEXT,
  kind        TEXT,
  title       TEXT NOT NULL,
  status      TEXT,
  triage      TEXT,
  review      TEXT,
  created     TEXT,
  updated     TEXT,
  fields_json TEXT NOT NULL
);
CREATE INDEX notes_id ON notes(id);
CREATE INDEX notes_type_status ON notes(type, status);
CREATE TABLE links (
  src_path TEXT NOT NULL,
  target   TEXT NOT NULL
);
CREATE INDEX links_src ON links(src_path);
CREATE INDEX links_target ON links(target);
CREATE TABLE aliases (
  name_lc TEXT NOT NULL,
  path    TEXT NOT NULL
);
CREATE INDEX aliases_name ON aliases(name_lc);
CREATE INDEX aliases_path ON aliases(path);
CREATE VIRTUAL TABLE fts USING fts5(
  title, aliases, summary, keywords, body,
  content='', contentless_delete=1, tokenize='porter unicode61'
);
`;

function schemaVersion(db: DatabaseSync): number {
  return (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

/** Drop any existing kiln tables and create the current schema. The caller holds the transaction. */
function recreateSchema(db: DatabaseSync): void {
  for (const t of TABLES) db.exec(`DROP TABLE IF EXISTS ${t}`);
  db.exec(DDL);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

/** SQLITE_BUSY (5) or SQLITE_LOCKED (6), including their extended codes. */
function isBusy(e: unknown): boolean {
  const code = (e as { errcode?: unknown }).errcode;
  return typeof code === 'number' && ((code & 0xff) === 5 || (code & 0xff) === 6);
}

/** SQLITE_CORRUPT (11) or SQLITE_NOTADB (26), including their extended codes. */
function isCorrupt(e: unknown): boolean {
  const code = (e as { errcode?: unknown }).errcode;
  return typeof code === 'number' && ((code & 0xff) === 11 || (code & 0xff) === 26);
}

/**
 * Rename a corrupt `kiln.sqlite` and its `-wal`/`-shm` to `kiln.sqlite.corrupt-<timestamp>[-wal|-shm]`.
 * Raises `KilnError('busy')` when another process holds the files open.
 */
function setAside(file: string): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      renameSync(file + suffix, `${file}.corrupt-${stamp}${suffix}`);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' && suffix !== '') continue;
      if (code === 'EBUSY' || code === 'EPERM') {
        throw new KilnError('busy', 'The kiln index is corrupt and is held open by another session; close it and try again', {
          cause: e,
        });
      }
      throw e;
    }
  }
}

/**
 * kiln's rebuildable SQLite index over one base, at `<base>/.kiln/index/kiln.sqlite` (WAL).
 * Every write runs inside `transaction()` (`BEGIN IMMEDIATE`), which is the cross-process write lock.
 */
export class Index {
  readonly base: Base;
  readonly db: DatabaseSync;
  readonly #now: () => number;
  #depth = 0;
  #lastCheck: number | undefined;
  #writer: IndexWriter | undefined;

  private constructor(base: Base, db: DatabaseSync, now: () => number) {
    this.base = base;
    this.db = db;
    this.#now = now;
  }

  /**
   * Open (creating if needed) the base's index. A missing or outdated schema is rebuilt from the files before returning.
   * A corrupt index file is renamed aside (never deleted) and rebuilt; this is retried once only.
   */
  static open(base: Base, opts: { now?: () => number } = {}): Index {
    const dir = join(base.path, '.kiln', 'index');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'kiln.sqlite');
    const now = opts.now ?? Date.now;
    try {
      return Index.#openAt(base, file, now);
    } catch (e) {
      if (!isCorrupt(e)) throw e;
      setAside(file);
      return Index.#openAt(base, file, now);
    }
  }

  static #openAt(base: Base, file: string, now: () => number): Index {
    const db = new DatabaseSync(file);
    const index = new Index(base, db, now);
    try {
      db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
      db.exec('PRAGMA journal_mode = WAL');
      db.exec('PRAGMA synchronous = NORMAL');
      if (schemaVersion(db) !== SCHEMA_VERSION) index.reconcile();
    } catch (e) {
      db.close();
      throw e;
    }
    return index;
  }

  /**
   * Run `fn` holding the write lock (`BEGIN IMMEDIATE` … `COMMIT`; `ROLLBACK` and rethrow on error).
   * Re-entrant: a nested call joins the outer transaction, and an error anywhere rolls back the whole of it.
   * Raises `KilnError('busy')` when another writer holds the lock past the busy timeout.
   */
  transaction<T>(fn: () => T): T {
    if (this.#depth > 0) {
      this.#depth++;
      try {
        return fn();
      } finally {
        this.#depth--;
      }
    }

    try {
      this.db.exec('BEGIN IMMEDIATE');
    } catch (e) {
      throw isBusy(e) ? new KilnError('busy', 'Another kiln session is writing to this base; try again shortly', { cause: e }) : e;
    }
    this.#depth = 1;
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw isBusy(e) ? new KilnError('busy', 'The kiln index is busy; try again shortly', { cause: e }) : e;
    } finally {
      this.#depth = 0;
    }
  }

  /** Bring the index in line with the files; see `reconcileFiles`. A schema mismatch forces an in-place rebuild. */
  reconcile(opts: { force?: boolean } = {}): ReconcileStats {
    const startedAt = this.#now();
    const t0 = performance.now();
    const stats = this.transaction(() => {
      const schemaChanged = schemaVersion(this.db) !== SCHEMA_VERSION;
      if (schemaChanged) recreateSchema(this.db);
      return reconcileFiles(this.db, this.base.path, this.#getWriter(), (opts.force ?? false) || schemaChanged);
    });
    this.#lastCheck = startedAt;
    return { ...stats, ms: performance.now() - t0 };
  }

  /**
   * Reconcile when this process last checked more than `maxAgeMs` ago (or never). When another session holds the
   * write lock past the busy timeout, carry on with the committed snapshot (WAL readers are not blocked) and leave
   * the last-check time alone so the next call retries.
   */
  ensureFresh(maxAgeMs = FRESH_MS): void {
    if (this.#lastCheck !== undefined && this.#now() - this.#lastCheck <= maxAgeMs) return;
    try {
      this.reconcile();
    } catch (e) {
      if (!(e instanceof KilnError && e.code === 'busy')) throw e;
    }
  }

  /** Index a note kiln has just written, from its text and the written file's stat. Joins the caller's transaction. */
  upsertText(rel: string, text: string, stat: FileStat): void {
    const bytes = Buffer.from(text, 'utf8');
    this.transaction(() =>
      this.#getWriter().upsert(rel.replace(/\\/g, '/'), text, sha256(bytes), { size: stat.size, mtimeMs: stat.mtimeMs }),
    );
  }

  close(): void {
    if (this.db.isOpen) this.db.close();
  }

  #getWriter(): IndexWriter {
    return (this.#writer ??= new IndexWriter(this.db));
  }
}

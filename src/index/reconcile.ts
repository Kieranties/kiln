import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { parseFields, splitNote } from '../frontmatter.js';
import { extractLinks } from '../links.js';
import { KilnError, type Fields } from '../types.js';

export type ReconcileStats = {
  scanned: number;
  added: number;
  changed: number;
  removed: number;
  rebuilt: boolean;
  ms: number;
};

export type FileStat = { size: number; mtimeMs: number };

/** Rebuild instead of patching when more than this share of previously indexed files was added, changed or removed. */
const REBUILD_CHURN = 0.3;

type ScannedFile = FileStat & { rel: string; abs: string };
type KnownFile = { size: number; mtime: number; hash: string };

/**
 * Every `*.md` file under `root`, with base-relative forward-slash paths. Skips directories whose name starts with
 * `.` at any depth (`.kiln`, `.obsidian`, `.git`, `.trash`) and the root `views/` folder.
 */
export function scanVault(root: string): ScannedFile[] {
  const out: ScannedFile[] = [];
  const walk = (abs: string, rel: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childAbs = join(abs, entry.name);
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || childRel === 'views') continue;
        walk(childAbs, childRel);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const st = statSync(childAbs, { throwIfNoEntry: false });
        if (st) out.push({ rel: childRel, abs: childAbs, size: st.size, mtimeMs: st.mtimeMs });
      }
    }
  };
  walk(root, '');
  return out;
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function text(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

/** The frontmatter `title` when it is a non-empty string, otherwise the file name without `.md`. */
export function titleOf(fields: Fields, rel: string): string {
  const t = fields.title;
  if (typeof t === 'string' && t.trim() !== '') return t;
  return rel.slice(rel.lastIndexOf('/') + 1).replace(/\.md$/, '');
}

/** Prepared, reused statements that write one note into every index table. */
export class IndexWriter {
  readonly #findRow: StatementSync;
  readonly #deleteFile: StatementSync;
  readonly #deleteNote: StatementSync;
  readonly #deleteLinks: StatementSync;
  readonly #deleteAliases: StatementSync;
  readonly #deleteFts: StatementSync;
  readonly #insertFile: StatementSync;
  readonly #insertNote: StatementSync;
  readonly #insertLink: StatementSync;
  readonly #insertAlias: StatementSync;
  readonly #insertFts: StatementSync;
  readonly #touchFile: StatementSync;
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
    this.#findRow = db.prepare('SELECT rowid FROM notes WHERE path = ?');
    this.#deleteFile = db.prepare('DELETE FROM files WHERE path = ?');
    this.#deleteNote = db.prepare('DELETE FROM notes WHERE rowid = ?');
    this.#deleteLinks = db.prepare('DELETE FROM links WHERE src_path = ?');
    this.#deleteAliases = db.prepare('DELETE FROM aliases WHERE path = ?');
    this.#deleteFts = db.prepare('DELETE FROM fts WHERE rowid = ?');
    this.#insertFile = db.prepare(
      'INSERT OR REPLACE INTO files(path, size, mtime, hash, id) VALUES (?, ?, ?, ?, ?)',
    );
    this.#insertNote = db.prepare(
      'INSERT INTO notes(path, id, type, kind, title, status, triage, review, created, updated, fields_json) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    this.#insertLink = db.prepare('INSERT INTO links(src_path, target, target_lc) VALUES (?, ?, ?)');
    this.#insertAlias = db.prepare('INSERT INTO aliases(name_lc, path) VALUES (?, ?)');
    this.#insertFts = db.prepare(
      'INSERT INTO fts(rowid, title, aliases, summary, keywords, body) VALUES (?, ?, ?, ?, ?, ?)',
    );
    this.#touchFile = db.prepare('UPDATE files SET size = ?, mtime = ? WHERE path = ?');
  }

  /** Remove a path from every table. */
  remove(rel: string): void {
    this.#removeNote(rel);
    this.#deleteFile.run(rel);
  }

  /** Record a new size and mtime for a file whose bytes are unchanged. */
  touch(rel: string, stat: FileStat): void {
    this.#touchFile.run(stat.size, stat.mtimeMs, rel);
  }

  /** Empty every table (in place; the caller holds the transaction). */
  clear(): void {
    this.#db.exec("DELETE FROM files; DELETE FROM notes; DELETE FROM links; DELETE FROM aliases; INSERT INTO fts(fts) VALUES('delete-all');");
  }

  /**
   * Index one note. Unparseable frontmatter is indexed with empty fields (so `type` is null) rather than thrown.
   * `fresh` skips clearing earlier rows for the path, for use straight after `clear()`.
   */
  upsert(rel: string, content: string, hash: string, stat: FileStat, fresh = false): void {
    if (!fresh) this.#removeNote(rel);

    const split = splitNote(content);
    let fields: Fields;
    try {
      fields = parseFields(split.fmText);
    } catch (e) {
      if (!(e instanceof KilnError && e.code === 'validation')) throw e;
      fields = {};
    }
    const id = typeof fields.id === 'string' && fields.id !== '' ? fields.id : null;
    const title = titleOf(fields, rel);
    const aliases = strings(fields.aliases);

    this.#insertFile.run(rel, stat.size, stat.mtimeMs, hash, id);
    const { lastInsertRowid: rowid } = this.#insertNote.run(
      rel,
      id,
      text(fields.type),
      text(fields.kind),
      title,
      text(fields.status),
      text(fields.triage),
      text(fields.review),
      text(fields.created),
      text(fields.updated),
      JSON.stringify(fields),
    );
    for (const target of extractLinks(fields, split.body)) this.#insertLink.run(rel, target, target.toLowerCase());
    for (const name of new Set([title, ...aliases].map((a) => a.toLowerCase()))) this.#insertAlias.run(name, rel);
    this.#insertFts.run(
      rowid,
      title,
      aliases.join(' '),
      typeof fields.summary === 'string' ? fields.summary : '',
      strings(fields.keywords).join(' '),
      split.body,
    );
  }

  #removeNote(rel: string): void {
    const row = this.#findRow.get(rel) as { rowid: number } | undefined;
    if (row) {
      this.#deleteFts.run(row.rowid);
      this.#deleteNote.run(row.rowid);
    }
    this.#deleteLinks.run(rel);
    this.#deleteAliases.run(rel);
  }
}

/** Read a scanned file; null when it vanished after the scan. */
function readScanned(f: ScannedFile): Buffer | null {
  try {
    return readFileSync(f.abs);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

/**
 * Bring the index tables in line with the files under `root`. The caller holds the write transaction.
 * Files with unchanged size and mtime are skipped; others are read, hashed and re-parsed only when the hash differs.
 * Rebuilds every table in place when `force` is set or churn exceeds 30% of the previously indexed files.
 */
export function reconcileFiles(db: DatabaseSync, root: string, writer: IndexWriter, force: boolean): Omit<ReconcileStats, 'ms'> {
  const known = new Map<string, KnownFile>();
  for (const row of db.prepare('SELECT path, size, mtime, hash FROM files').all() as (KnownFile & { path: string })[]) {
    known.set(row.path, { size: row.size, mtime: row.mtime, hash: row.hash });
  }

  const scanned = scanVault(root);
  const seen = new Set<string>();
  let added = 0;
  let statChanged = 0;
  for (const f of scanned) {
    seen.add(f.rel);
    const k = known.get(f.rel);
    if (!k) added++;
    else if (k.size !== f.size || k.mtime !== f.mtimeMs) statChanged++;
  }
  const gone = [...known.keys()].filter((p) => !seen.has(p));
  const churn = (added + statChanged + gone.length) / Math.max(1, known.size);
  const rebuilt = force || churn > REBUILD_CHURN;

  let changed = 0;
  let removed = gone.length;
  added = 0;
  if (rebuilt) {
    writer.clear();
    for (const f of scanned) {
      const bytes = readScanned(f);
      if (!bytes) {
        if (known.has(f.rel)) removed++;
        continue;
      }
      const hash = sha256(bytes);
      const k = known.get(f.rel);
      if (!k) added++;
      else if (k.hash !== hash) changed++;
      writer.upsert(f.rel, bytes.toString('utf8'), hash, f, true);
    }
  } else {
    for (const rel of gone) writer.remove(rel);
    for (const f of scanned) {
      const k = known.get(f.rel);
      if (k && k.size === f.size && k.mtime === f.mtimeMs) continue;
      const bytes = readScanned(f);
      if (!bytes) {
        if (k) {
          writer.remove(f.rel);
          removed++;
        }
        continue;
      }
      const hash = sha256(bytes);
      if (!k) added++;
      else if (k.hash === hash) {
        writer.touch(f.rel, f);
        continue;
      } else changed++;
      writer.upsert(f.rel, bytes.toString('utf8'), hash, f);
    }
  }

  return { scanned: scanned.length, added, changed, removed, rebuilt };
}

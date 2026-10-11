import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

describe('node:sqlite capabilities', () => {
  it('supports contentless FTS5 with delete and bm25 weights', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(
      "create virtual table t using fts5(title, body, content='', contentless_delete=1, tokenize='porter unicode61')",
    );
    db.prepare('insert into t(rowid, title, body) values (?, ?, ?)').run(1, 'Renewal host', 'subscriptions renew');
    db.prepare('insert into t(rowid, title, body) values (?, ?, ?)').run(2, 'Unrelated note', 'nothing to see here');

    const match = () =>
      (
        db.prepare("select rowid from t where t match 'renewing' order by bm25(t, 5, 1)").all() as {
          rowid: number;
        }[]
      ).map((r) => r.rowid);

    expect(match()).toEqual([1]);

    db.prepare('delete from t where rowid = ?').run(1);
    expect(match()).toEqual([]);

    db.close();
  });
});

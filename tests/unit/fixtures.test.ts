import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseFields, splitNote } from '../../src/frontmatter.js';
import { Index } from '../../src/index/db.js';
import { TRIAGE_OUTCOMES } from '../../src/schema.js';
import { validateBase } from '../../src/validate.js';

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));
const BASE = join(FIXTURES, 'base');
const CAPTURES = join(FIXTURES, 'day', 'captures');
const DENYLIST = join(FIXTURES, 'denylist.txt');

/** Every file under `dir`, as absolute paths. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name));
}

const GOLDEN_CATEGORIES = ['exact_term', 'vocab_mismatch', 'decision_temporal', 'multi_hop', 'resume_status'];

type Capture = { file: string; expected_outcome: string; targets: string[] };

describe('fixtures', () => {
  it('fixture base passes validateBase with zero schema findings', () => {
    // The index writes .kiln/ into the base, so validate a copy rather than the committed fixtures.
    const tmp = mkdtempSync(join(tmpdir(), 'kiln-fixtures-'));
    cpSync(BASE, tmp, { recursive: true });
    const ix = Index.open({ name: 'northwind', path: tmp });
    try {
      expect(validateBase(ix)).toEqual([]);
    } finally {
      ix.close();
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('every golden primary/secondary path exists', () => {
    const golden = JSON.parse(readFileSync(join(FIXTURES, 'golden.json'), 'utf8')) as {
      questions: { id: string; category: string; primary: string[]; secondary: string[] }[];
    };
    expect(golden.questions).toHaveLength(20);
    expect(new Set(golden.questions.map((q) => q.id)).size).toBe(golden.questions.length);
    for (const q of golden.questions) {
      expect(GOLDEN_CATEGORIES, q.id).toContain(q.category);
      expect(q.primary.length, q.id).toBeGreaterThan(0);
    }
    for (const c of GOLDEN_CATEGORIES) {
      expect(
        golden.questions.filter((q) => q.category === c),
        c,
      ).toHaveLength(4);
    }
    const missing = golden.questions.flatMap((q) =>
      [...q.primary, ...q.secondary].filter((p) => !existsSync(join(BASE, p))).map((p) => `${q.id}: ${p}`),
    );
    expect(missing).toEqual([]);
  });

  it('answer key covers every capture file and uses TRIAGE_OUTCOMES', () => {
    const key = JSON.parse(readFileSync(join(FIXTURES, 'day', 'answer-key.json'), 'utf8')) as { captures: Capture[] };
    const files = readdirSync(CAPTURES)
      .filter((f) => f.endsWith('.md'))
      .sort();
    expect(files).toHaveLength(12);
    expect(key.captures.map((c) => c.file).sort()).toEqual(files);

    for (const c of key.captures) {
      expect(TRIAGE_OUTCOMES, c.file).toContain(c.expected_outcome);
      const fields = parseFields(splitNote(readFileSync(join(CAPTURES, c.file), 'utf8')).fmText);
      expect([fields.type, fields.triage, fields.captured_by], c.file).toEqual(['source', 'pending', 'manual']);
      // Outcomes that land on an existing note name it by its base-relative path.
      if (['update-work-item', 'supersede', 'link-to-anchor', 'duplicate-of'].includes(c.expected_outcome)) {
        expect(c.targets.length, c.file).toBeGreaterThan(0);
        for (const t of c.targets) expect(existsSync(join(BASE, t)), `${c.file} -> ${t}`).toBe(true);
      }
    }

    const count = (o: string) => key.captures.filter((c) => c.expected_outcome === o).length;
    expect(count('dismiss')).toBeGreaterThanOrEqual(2);
    expect(count('update-work-item')).toBeGreaterThanOrEqual(2);
    expect(count('supersede')).toBeGreaterThanOrEqual(1);
    expect(count('new-work-item')).toBeGreaterThanOrEqual(1);
    expect(count('duplicate-of')).toBeGreaterThanOrEqual(1);
  });

  it("fixtures contain no real names from the owner's organisation", (ctx) => {
    if (!existsSync(DENYLIST)) {
      ctx.skip(
        'tests/fixtures/denylist.txt is absent (it is local-only and never committed); create it to run this check',
      );
    }
    const terms = readFileSync(DENYLIST, 'utf8')
      .replace(/^﻿/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#'))
      .map((l) => l.toLowerCase());
    expect(terms.length, 'denylist.txt has no terms, so this check would pass vacuously').toBeGreaterThan(0);
    const hits: string[] = [];
    for (const file of filesUnder(FIXTURES)) {
      const rel = relative(FIXTURES, file);
      if (rel === 'denylist.txt') continue;
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const term of terms) if (text.includes(term)) hits.push(`${rel}: ${term}`);
    }
    expect(hits).toEqual([]);
  });
});

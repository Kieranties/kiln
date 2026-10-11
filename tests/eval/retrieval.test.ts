import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Index } from '../../src/index/db.js';

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));
const THRESHOLDS = fileURLToPath(new URL('./thresholds.json', import.meta.url));
const RECORD = process.env.KILN_EVAL_RECORD === '1';

type Question = { id: string; category: string; question: string; variants: string[]; primary: string[]; secondary: string[] };
type Metrics = { recall5: number; mrr: number };
type Mode = 'raw' | 'variants';
type Thresholds = Record<Mode, Record<string, Metrics>>;
type QuestionResult = { id: string; category: string; recall5: number; rank: number; top5: string[] };

const MODES: Mode[] = ['raw', 'variants'];
const norm = (p: string): string => p.replaceAll('\\', '/');
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const round = (x: number): string => x.toFixed(3);
/** Measured value minus 0.05, floored to 2 decimals, clamped at 0. */
const freeze = (x: number): number => Math.max(0, Math.floor((x - 0.05) * 100 + 1e-9) / 100);

describe('retrieval regression (golden set)', () => {
  it('meets the frozen per-category recall@5 and MRR thresholds in raw and variants modes', () => {
    const golden = JSON.parse(readFileSync(join(FIXTURES, 'golden.json'), 'utf8')) as { questions: Question[] };

    // The index writes .kiln/ into the base, so search a copy rather than the committed fixtures.
    const tmp = mkdtempSync(join(tmpdir(), 'kiln-eval-'));
    cpSync(join(FIXTURES, 'base'), tmp, { recursive: true });
    const ix = Index.open({ name: 'northwind', path: tmp });
    const results: Record<Mode, QuestionResult[]> = { raw: [], variants: [] };
    try {
      for (const q of golden.questions) {
        const primary = q.primary.map(norm);
        for (const mode of MODES) {
          const hits = ix.search({
            q: q.question,
            ...(mode === 'variants' ? { variants: q.variants } : {}),
            autoScope: true,
            limit: 20,
          });
          const paths = hits.map((h) => norm(h.path));
          const top5 = paths.slice(0, 5);
          const firstIdx = paths.findIndex((p) => primary.includes(p));
          results[mode].push({
            id: q.id,
            category: q.category,
            recall5: primary.filter((p) => top5.includes(p)).length / primary.length,
            rank: firstIdx < 0 ? 0 : firstIdx + 1,
            top5,
          });
        }
      }
    } finally {
      ix.close();
      rmSync(tmp, { recursive: true, force: true });
    }

    const measured: Thresholds = { raw: {}, variants: {} };
    for (const mode of MODES) {
      const categories = [...new Set(results[mode].map((r) => r.category))];
      const rows = categories.map((category) => {
        const rs = results[mode].filter((r) => r.category === category);
        const m: Metrics = { recall5: mean(rs.map((r) => r.recall5)), mrr: mean(rs.map((r) => (r.rank > 0 ? 1 / r.rank : 0))) };
        measured[mode][category] = m;
        return { category, n: rs.length, recall5: round(m.recall5), mrr: round(m.mrr) };
      });
      console.log(`\nRetrieval by category (${mode})`);
      console.table(rows);
      console.log(
        `\nPer question (${mode})\n` +
          results[mode]
            .map((r) => `${r.id}  recall@5=${round(r.recall5)}  first-primary-rank=${r.rank || '-'}  top5=${JSON.stringify(r.top5)}`)
            .join('\n'),
      );
    }

    if (RECORD) {
      const thresholds: Thresholds = { raw: {}, variants: {} };
      for (const mode of MODES) {
        for (const [category, m] of Object.entries(measured[mode])) {
          thresholds[mode][category] = { recall5: freeze(m.recall5), mrr: freeze(m.mrr) };
        }
      }
      writeFileSync(THRESHOLDS, `${JSON.stringify(thresholds, null, 2)}\n`);
      return;
    }

    if (!existsSync(THRESHOLDS)) {
      expect.fail('tests/eval/thresholds.json is missing: record a baseline first with KILN_EVAL_RECORD=1 npx vitest run tests/eval/retrieval.test.ts');
    }
    const thresholds = JSON.parse(readFileSync(THRESHOLDS, 'utf8')) as Thresholds;
    for (const mode of MODES) {
      for (const [category, m] of Object.entries(measured[mode])) {
        const t = thresholds[mode]?.[category];
        expect(t, `no ${mode} threshold recorded for ${category}`).toBeDefined();
        expect(m.recall5, `${mode} ${category} recall@5`).toBeGreaterThanOrEqual(t!.recall5);
        expect(m.mrr, `${mode} ${category} MRR`).toBeGreaterThanOrEqual(t!.mrr);
      }
    }
  });
});

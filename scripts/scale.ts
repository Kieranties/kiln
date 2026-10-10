/**
 * Scale benchmark: expand the fictional fixture base to N notes and time the index against the v1 targets.
 *
 *   npx tsx scripts/scale.ts --notes <N> --out <dir>
 *
 * `<dir>` must be missing, empty, or a directory this script generated earlier (it holds a `.kiln-scale` marker);
 * in the last case only the folders the script generates are cleared. The base is the fixture base copied verbatim
 * plus N minus its size generated notes, recombining fixture titles, frontmatter patterns and paragraphs with a
 * seeded PRNG, so the output is deterministic and stays fictional.
 *
 * Measures: cold build (`Index.open` on the fresh base, which builds the index), forced rebuild
 * (`reconcile({ force: true })`), no-change re-check (`reconcile()`), and the latency of 50 searches cycling through
 * the golden questions with `autoScope: true`, raw and with variants. Exits 1 when any target is missed.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseFields, renderNote, splitNote } from '../src/frontmatter.js';
import { Index } from '../src/index/db.js';
import { scanVault } from '../src/index/reconcile.js';
import { placeNote } from '../src/place.js';
import { KINDS, STATUSES } from '../src/schema.js';
import type { Fields, NoteType } from '../src/types.js';

const FIXTURES = fileURLToPath(new URL('../tests/fixtures/', import.meta.url));
const MARKER = '.kiln-scale';
/** Top-level entries this script creates in `<dir>`; nothing else is ever removed. */
const GENERATED = new Set([MARKER, '.kiln', 'anchors', 'projects', 'work', 'decisions', 'references', 'notes', 'sources']);
const SEED = 20261010;
const QUERIES = 50;

const TARGET_BUILD_MS = 60_000;
const TARGET_RECHECK_MS = 2_000;
const TARGET_P95_MS = 300;

/** Share of generated notes per type: a source-heavy personal vault with a few thousand anchors. */
const TYPE_WEIGHTS: [NoteType, number][] = [
  ['source', 40],
  ['work', 15],
  ['note', 15],
  ['reference', 12],
  ['decision', 10],
  ['anchor', 6],
  ['project', 2],
];
const ANCHOR_KIND_WEIGHTS: [string, number][] = [
  ['person', 50],
  ['topic', 20],
  ['organisation', 10],
  ['product', 10],
  ['service', 10],
];
const SOURCE_KIND_WEIGHTS: [string, number][] = [
  ['jira', 25],
  ['slack', 20],
  ['meeting', 20],
  ['email', 15],
  ['github', 10],
  ['web', 5],
  ['note', 5],
];
const WORK_STATUS_WEIGHTS: [string, number][] = [
  ['done', 40],
  ['active', 30],
  ['abandoned', 15],
  ['blocked', 8],
  ['paused', 7],
];
const DECISION_STATUS_WEIGHTS: [string, number][] = [
  ['active', 55],
  ['superseded', 30],
  ['proposed', 15],
];
const TRIAGE_WEIGHTS: [string, number][] = [
  ['linked', 85],
  ['dismissed', 12],
  ['pending', 3],
];
const LINKED_OUTCOMES = ['link-to-anchor', 'update-work-item', 'new-work-item', 'new-decision', 'supersede', 'new-reference'];

// ---------------------------------------------------------------------------------------------------------------
// Seeded PRNG

/** mulberry32: a small, fast, seeded 32-bit PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  readonly #next: () => number;
  constructor(seed: number) {
    this.#next = mulberry32(seed);
  }
  float(): number {
    return this.#next();
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.#next() * (max - min + 1));
  }
  pick<T>(xs: readonly T[]): T {
    if (xs.length === 0) throw new Error('pick from an empty list');
    return xs[Math.floor(this.#next() * xs.length)]!;
  }
  /** Up to `count` distinct items, drawn with a bounded number of tries (so duplicate entries cannot loop forever). */
  some<T>(xs: readonly T[], count: number): T[] {
    const out = new Set<T>();
    const want = Math.min(count, xs.length);
    for (let tries = 0; out.size < want && tries < want * 10; tries++) out.add(this.pick(xs));
    return [...out];
  }
  weighted<T>(table: readonly [T, number][]): T {
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = this.#next() * total;
    for (const [v, w] of table) {
      r -= w;
      if (r < 0) return v;
    }
    return table[table.length - 1]![0];
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Fixture corpus

type Section = { heading: string; text: string };
type Template = { type: string; kind: string | null; title: string; fields: Fields; sections: Section[] | null; paragraphs: string[] };

type Corpus = {
  templates: Map<string, Template[]>;
  /** Non-empty section texts by `type|heading`. */
  sectionTexts: Map<string, string[]>;
  paragraphs: string[];
  summaries: Map<string, string[]>;
  whys: string[];
};

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

function sectionsOf(body: string): Section[] | null {
  const lines = body.split('\n');
  if (!lines.some((l) => /^## /.test(l))) return null;
  const out: Section[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of lines) {
    const m = /^## (.+)$/.exec(line);
    if (m) {
      if (current) out.push({ heading: current.heading, text: current.lines.join('\n').trim() });
      current = { heading: m[1]!.trim(), lines: [] };
    } else if (current) current.lines.push(line);
  }
  if (current) out.push({ heading: current.heading, text: current.lines.join('\n').trim() });
  return out;
}

function paragraphsOf(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '' && !/^#{1,6} /.test(p));
}

function loadCorpus(): Corpus {
  const files = [...scanVault(join(FIXTURES, 'base')), ...scanVault(join(FIXTURES, 'day', 'captures'))];
  const corpus: Corpus = { templates: new Map(), sectionTexts: new Map(), paragraphs: [], summaries: new Map(), whys: [] };
  for (const f of files) {
    const split = splitNote(readFileSync(f.abs, 'utf8').replace(/\r\n/g, '\n'));
    const fields = parseFields(split.fmText);
    const type = typeof fields.type === 'string' ? fields.type : 'note';
    const t: Template = {
      type,
      kind: typeof fields.kind === 'string' ? fields.kind : null,
      title: typeof fields.title === 'string' ? fields.title : f.rel.replace(/^.*\//, '').replace(/\.md$/, ''),
      fields,
      sections: sectionsOf(split.body),
      paragraphs: paragraphsOf(split.body),
    };
    push(corpus.templates, type, t);
    for (const s of t.sections ?? []) {
      if (s.text === '') continue;
      push(corpus.sectionTexts, `${type}|${s.heading}`, s.text);
    }
    corpus.paragraphs.push(...t.paragraphs);
    if (typeof fields.summary === 'string') push(corpus.summaries, type, fields.summary);
    if (typeof fields.why === 'string') corpus.whys.push(fields.why);
  }
  return corpus;
}

// ---------------------------------------------------------------------------------------------------------------
// Generation

type Plan = { n: number; type: NoteType; kind: string | null; template: Template | null; title: string; created: string; updated: string };

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DAY_MS = 86_400_000;
const FIRST_DAY = Date.UTC(2023, 0, 1);
const LAST_DAY = Date.UTC(2026, 9, 9);

/** A ULID-shaped id: `01`, the note number in 8 base32 digits (so ids are unique), then 16 seeded random digits. */
function idFor(n: number, rng: Rng): string {
  let num = '';
  for (let v = n, i = 0; i < 8; i++, v = Math.floor(v / 32)) num = CROCKFORD[v % 32]! + num;
  let rand = '';
  for (let i = 0; i < 16; i++) rand += CROCKFORD[rng.int(0, 31)]!;
  return `01${num}${rand}`;
}

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

function planNotes(count: number, corpus: Corpus, rng: Rng, taken: Set<string>): Plan[] {
  const plans: Plan[] = [];
  const allTitles = [...corpus.templates.values()].flat().map((t) => t.title);
  for (let i = 0; i < count; i++) {
    const n = i + 1;
    const type = rng.weighted(TYPE_WEIGHTS);
    let kind: string | null = null;
    if (type === 'anchor') kind = rng.weighted(ANCHOR_KIND_WEIGHTS);
    else if (type === 'source') kind = rng.weighted(SOURCE_KIND_WEIGHTS);
    else if (type === 'work' || type === 'reference') kind = rng.pick(KINDS[type]);

    const ofType = corpus.templates.get(type) ?? [];
    const ofKind = ofType.filter((t) => t.kind === kind);
    const template = ofKind.length > 0 ? rng.pick(ofKind) : ofType.length > 0 ? rng.pick(ofType) : null;
    const title = template ? `${template.title} ${n}` : `Notes on ${rng.pick(allTitles)} ${n}`;
    if (taken.has(title.toLowerCase())) throw new Error(`Generated a duplicate title: ${title}`);
    taken.add(title.toLowerCase());

    const createdMs = FIRST_DAY + rng.int(0, (LAST_DAY - FIRST_DAY) / DAY_MS) * DAY_MS;
    const updatedMs = Math.min(LAST_DAY, createdMs + rng.int(0, 120) * DAY_MS);
    plans.push({ n, type, kind, template, title, created: isoDay(createdMs), updated: isoDay(updatedMs) });
  }
  return plans;
}

const link = (title: string): string => `[[${title}]]`;

function body(plan: Plan, corpus: Corpus, rng: Rng, related: string[]): { sections: Section[]; text: string } {
  const sections = plan.template?.sections;
  if (sections) {
    const out = sections.map((s) => {
      const pool = corpus.sectionTexts.get(`${plan.type}|${s.heading}`) ?? [];
      const text = pool.length === 0 ? '' : rng.some(pool, rng.int(1, 2)).join('\n');
      return { heading: s.heading, text };
    });
    out.push({ heading: 'Related', text: related.map((r) => `- ${link(r)}`).join('\n') });
    return { sections: out, text: '' };
  }
  const own = plan.template?.paragraphs ?? [];
  const pool = own.length >= 2 ? own : corpus.paragraphs;
  const paras = rng.some(pool, rng.int(2, 5));
  paras.push(`Related: ${related.map(link).join(', ')}`);
  return { sections: [], text: paras.join('\n\n') + '\n' };
}

/** Titles that generated notes link to, by role. */
type Pools = { anchor: string[]; source: string[]; project: string[]; linkTargets: string[]; knowledge: string[] };

function fieldsFor(plan: Plan, corpus: Corpus, rng: Rng, pools: Pools): Fields {
  const t = plan.template?.fields ?? {};
  const anchors = rng.some(pools.anchor, rng.int(1, 3)).map(link);
  const fields: Fields = { id: idFor(plan.n, rng), type: plan.type };
  if (plan.kind !== null) fields.kind = plan.kind;
  fields.title = plan.title;

  if (plan.type === 'source') {
    const triage = rng.weighted(TRIAGE_WEIGHTS);
    const hh = String(rng.int(7, 19)).padStart(2, '0');
    const mm = String(rng.int(0, 59)).padStart(2, '0');
    Object.assign(fields, {
      created: plan.created,
      updated: plan.updated,
      source_id: `scale-${plan.n}`,
      dedupe_key: `${plan.kind}:scale-${plan.n}`,
      url: `https://${plan.kind}.northwind-arena.example/scale/${plan.n}`,
      captured_at: `${plan.created}T${hh}:${mm}:00.000Z`,
      captured_by: rng.pick(['manual', 'watcher']),
      why: rng.pick(corpus.whys),
      triage,
    });
    if (triage === 'linked') {
      fields.linked_to = rng.some(pools.linkTargets, rng.int(1, 2)).map(link);
      fields.triage_outcome = rng.pick(LINKED_OUTCOMES);
    } else if (triage === 'dismissed') {
      fields.triage_outcome = 'dismiss';
    }
    return fields;
  }

  if (plan.type === 'note') {
    Object.assign(fields, { created: plan.created, updated: plan.updated, anchors });
    return fields;
  }

  const status =
    plan.type === 'work'
      ? rng.weighted(WORK_STATUS_WEIGHTS)
      : plan.type === 'decision'
        ? rng.weighted(DECISION_STATUS_WEIGHTS)
        : rng.float() < 0.9
          ? 'active'
          : rng.pick(STATUSES[plan.type].filter((s) => s !== 'active'));
  const aliases = strings(t.aliases).slice(0, rng.int(1, 3)).map((a) => `${a} ${plan.n}`);
  Object.assign(fields, {
    status,
    created: plan.created,
    updated: plan.updated,
    aliases: aliases.length > 0 ? aliases : [`${plan.type} ${plan.n}`],
    summary: rng.pick(corpus.summaries.get(plan.type) ?? corpus.paragraphs),
  });
  const keywords = strings(t.keywords);
  if (keywords.length > 0) fields.keywords = rng.some(keywords, rng.int(1, keywords.length));
  fields.anchors = anchors;
  fields.sources = rng.some(pools.source, rng.int(1, 3)).map(link);
  fields.confidence = rng.weighted([
    ['verbatim', 80],
    ['inferred', 20],
  ]);

  if (plan.type === 'anchor' && plan.kind === 'organisation') fields.role = rng.pick(['client', 'vendor', 'partner']);
  if (plan.type === 'work') {
    Object.assign(fields, { project: link(rng.pick(pools.project)), ticket: `NWA-${10_000 + plan.n}`, last_checkpoint: plan.updated });
  }
  if (plan.type === 'decision') {
    fields.decided_on = plan.created;
    if (rng.float() < 0.5) fields.project = link(rng.pick(pools.project));
  }
  if (plan.type === 'reference') fields.url = `https://wiki.northwind-arena.example/scale/${plan.n}`;
  return fields;
}

/** Copy the fixture base into `out` and generate notes until the base holds `total` notes. Returns per-type counts. */
function generate(out: string, total: number): Record<string, number> {
  const corpus = loadCorpus();
  const rng = new Rng(SEED);
  const fixtureBase = join(FIXTURES, 'base');
  const fixtureFiles = scanVault(fixtureBase);
  if (total < fixtureFiles.length) throw new Error(`--notes must be at least ${fixtureFiles.length} (the fixture base size)`);
  for (const entry of readdirSync(fixtureBase)) cpSync(join(fixtureBase, entry), join(out, entry), { recursive: true });

  const counts: Record<string, number> = {};
  const titles = new Map<string, string[]>();
  const taken = new Set<string>();
  const paths = new Set<string>();
  for (const t of [...corpus.templates.values()].flat()) taken.add(t.title.toLowerCase());
  for (const f of fixtureFiles) {
    paths.add(f.rel.toLowerCase());
    const fields = parseFields(splitNote(readFileSync(f.abs, 'utf8')).fmText);
    const type = String(fields.type);
    counts[type] = (counts[type] ?? 0) + 1;
    push(titles, type, String(fields.title));
  }

  const plans = planNotes(total - fixtureFiles.length, corpus, rng, taken);
  for (const p of plans) push(titles, p.type, p.title);
  const of = (...types: string[]): string[] => types.flatMap((t) => titles.get(t) ?? []);
  const pools: Pools = {
    anchor: of('anchor'),
    source: of('source'),
    project: of('project'),
    linkTargets: of('work', 'decision', 'anchor', 'reference'),
    knowledge: of('work', 'decision', 'reference', 'project'),
  };

  const dirs = new Set<string>();
  for (const p of plans) {
    const fields = fieldsFor(p, corpus, rng, pools);
    const related = rng.some(pools.knowledge, rng.int(1, 3));
    const { sections, text } = body(p, corpus, rng, related);
    const rel = placeNote(fields, (r) => paths.has(r.toLowerCase()));
    paths.add(rel.toLowerCase());
    const dir = rel.slice(0, rel.lastIndexOf('/'));
    if (!dirs.has(dir)) {
      mkdirSync(join(out, dir), { recursive: true });
      dirs.add(dir);
    }
    const note = sections.length > 0 ? renderNote(fields, sections) : `${renderNote(fields, [])}\n${text}`;
    writeFileSync(join(out, rel), note, 'utf8');
    counts[p.type] = (counts[p.type] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------------------------------------------
// Output directory

/** Make `out` ready: create it, or clear a directory this script generated earlier. Throws instead of touching anything else. */
function prepareOut(out: string): void {
  if (existsSync(out)) {
    const entries = readdirSync(out);
    if (entries.length > 0) {
      if (!entries.includes(MARKER)) throw new Error(`${out} is not empty and has no ${MARKER} marker; refusing to write into it`);
      const foreign = entries.filter((e) => !GENERATED.has(e));
      if (foreign.length > 0) throw new Error(`${out} holds entries this script did not create (${foreign.join(', ')}); refusing to clear it`);
      for (const e of entries) rmSync(join(out, e), { recursive: true, force: true });
    }
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, MARKER), 'Generated by kiln scripts/scale.ts. Safe to delete.\n', 'utf8');
}

// ---------------------------------------------------------------------------------------------------------------
// Measurement

function time<T>(fn: () => T): { ms: number; result: T } {
  const t0 = performance.now();
  const result = fn();
  return { ms: performance.now() - t0, result };
}

/** Nearest-rank percentile of `xs` (0 < p <= 1). */
function percentile(xs: number[], p: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]!;
}

type Row = { measure: string; ms: number; target: number; unit: 's' | 'ms' };

const fmt = (ms: number, unit: 's' | 'ms'): string => (unit === 's' ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(1)} ms`);

/** Exit codes: 0 every target met; 1 a target missed; 2 bad usage or an error. */
function main(argv: string[]): number {
  const { values } = parseArgs({ args: argv, options: { notes: { type: 'string' }, out: { type: 'string' } }, strict: true });
  const total = Number(values.notes);
  if (!values.out || !Number.isInteger(total) || total <= 0) {
    process.stderr.write('Usage: npx tsx scripts/scale.ts --notes <N> --out <dir>\n');
    return 2;
  }
  const out = resolve(values.out);
  try {
    prepareOut(out);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 2;
  }

  const gen = time(() => generate(out, total));
  const counts = Object.entries(gen.result)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, c]) => `${type} ${c}`)
    .join(', ');
  process.stdout.write(`kiln scale benchmark: ${total} notes in ${out}\n`);
  process.stdout.write(`generated in ${fmt(gen.ms, 's')} (seed ${SEED}): ${counts}\n\n`);

  const base = { name: 'kiln-scale', path: out };
  const cold = time(() => Index.open(base));
  const ix = cold.result;
  try {
    const forced = time(() => ix.reconcile({ force: true }));
    const recheck = time(() => ix.reconcile());
    const status = ix.status();
    const r = recheck.result;
    process.stdout.write(`indexed notes: ${status.notes}; inbox ${status.inbox}; forced rebuild scanned ${forced.result.scanned}\n`);
    process.stdout.write(
      `re-check stats: scanned ${r.scanned}, added ${r.added}, changed ${r.changed}, removed ${r.removed}, rebuilt ${r.rebuilt}\n\n`,
    );

    const golden = JSON.parse(readFileSync(join(FIXTURES, 'golden.json'), 'utf8')) as { questions: { question: string; variants: string[] }[] };
    const latencies = (withVariants: boolean): number[] => {
      const ms: number[] = [];
      for (let i = 0; i < QUERIES; i++) {
        const q = golden.questions[i % golden.questions.length]!;
        ms.push(time(() => ix.search({ q: q.question, ...(withVariants ? { variants: q.variants } : {}), autoScope: true, limit: 20 })).ms);
      }
      return ms;
    };
    const raw = latencies(false);
    const variants = latencies(true);

    const rows: Row[] = [
      { measure: 'cold build (`Index.open`, fresh base)', ms: cold.ms, target: TARGET_BUILD_MS, unit: 's' },
      { measure: 'forced rebuild (`reconcile({ force: true })`)', ms: forced.ms, target: TARGET_BUILD_MS, unit: 's' },
      { measure: 'no-change re-check (`reconcile()`)', ms: recheck.ms, target: TARGET_RECHECK_MS, unit: 's' },
      { measure: `query p95, raw \`q\` (${QUERIES} searches)`, ms: percentile(raw, 0.95), target: TARGET_P95_MS, unit: 'ms' },
      { measure: `query p95, \`q\` + variants (${QUERIES} searches)`, ms: percentile(variants, 0.95), target: TARGET_P95_MS, unit: 'ms' },
    ];
    let failed = false;
    process.stdout.write('| Measure | Result | Target | |\n|---|---|---|---|\n');
    for (const row of rows) {
      const pass = row.ms < row.target;
      failed ||= !pass;
      process.stdout.write(`| ${row.measure} | ${fmt(row.ms, row.unit)} | < ${fmt(row.target, row.unit)} | ${pass ? 'PASS' : 'FAIL'} |\n`);
    }
    process.stdout.write('\nquery latency (ms):\n');
    for (const [name, xs] of [['raw q', raw], ['q + variants', variants]] as const) {
      process.stdout.write(
        `  ${name.padEnd(13)} p50 ${percentile(xs, 0.5).toFixed(1)}  p95 ${percentile(xs, 0.95).toFixed(1)}  max ${Math.max(...xs).toFixed(1)}\n`,
      );
    }
    process.stdout.write(`\n${failed ? 'FAIL' : 'PASS'}\n`);
    return failed ? 1 : 0;
  } finally {
    ix.close();
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  // A crash must not look like a missed target (exit 1).
  process.stderr.write(`ERROR: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  process.exitCode = 2;
}

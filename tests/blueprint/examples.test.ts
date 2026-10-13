import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { checkNote } from '../../src/check/check-note.js';
import { formatResult } from '../../src/check/format.js';
import { openVault } from '../../src/check/vault.js';
import { BLUEPRINT, loadDefinitions, sectionsOf, splitFrontmatter } from '../support/blueprint.js';

const EXAMPLES = fileURLToPath(new URL('../fixtures/sample/', import.meta.url));
const DENYLIST = fileURLToPath(new URL('../fixtures/denylist.txt', import.meta.url));
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const DOCS = join(REPO, 'docs');
const PLUGIN = join(REPO, 'claude-plugin');
const TOP_LEVEL = ['README.md', 'CLAUDE.md', 'tests/fixtures/README.md', '.claude-plugin/marketplace.json'].map((f) =>
  join(REPO, f),
);

type Note = { path: string; folder: string; name: string; data: Record<string, unknown>; body: string };

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name));
}

const notes: Note[] = filesUnder(EXAMPLES)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { frontmatter, body } = splitFrontmatter(readFileSync(f, 'utf8'));
    return {
      path: relative(EXAMPLES, f),
      folder: relative(EXAMPLES, f).split(sep)[0] ?? '',
      name: basename(f, '.md'),
      data: (parse(frontmatter) ?? {}) as Record<string, unknown>,
      body,
    };
  });
const defs = new Map(loadDefinitions().map((d) => [d.name, d]));
const names = new Set(notes.map((n) => n.name));

describe('Northwind Arena example vault', () => {
  it('has a note of every type', () => {
    expect(new Set(notes.map((n) => n.data.type))).toEqual(new Set(defs.keys()));
  });

  it('every note passes the note check', () => {
    const vault = openVault(EXAMPLES, BLUEPRINT);
    const problems = vault.notes.map((n) => checkNote(vault, n)).filter((r) => r.findings.length > 0);
    expect(problems.map(formatResult)).toEqual([]);
  });

  it('notes have no title heading', () => {
    for (const n of notes) expect(n.body, n.path).not.toMatch(/^# /m);
  });

  it('the daily note ends with its log', () => {
    for (const n of notes.filter((note) => note.data.type === 'daily')) {
      const sections = sectionsOf(n.body);
      expect([...sections.keys()].at(-1), n.path).toBe('Log');
      const log = sections.get('Log')?.split(/\r?\n/) ?? [];
      expect(log.length, n.path).toBeGreaterThan(0);
      for (const line of log) expect(line, n.path).toMatch(/^- \d{2}:\d{2} \S/);
      expect(n.body.trimEnd().endsWith(log.at(-1) ?? ''), n.path).toBe(true);
    }
  });

  it('a personal task needs no project', () => {
    const tasks = notes.filter((n) => n.data.type === 'work' && n.data.kind === 'task');
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) expect(t.data.projects, t.path).toEqual([]);
  });

  it('every relationship view on the example project has something to show', () => {
    const project = notes.find((n) => n.data.type === 'project');
    const link = `[[${project?.name}]]`;
    for (const [heading, view] of Object.entries(defs.get('project')?.views ?? {})) {
      const shown = notes.filter((n) => n.data.type === view.type && (n.data[view.via] as unknown[])?.includes(link));
      expect(shown.length, heading).toBeGreaterThan(0);
    }
  });

  it('the example work spans the board columns the guide uses', () => {
    const statuses = new Set(notes.filter((n) => n.data.type === 'work').map((n) => n.data.status));
    for (const status of ['backlog', 'active', 'review', 'done']) expect(statuses, status).toContain(status);
  });

  it("the daily note's neighbour links name the Daily folder", () => {
    // A bare [[2026-10-07]] would be created in Inbox, the new-note folder, as a capture.
    for (const n of notes.filter((note) => note.data.type === 'daily')) {
      expect(n.body, n.path).toMatch(
        /^\[\[Daily\/\d{4}-\d{2}-\d{2}\|← yesterday\]\] · \[\[Daily\/\d{4}-\d{2}-\d{2}\|tomorrow →\]\]/,
      );
    }
  });

  it('a reference from a GitHub key keeps a linkable name', () => {
    expect(names.has('northwind-arena-club-console 88 Renewal date rolls over a year early')).toBe(true);
  });

  it("the plugin, the sample and the docs contain no real names from the owner's organisation", (ctx) => {
    if (!existsSync(DENYLIST)) {
      ctx.skip(
        'tests/fixtures/denylist.txt is absent (it is local-only and never committed); create it to run this check',
      );
    }
    const terms = readFileSync(DENYLIST, 'utf8')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#'))
      .map((l) => l.toLowerCase());
    expect(terms.length, 'denylist.txt has no terms, so this check would pass vacuously').toBeGreaterThan(0);
    const hits: string[] = [];
    const files = [...filesUnder(PLUGIN), ...filesUnder(EXAMPLES), ...filesUnder(DOCS), ...TOP_LEVEL];
    for (const file of files) {
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const term of terms) if (text.includes(term)) hits.push(`${relative(REPO, file)}: ${term}`);
    }
    expect(hits).toEqual([]);
  });
});

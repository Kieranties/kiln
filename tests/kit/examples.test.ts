import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { KIT, loadDefinitions, SHARED_PROPERTIES, sectionsOf, splitFrontmatter, type Definition } from './load.js';

const EXAMPLES = fileURLToPath(new URL('../fixtures/layer1/', import.meta.url));
const DENYLIST = fileURLToPath(new URL('../fixtures/denylist.txt', import.meta.url));
const DATE_FIRST = ['research', 'decision', 'meeting', 'daily', 'capture'];

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

function defOf(n: Note): Definition {
  const d = defs.get(String(n.data.type));
  if (!d) throw new Error(`${n.path}: unknown type ${String(n.data.type)}`);
  return d;
}

describe('Northwind Arena example vault', () => {
  it('has a note of every type', () => {
    expect(new Set(notes.map((n) => n.data.type))).toEqual(new Set(defs.keys()));
  });

  it('every note matches its definition', () => {
    for (const n of notes) {
      const d = defOf(n);
      expect(n.folder, n.path).toBe(d.folder);
      if (d.statuses.length) expect(d.statuses, n.path).toContain(n.data.status);
      else expect(n.data.status ?? null, n.path).toBeNull();
      if (n.data.kind) expect(Object.keys(d.kinds), n.path).toContain(n.data.kind);
      const allowed = [...SHARED_PROPERTIES, ...Object.keys(d.properties)];
      for (const key of Object.keys(n.data)) expect(allowed, `${n.path}: ${key}`).toContain(key);
    }
  });

  it('relationships are lists of links that resolve', () => {
    for (const n of notes) {
      for (const [prop, type] of Object.entries(defOf(n).properties)) {
        if (type !== 'links' || n.data[prop] === undefined) continue;
        const value = n.data[prop];
        expect(Array.isArray(value), `${n.path}: ${prop} is a list`).toBe(true);
        for (const link of value as unknown[]) {
          const target = /^\[\[([^\]|#]+)(\|[^\]]*)?\]\]$/.exec(String(link))?.[1];
          expect(target, `${n.path}: ${prop} ${String(link)}`).toBeDefined();
          expect(names.has(target ?? ''), `${n.path}: ${prop} -> ${target}`).toBe(true);
        }
      }
    }
  });

  it('file names are linkable', () => {
    for (const n of notes) expect(n.name, n.path).not.toMatch(/[#^[\]|:]/);
  });

  it('moments are named date first', () => {
    for (const n of notes.filter((note) => DATE_FIRST.includes(String(note.data.type)))) {
      expect(n.name, n.path).toMatch(/^\d{4}-\d{2}-\d{2}( |$)/);
    }
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

  it('a reference from a GitHub key keeps a linkable name', () => {
    expect(names.has('northwind-arena-club-console 88 Renewal date rolls over a year early')).toBe(true);
  });

  it("the kit contains no real names from the owner's organisation", (ctx) => {
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
    for (const file of filesUnder(KIT)) {
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const term of terms) if (text.includes(term)) hits.push(`${relative(KIT, file)}: ${term}`);
    }
    expect(hits).toEqual([]);
  });
});

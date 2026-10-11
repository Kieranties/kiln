import { describe, expect, it } from 'vitest';
import { loadDefinitions, loadTemplates, SHARED_PROPERTIES, viewFile, type Definition, type Template } from './load.js';

const defs = loadDefinitions();
const templates = loadTemplates();

function templateOf(d: Definition): Template {
  const t = templates.get(d.template);
  if (!t) throw new Error(`no template ${d.template} for ${d.name}`);
  return t;
}

/** The value written after `key:` in a template's frontmatter, as text. */
function valueOf(t: Template, key: string): string | undefined {
  const line = t.frontmatterRaw.split(/\r?\n/).find((l) => l.startsWith(`${key}:`));
  return line?.slice(key.length + 1).trim();
}

/**
 * Headings in page order: the type's sections, then its views. The daily note keeps Log last,
 * so its views sit just before Log.
 */
function expectedHeadings(d: Definition): string[] {
  const views = Object.keys(d.views);
  if (d.name !== 'daily') return [...d.sections, ...views];
  return [...d.sections.filter((s) => s !== 'Log'), ...views, 'Log'];
}

describe('templates', () => {
  it('every definition has its template', () => {
    for (const d of defs) expect(templates.has(d.template), d.name).toBe(true);
    expect(templates.size).toBe(defs.length);
  });

  it('frontmatter has the shared and own properties', () => {
    for (const d of defs) {
      expect(templateOf(d).frontmatterKeys, d.name).toEqual([...SHARED_PROPERTIES, ...Object.keys(d.properties)]);
    }
  });

  it('type is fixed and status defaults to the first status', () => {
    for (const d of defs) {
      const t = templateOf(d);
      expect(valueOf(t, 'type'), d.name).toBe(d.name);
      expect(valueOf(t, 'status'), d.name).toBe(d.statuses[0] ?? '');
    }
  });

  it('relationships and lists are written as empty lists', () => {
    for (const d of defs) {
      const t = templateOf(d);
      const lists = ['aliases', 'keywords', 'tags'];
      for (const [prop, type] of Object.entries(d.properties))
        if (type === 'links' || type === 'list') lists.push(prop);
      for (const prop of lists) expect(valueOf(t, prop), `${d.name}.${prop}`).toBe('[]');
    }
  });

  it("created uses Templater's date", () => {
    for (const d of defs) expect(valueOf(templateOf(d), 'created'), d.name).toBe('<% tp.date.now("YYYY-MM-DD") %>');
  });

  it('body is the sections then the views, each view only its embed', () => {
    for (const d of defs) {
      const t = templateOf(d);
      expect(t.headings, d.name).toEqual(expectedHeadings(d));
      for (const heading of Object.keys(d.views)) {
        expect(t.sections.get(heading), `${d.name}: ${heading}`).toBe(`![[${viewFile(d.name, heading)}]]`);
      }
    }
  });

  it('no title heading', () => {
    for (const d of defs) expect(templateOf(d).text, d.name).not.toMatch(/^# /m);
  });

  it('kind is chosen when the type has kinds', () => {
    for (const d of defs) {
      const t = templateOf(d);
      const kinds = Object.keys(d.kinds);
      const call = /tp\.system\.suggester\(\s*(\[[^\]]*\])/.exec(t.text);
      if (kinds.length === 0) {
        expect(call, d.name).toBeNull();
        expect(valueOf(t, 'kind'), d.name).toBe('');
      } else {
        expect(JSON.parse(call?.[1] ?? 'null'), d.name).toEqual(kinds);
        expect(valueOf(t, 'kind'), d.name).toBe('<% kind %>');
      }
    }
  });

  it('daily keeps Log last and links its neighbours', () => {
    const daily = templateOf(defs.find((d) => d.name === 'daily') as Definition);
    expect(daily.headings.at(-1)).toBe('Log');
    expect(daily.text).toContain('[[Daily/<% yesterday %>|← yesterday]] · [[Daily/<% tomorrow %>|tomorrow →]]');
    expect(daily.text).toMatch(/yesterday = .*tp\.file\.title/);
    expect(valueOf(daily, 'date')).toBe('<% tp.file.title %>');
  });

  it('capture records when it arrived', () => {
    const capture = templateOf(defs.find((d) => d.name === 'capture') as Definition);
    expect(valueOf(capture, 'captured')).toBe('<% tp.date.now("YYYY-MM-DDTHH:mm") %>');
  });
});

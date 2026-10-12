import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readBlueprint, type Definition } from '../../src/blueprint/load.js';
import { typeIndex, typePage } from '../../src/docs/type-page.js';
import routes from '../../docs/reference/types/[type].paths.mjs';
import { BLUEPRINT } from '../support/blueprint.js';

const blueprint = readBlueprint(BLUEPRINT);
const definition = (name: string): Definition => {
  const found = blueprint.definitions.find((d) => d.name === name);
  if (!found) throw new Error(`no type ${name}`);
  return found;
};
const page = (name: string) => typePage(definition(name), blueprint);

/** The lines of a `## ` section of a page. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}\n`);
  if (start < 0) throw new Error(`no section ${heading}`);
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next < 0 ? undefined : next);
}

describe('typePage', () => {
  it('titles the page with the type and opens with its prose', () => {
    const work = page('work');
    expect(work.startsWith('# work\n')).toBe(true);
    expect(work).toContain("The ticket is the team's record; this note is mine");
  });

  it("gives the type's folder, file name rule, template, icon, colour and statuses", () => {
    const work = page('work');
    for (const part of ['`Work/`', 'The title', '`Work.md`', '`lucide-square-check`', '`#8be9fd`']) {
      expect(work, part).toContain(part);
    }
    expect(work).toContain('`backlog`, `active`, `blocked`, `review`, `done`, `abandoned`');
    expect(page('daily')).toContain('`YYYY-MM-DD`');
    expect(page('meeting')).toMatch(/\| Statuses \| None/);
  });

  it("lists each kind with its own icon and colour, or the type's", () => {
    const kinds = section(page('work'), 'Kinds');
    expect(kinds).toMatch(/\| `bug` \| `lucide-bug` \| `#ff5555` \|/);
    expect(kinds).toMatch(/\| `chore` \| `lucide-hammer` \| The type's \|/);
    expect(section(page('topic'), 'Kinds')).toContain('None');
  });

  it('lists its own properties, says what a relationship links to, and names the shared ones', () => {
    const properties = section(page('work'), 'Properties');
    expect(properties).toMatch(/\| `jira` \| A list \|/);
    expect(properties).toMatch(/\| `projects` \| Links to `project` notes \|/);
    for (const shared of blueprint.properties.shared) expect(properties, shared).toContain(`\`${shared}\``);
    for (const optional of blueprint.properties.optional) expect(properties, optional).toContain(`\`${optional}\``);
  });

  it('lists the sections in order, and the one that stays last', () => {
    const sections = section(page('daily'), 'Sections');
    const order = definition('daily').sections.map((s) => sections.indexOf(`${s}`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(sections).toContain('`Log` always stays last');
  });

  it('says what each related view lists, and how', () => {
    const views = section(page('work'), 'Views');
    expect(views).toMatch(/\| Decisions \| `decision` notes that link to this note \|/);
    expect(views).toMatch(/\| References \| `reference` notes whose `work` links to this note \|/);
    const daily = section(page('daily'), 'Views');
    expect(daily).toMatch(/`capture` notes created on this note's `date`/);
    expect(daily).toMatch(/`work` notes changed on this note's `date`/);
  });

  it('changes when the definition changes, with no other edit', () => {
    const changed = { ...definition('work'), folder: 'Tasks', statuses: ['open', 'closed'], sections: ['Notes'] };
    const text = typePage(changed, blueprint);
    expect(text).toContain('`Tasks/`');
    expect(text).toContain('`open`, `closed`');
    expect(section(text, 'Sections')).not.toContain('Context');
  });

  it("keeps a definition's prose as text: a bare <placeholder> is escaped, code is left alone", () => {
    const odd = { ...definition('work'), body: 'Put <vault> here, and `<vault>` in code.' };
    expect(typePage(odd, blueprint)).toContain('Put &lt;vault> here, and `<vault>` in code.');
  });

  it('escapes table cells, so a pipe in a definition cannot break a table', () => {
    const odd = { ...definition('work'), kinds: { 'a|b': {} } };
    expect(section(typePage(odd, blueprint), 'Kinds')).toContain('`a\\|b`');
  });
});

describe('typeIndex', () => {
  it('links every type, with its folder and what it is', () => {
    const index = typeIndex(blueprint);
    for (const d of blueprint.definitions) {
      expect(index, d.name).toContain(`[${d.name}](./${d.name})`);
      expect(index, d.name).toContain(`\`${d.folder}/\``);
    }
  });
});

describe('the type pages on the docs site', () => {
  it('are a page per type and an index, built from the blueprint at build time', () => {
    const paths = routes.paths();
    expect(paths.map((p) => p.params.type).sort()).toEqual(
      ['index', ...blueprint.definitions.map((d) => d.name)].sort(),
    );
    expect(paths.find((p) => p.params.type === 'work')?.content).toBe(page('work'));
  });

  it("render each page as text, so a definition's {{…}} is never read as Vue", () => {
    const template = readFileSync(
      fileURLToPath(new URL('../../docs/reference/types/[type].md', import.meta.url)),
      'utf8',
    );
    expect(template.replace(/\r\n/g, '\n')).toMatch(/^::: v-pre\n+<!-- @content -->\n+:::\n?$/);
  });
});

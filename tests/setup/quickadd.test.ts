import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readBlueprint } from '../../src/blueprint/load.js';
import { kindChoices, kindTemplates, type Choice } from '../../src/setup/quickadd.js';
import { BLUEPRINT } from '../kit/load.js';

const { definitions } = readBlueprint(BLUEPRINT);
const read = (file: string) => readFileSync(join(BLUEPRINT, 'templates', file), 'utf8');
const fragment = JSON.parse(readFileSync(join(BLUEPRINT, 'settings/plugins/quickadd.json'), 'utf8')) as {
  choices: Choice[];
};
const flat = (choices: Choice[]): Choice[] =>
  choices.flatMap((c) => [c, ...flat(Array.isArray(c.choices) ? (c.choices as Choice[]) : [])]);

describe('kindTemplates', () => {
  it('writes one template per kind, with the kind fixed and no picker', () => {
    const templates = kindTemplates(definitions, read);
    expect(templates).toHaveLength(25);
    const bug = templates.find((t) => t.path === '_kiln/templates/kinds/Work bug.md');
    expect(bug?.text.startsWith('---\ntype: work\nkind: bug\nstatus: backlog\n')).toBe(true);
    for (const t of templates) expect(t.text, t.path).not.toMatch(/tp\.system|<% kind %>/);
  });

  it('names the template when its picker is missing', () => {
    expect(() => kindTemplates(definitions, (f) => (f === 'Work.md' ? '---\ntype: work\n---\n' : read(f)))).toThrow(
      /^templates\/Work\.md: expected a kind picker/,
    );
  });
});

describe('kindChoices', () => {
  const choices = kindChoices(definitions, fragment.choices);
  const all = flat(choices);

  it('groups a type with kinds in a menu, one choice per kind', () => {
    const menu = choices.find((c) => c.id === 'kiln-work-menu');
    expect(menu).toMatchObject({ name: 'New work', type: 'Multi', command: false });
    expect(
      flat([menu as Choice])
        .slice(1)
        .map((c) => [c.id, c.name]),
    ).toEqual([
      ['kiln-work-feature', 'New feature'],
      ['kiln-work-bug', 'New bug'],
      ['kiln-work-chore', 'New chore'],
      ['kiln-work-incident', 'New incident'],
      ['kiln-work-task', 'New task'],
    ]);
    expect(all.find((c) => c.id === 'kiln-work-bug')).toEqual({
      id: 'kiln-work-bug',
      name: 'New bug',
      type: 'Template',
      command: false,
      templatePath: '_kiln/templates/kinds/Work bug.md',
      fileNameFormat: { enabled: true, format: '{{VALUE:title}}' },
      folder: {
        enabled: true,
        folders: ['Work'],
        chooseWhenCreatingNote: false,
        createInSameFolderAsActiveFile: false,
        chooseFromSubfolders: false,
      },
      appendLink: false,
      openFile: false,
      fileOpening: { location: 'tab', direction: 'vertical', mode: 'default', focus: true },
      fileExistsBehavior: { kind: 'apply', mode: 'doNothing' },
    });
  });

  it('names notes by the type naming rule', () => {
    const format = (id: string) =>
      ((all.find((c) => c.id === id) as Choice).fileNameFormat as { format: string }).format;
    expect(format('kiln-meeting-standup')).toBe('{{DATE:YYYY-MM-DD}} {{VALUE:title}}');
    expect(format('kiln-daily')).toBe('{{DATE:YYYY-MM-DD}}');
    expect(format('kiln-reference-ticket')).toBe('{{VALUE:title}}');
    expect(all.find((c) => c.id === 'kiln-topic')).toMatchObject({
      name: 'New topic',
      templatePath: '_kiln/templates/Topic.md',
    });
  });

  it("leaves a type to the blueprint's own choice when it has one", () => {
    expect(all.some((c) => c.id === 'kiln-capture')).toBe(false);
  });

  it('refuses a duplicate name', () => {
    const extra: Choice = { id: 'mine', name: 'New bug', type: 'Template' };
    expect(() => kindChoices(definitions, [...fragment.choices, extra])).toThrow(
      'QuickAdd choice name "New bug" is used twice',
    );
  });
});

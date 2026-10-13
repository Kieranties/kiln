import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLUEPRINT, loadDefinitions, loadJson, loadProperties, SHARED_PROPERTIES } from '../support/blueprint.js';

const defs = loadDefinitions();

type Condition = { source: string; operator: string; value: string };
type IconRule = {
  id: string;
  name: string;
  category: string;
  iconDefault: string;
  icon: string;
  color: string;
  match: string;
  conditions: Condition[];
  enabled: boolean;
};

type Choice = { id: string; name: string; type: string; [key: string]: unknown };

const rules = () => loadJson<{ fileRules: IconRule[] }>('settings/plugins/iconic.json').fileRules;
const choice = (id: string) => {
  const found = loadJson<{ choices: Choice[] }>('settings/plugins/quickadd.json').choices.find((c) => c.id === id);
  if (!found) throw new Error(`no QuickAdd choice ${id}`);
  return found;
};

describe('Iconic rules', () => {
  it('every type has an icon rule after its kind rules', () => {
    const all = rules();
    for (const d of defs) {
      const at = all.findIndex((r) => r.id === `kiln-${d.name}`);
      expect(at, d.name).toBeGreaterThanOrEqual(0);
      expect(all[at], d.name).toMatchObject({
        icon: d.icon,
        color: d.color,
        conditions: [{ source: 'property:type', operator: 'is', value: d.name }],
      });
      all.forEach((r, i) => {
        if (r.id.startsWith(`kiln-${d.name}-`)) expect(i, r.id).toBeLessThan(at);
      });
    }
  });

  it('kind rules exist exactly for kinds with their own icon or colour', () => {
    const kindRules = rules().filter((r) => r.conditions.length === 2);
    const expected = defs.flatMap((d) =>
      Object.entries(d.kinds)
        .filter(([, o]) => o.icon || o.color)
        .map(([kind, o]) => ({
          id: `kiln-${d.name}-${kind}`,
          icon: o.icon ?? d.icon,
          color: o.color ?? d.color,
          conditions: [
            { source: 'property:type', operator: 'is', value: d.name },
            { source: 'property:kind', operator: 'is', value: kind },
          ],
        })),
    );
    expect(kindRules.map((r) => r.id).sort()).toEqual(expected.map((e) => e.id).sort());
    for (const e of expected) expect(kindRules.find((r) => r.id === e.id)).toMatchObject(e);
  });

  it("every type folder shows its type's icon in place of the arrow", () => {
    const iconic = loadJson<{
      minimalFolderIcons: boolean;
      showAllFolderIcons: boolean;
      showAllFileIcons: boolean;
      fileIcons: Record<string, { icon: string; color: string }>;
    }>('settings/plugins/iconic.json');
    expect(iconic).toMatchObject({ minimalFolderIcons: true, showAllFolderIcons: true, showAllFileIcons: true });
    for (const d of defs) expect(iconic.fileIcons[d.folder], d.folder).toEqual({ icon: d.icon, color: d.color });
    expect(iconic.fileIcons._kiln?.icon).toMatch(/^lucide-/);
  });

  it('Home and Board have icons', () => {
    const { fileIcons } = loadJson<{ fileIcons: Record<string, { icon: string }> }>('settings/plugins/iconic.json');
    expect(fileIcons['Home.md']?.icon).toBe('lucide-house');
    expect(fileIcons['Board.base']?.icon).toBe('lucide-square-kanban');
  });

  it('the apply procedure merges folder icons and switches on minimal folder icons', () => {
    const readme = readFileSync(join(BLUEPRINT, 'README.md'), 'utf8');
    for (const part of ['fileIcons', 'minimalFolderIcons']) expect(readme, part).toContain(part);
  });

  it('the property list covers every property, each with an icon or the type it links to', () => {
    const { types } = loadJson<{ types: Record<string, string> }>('settings/types.json');
    const catalogue = loadProperties();
    expect(Object.keys(catalogue).sort()).toEqual(Object.keys(types).sort());
    for (const [prop, entry] of Object.entries(catalogue)) {
      if (entry.links) {
        expect(
          defs.map((d) => d.name),
          prop,
        ).toContain(entry.links);
        expect(types[prop], `${prop} links, so it is a list`).toBe('multitext');
      } else {
        expect(entry.icon, prop).toMatch(/^lucide-[a-z0-9-]+$/);
      }
    }
    for (const d of defs) {
      for (const [prop, type] of Object.entries(d.properties)) {
        if (type === 'links') expect(catalogue[prop]?.links, `${d.name}.${prop}`).toBeTruthy();
      }
    }
  });

  it('every property has an icon, and relationships show the type they link to', () => {
    const { propertyIcons } = loadJson<{ propertyIcons: Record<string, { icon: string; color?: string }> }>(
      'settings/plugins/iconic.json',
    );
    for (const [prop, entry] of Object.entries(loadProperties())) {
      const target = defs.find((d) => d.name === entry.links);
      const expected = target ? { icon: target.icon, color: target.color } : { icon: entry.icon, color: entry.color };
      expect(propertyIcons[prop], prop).toEqual(JSON.parse(JSON.stringify(expected)));
    }
  });

  it('rules have the shape Iconic writes', () => {
    for (const r of rules()) {
      expect(r, r.id).toMatchObject({ category: 'rule', iconDefault: 'lucide-file', match: 'all', enabled: true });
      expect(r.name, r.id).toBeTruthy();
    }
  });
});

describe('Templater', () => {
  it('every folder has its template', () => {
    const t = loadJson<{
      templates_folder: string;
      trigger_on_file_creation_mode: string;
      folder_templates: unknown[];
    }>('settings/plugins/templater.json');
    expect(t.templates_folder).toBe('_kiln/templates');
    expect(t.trigger_on_file_creation_mode).toBe('folder');
    const byFolder = (a: { folder: string }, b: { folder: string }) => a.folder.localeCompare(b.folder);
    expect([...(t.folder_templates as { folder: string }[])].sort(byFolder)).toEqual(
      defs.map((d) => ({ folder: d.folder, template: `_kiln/templates/${d.template}` })).sort(byFolder),
    );
  });
});

describe('Obsidian settings', () => {
  it('every property has a type', () => {
    const { types } = loadJson<{ types: Record<string, string> }>('settings/types.json');
    const widget = {
      text: 'text',
      date: 'date',
      datetime: 'datetime',
      number: 'number',
      links: 'multitext',
      list: 'multitext',
    };
    for (const shared of SHARED_PROPERTIES) expect(types[shared], shared).toBeTruthy();
    expect(types).toMatchObject({ created: 'date', aliases: 'aliases', tags: 'tags', keywords: 'multitext' });
    for (const d of defs) {
      for (const [prop, type] of Object.entries(d.properties))
        expect(types[prop], `${d.name}.${prop}`).toBe(widget[type]);
    }
  });

  it('app settings hide properties and keep the blueprint out of search', () => {
    expect(loadJson('settings/app.json')).toEqual({
      propertiesInDocument: 'hidden',
      showInlineTitle: true,
      newFileLocation: 'folder',
      newFileFolderPath: 'Inbox',
      newLinkFormat: 'shortest',
      alwaysUpdateLinks: true,
      userIgnoreFilters: ['_kiln/'],
    });
  });

  it('daily notes live in Daily, named by date, filled by Templater', () => {
    expect(loadJson('settings/daily-notes.json')).toEqual({ folder: 'Daily', format: 'YYYY-MM-DD', template: '' });
  });

  it('core plugins turn on Bases and daily notes, and off core templates', () => {
    expect(loadJson('settings/core-plugins.json')).toEqual({
      bases: true,
      'daily-notes': true,
      properties: true,
      backlink: true,
      switcher: true,
      'global-search': true,
      'file-explorer': true,
      'command-palette': true,
      templates: false,
    });
  });

  it('the kiln snippet shows property names, values and board columns with capitals, and is switched on', () => {
    expect(loadJson('settings/appearance.json')).toEqual({ enabledCssSnippets: ['kiln'] });
    const css = readFileSync(join(BLUEPRINT, 'settings', 'snippets', 'kiln.css'), 'utf8');
    for (const selector of ['.metadata-property-key', '.metadata-property-value', 'kanban']) {
      expect(css, selector).toContain(selector);
    }
    expect(css).toContain('text-transform: capitalize');
  });

  it('the right sidebar gets a file properties view', () => {
    expect(loadJson('settings/workspace-file-properties.json')).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{16}$/),
      type: 'leaf',
      state: { type: 'file-properties', state: {}, icon: 'lucide-info', title: 'File properties' },
    });
  });

  it('community plugins are the five', () => {
    expect(loadJson<string[]>('settings/community-plugins.json')).toEqual([
      'iconic',
      'templater-obsidian',
      'quickadd',
      'homepage',
      'realclaudian',
    ]);
  });

  it('switches on exactly the plugins requires.json names', () => {
    const { plugins } = loadJson<{ plugins: Record<string, string> }>('requires.json');
    expect([...loadJson<string[]>('settings/community-plugins.json')].sort()).toEqual(Object.keys(plugins).sort());
  });

  it('homepage opens Home', () => {
    const { homepages } = loadJson<{ homepages: Record<string, Record<string, unknown>> }>(
      'settings/plugins/homepage.json',
    );
    expect(homepages['Main Homepage']).toMatchObject({
      value: 'Home',
      kind: 'File',
      openOnStartup: true,
      openWhenEmpty: true,
    });
  });
});

describe('QuickAdd', () => {
  it('log to daily appends under Log and creates a full daily', () => {
    expect(choice('kiln-log')).toMatchObject({
      name: 'Log to daily',
      type: 'Capture',
      captureTo: 'Daily/{{DATE:YYYY-MM-DD}}.md',
      format: { enabled: true, format: '- {{DATE:HH:mm}} {{VALUE:Log}}' },
      insertAfter: {
        enabled: true,
        after: '## Log',
        insertAtEnd: true,
        createIfNotFound: true,
        createIfNotFoundLocation: 'bottom',
      },
      createFileIfItDoesntExist: { enabled: true, createWithTemplate: true, template: '_kiln/templates/Daily.md' },
    });
  });

  it('capture to inbox uses the capture template in Inbox', () => {
    expect(choice('kiln-capture')).toMatchObject({
      name: 'Capture to inbox',
      type: 'Template',
      templatePath: '_kiln/templates/Capture.md',
      fileNameFormat: { enabled: true, format: '{{DATE:YYYY-MM-DD}} {{VALUE:title}}' },
      folder: { enabled: true, folders: ['Inbox'] },
      fileExistsBehavior: { kind: 'apply', mode: 'duplicateSuffix' },
    });
  });

  it('no kiln choice asks what to do when the file exists', () => {
    const choices = loadJson<{ choices: Choice[] }>('settings/plugins/quickadd.json').choices;
    for (const c of choices) expect(c.fileExistsBehavior, c.id).not.toEqual({ kind: 'prompt' });
  });
});

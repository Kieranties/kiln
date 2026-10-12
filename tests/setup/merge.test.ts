import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Json } from '../../src/setup/json.js';
import { mergeFragment, Merger } from '../../src/setup/merge.js';
import type { MergeExtra } from '../../src/setup/merge.js';
import { BLUEPRINT } from '../kit/load.js';

const TARGET: Record<string, string> = {
  'settings/app.json': '.obsidian/app.json',
  'settings/types.json': '.obsidian/types.json',
  'settings/daily-notes.json': '.obsidian/daily-notes.json',
  'settings/core-plugins.json': '.obsidian/core-plugins.json',
  'settings/community-plugins.json': '.obsidian/community-plugins.json',
  'settings/plugins/homepage.json': '.obsidian/plugins/homepage/data.json',
  'settings/plugins/iconic.json': '.obsidian/plugins/iconic/data.json',
  'settings/plugins/templater.json': '.obsidian/plugins/templater-obsidian/data.json',
  'settings/plugins/quickadd.json': '.obsidian/plugins/quickadd/data.json',
  'settings/workspace-file-properties.json': '.obsidian/workspace.json',
};

/** Merges one blueprint fragment over `current`. */
function merge(
  fragment: string,
  current: Json | undefined,
  take: string[] = [],
  kept: Record<string, Json> = {},
  extra: MergeExtra = { choices: [] },
) {
  const blueprint = JSON.parse(readFileSync(join(BLUEPRINT, fragment), 'utf8')) as Json;
  const m = new Merger(TARGET[fragment] ?? fragment, { take: new Set(take), kept });
  const value = mergeFragment(fragment, current, blueprint, m, extra);
  return { value, changes: m.changes, overrides: m.overrides, warnings: m.warnings };
}

describe('the Obsidian settings', () => {
  it('a fresh app.json takes every key, with nothing to ask', () => {
    const { value, overrides } = merge('settings/app.json', {});
    expect(value).toMatchObject({ newFileFolderPath: 'Inbox', alwaysUpdateLinks: true, userIgnoreFilters: ['_kiln/'] });
    expect(overrides).toEqual([]);
  });

  it("keeps the owner's new-note folder unless taken, and their ignore filters always", () => {
    const current = { newFileLocation: 'folder', newFileFolderPath: 'Notes', userIgnoreFilters: ['Archive/'] };
    const kept = merge('settings/app.json', current);
    expect(kept.value).toMatchObject({ newFileFolderPath: 'Notes', userIgnoreFilters: ['Archive/', '_kiln/'] });
    expect(kept.overrides).toEqual([
      {
        id: '.obsidian/app.json#newFileFolderPath',
        file: '.obsidian/app.json',
        key: 'newFileFolderPath',
        current: 'Notes',
        blueprint: 'Inbox',
        asked: true,
        taken: false,
      },
    ]);
    const taken = merge('settings/app.json', current, ['.obsidian/app.json#newFileFolderPath']);
    expect(taken.value).toMatchObject({ newFileFolderPath: 'Inbox' });
    expect(taken.changes).toContainEqual({
      file: '.obsidian/app.json',
      key: 'newFileFolderPath',
      from: 'Notes',
      to: 'Inbox',
    });
  });

  it('does not ask again about an override the owner kept, until the blueprint changes it', () => {
    const current = { newFileFolderPath: 'Notes' };
    expect(
      merge('settings/app.json', current, [], { '.obsidian/app.json#newFileFolderPath': 'Inbox' }).overrides[0]?.asked,
    ).toBe(false);
    expect(
      merge('settings/app.json', current, [], { '.obsidian/app.json#newFileFolderPath': 'Capture' }).overrides[0]
        ?.asked,
    ).toBe(true);
  });

  it("asks before changing the owner's property types, and keeps their own", () => {
    const { value, overrides } = merge('settings/types.json', {
      types: { created: 'datetime', mood: 'text', tags: 'tags' },
    });
    expect(overrides.map((o) => o.id)).toEqual(['.obsidian/types.json#types/created']);
    expect(value).toMatchObject({ types: { created: 'datetime', mood: 'text', tags: 'tags', projects: 'multitext' } });
  });

  it("asks before moving the owner's daily notes", () => {
    const { overrides } = merge('settings/daily-notes.json', { folder: 'Journal', format: 'YYYY-MM-DD' });
    expect(overrides.map((o) => o.id)).toEqual(['.obsidian/daily-notes.json#folder']);
  });

  it('core plugins: an object is set, an older list keeps its form', () => {
    expect(merge('settings/core-plugins.json', { templates: true, graph: true }).value).toMatchObject({
      templates: false,
      graph: true,
      bases: true,
    });
    const list = merge('settings/core-plugins.json', ['file-explorer', 'templates', 'graph']).value;
    expect(list).toEqual([
      'file-explorer',
      'graph',
      'bases',
      'daily-notes',
      'properties',
      'backlink',
      'switcher',
      'global-search',
      'command-palette',
    ]);
  });

  it("adds kiln's plugins and snippet to the owner's", () => {
    expect(merge('settings/community-plugins.json', ['dataview', 'quickadd']).value).toEqual([
      'dataview',
      'quickadd',
      'iconic',
      'templater-obsidian',
      'homepage',
    ]);
  });

  it("Homepage's own defaults are not an override; another homepage is", () => {
    const defaults = {
      version: 4,
      homepages: { 'Main Homepage': { value: 'Home', kind: 'File', openMode: 'Replace all open notes' } },
    };
    expect(merge('settings/plugins/homepage.json', defaults).overrides).toEqual([]);
    const own = { homepages: { 'Main Homepage': { value: 'Dashboard', kind: 'File' } } };
    expect(merge('settings/plugins/homepage.json', own).overrides.map((o) => o.id)).toEqual([
      '.obsidian/plugins/homepage/data.json#homepages/Main Homepage',
    ]);
  });

  it("Homepage: keeps the owner's own keys on kiln's homepage, and never lowers the version", () => {
    const current = {
      version: 5,
      homepages: {
        'Main Homepage': {
          value: 'Home',
          kind: 'File',
          openOnStartup: false,
          view: 'Reading view',
          commands: [{ id: 'editor:toggle-fold', period: 'Startup' }],
        },
      },
      separateMobile: true,
    };
    const { value, overrides } = merge('settings/plugins/homepage.json', current);
    expect(overrides).toEqual([]);
    const result = value as { version: number; homepages: Record<string, Record<string, Json>>; separateMobile: Json };
    expect(result.version).toBe(5);
    expect(result.separateMobile).toBe(true);
    expect(result.homepages['Main Homepage']).toMatchObject({
      value: 'Home',
      kind: 'File',
      openOnStartup: false,
      view: 'Reading view',
      commands: [{ id: 'editor:toggle-fold', period: 'Startup' }],
      // kiln's keys the owner doesn't have are added.
      openMode: 'Keep open notes',
      alwaysApply: true,
    });
    expect(merge('settings/plugins/homepage.json', { homepages: {} }).value).toMatchObject({ version: 4 });
    expect(merge('settings/plugins/homepage.json', { version: 3 }).value).toMatchObject({ version: 4 });
  });

  it("appearance: adds kiln's snippet to the owner's", () => {
    expect(merge('settings/appearance.json', { enabledCssSnippets: ['mine'], theme: 'obsidian' }).value).toEqual({
      enabledCssSnippets: ['mine', 'kiln'],
      theme: 'obsidian',
    });
  });

  it('never changes the value it was given', () => {
    const current = { userIgnoreFilters: ['Archive/'] };
    merge('settings/app.json', current);
    expect(current).toEqual({ userIgnoreFilters: ['Archive/'] });
  });

  it('a second merge of its own result changes nothing', () => {
    const first = merge('settings/app.json', { newFileFolderPath: '' }).value;
    expect(merge('settings/app.json', first).changes).toEqual([]);
  });
});

describe('the plugin settings', () => {
  it("Iconic: kiln's rules first, the owner's kept, old kiln rules gone", () => {
    const current = {
      fileIcons: { Archive: { icon: 'lucide-archive' } },
      fileRules: [
        { id: 'mine', name: 'Mine' },
        { id: 'kiln-retired', name: 'Old' },
      ],
    };
    const value = merge('settings/plugins/iconic.json', current).value as {
      fileRules: { id: string }[];
      fileIcons: Record<string, unknown>;
    };
    const ids = value.fileRules.map((r) => r.id);
    expect(ids.at(-1)).toBe('mine');
    expect(ids).not.toContain('kiln-retired');
    expect(ids[0]).toMatch(/^kiln-/);
    expect(value.fileIcons['Archive']).toEqual({ icon: 'lucide-archive' });
    expect(value.fileIcons['Work']).toEqual({ icon: 'lucide-square-check', color: '#8be9fd' });
  });

  it("Templater: asks about the owner's template folder and their template for a kiln folder", () => {
    const current = {
      templates_folder: 'Templates',
      folder_templates: [
        { folder: '', template: '' },
        { folder: 'Journal', template: 'Templates/Journal.md' },
        { folder: 'Work', template: 'Templates/Task.md' },
      ],
    };
    const kept = merge('settings/plugins/templater.json', current);
    expect(kept.overrides.map((o) => o.id)).toEqual([
      '.obsidian/plugins/templater-obsidian/data.json#templates_folder',
      '.obsidian/plugins/templater-obsidian/data.json#folder_templates/Work',
    ]);
    const entries = (kept.value as { folder_templates: { folder: string; template: string }[] }).folder_templates;
    expect(entries.slice(0, 2)).toEqual([
      { folder: '', template: '' },
      { folder: 'Journal', template: 'Templates/Journal.md' },
    ]);
    expect(entries.find((e) => e.folder === 'Work')).toEqual({ folder: 'Work', template: 'Templates/Task.md' });
    expect(entries.find((e) => e.folder === 'Topics')).toEqual({
      folder: 'Topics',
      template: '_kiln/templates/Topic.md',
    });
    const taken = merge('settings/plugins/templater.json', current, [
      '.obsidian/plugins/templater-obsidian/data.json#folder_templates/Work',
    ]);
    const work = (taken.value as { folder_templates: { folder: string; template: string }[] }).folder_templates.filter(
      (e) => e.folder === 'Work',
    );
    expect(work).toEqual([{ folder: 'Work', template: '_kiln/templates/Work.md' }]);
  });

  it("QuickAdd: replaces kiln's choices at any depth and keeps the owner's", () => {
    // Typed as Json: inferred, the two choices' shapes union into `choices?: undefined`, which isn't Json.
    const current: Json = {
      choices: [
        {
          id: 'mine',
          name: 'My menu',
          type: 'Multi',
          choices: [
            { id: 'kiln-work-bug', name: 'New bug' },
            { id: 'own', name: 'Own' },
          ],
        },
        { id: 'kiln-capture', name: 'Capture to inbox', type: 'Template' },
      ],
      macros: [],
      migrations: { someMigration: true },
    };
    const generated = [{ id: 'kiln-topic', name: 'New topic', type: 'Template' }];
    const value = merge('settings/plugins/quickadd.json', current, [], {}, { choices: generated }).value as {
      choices: { id: string; choices?: { id: string }[] }[];
      migrations: unknown;
    };
    expect(value.choices.map((c) => c.id)).toEqual(['mine', 'kiln-capture', 'kiln-log', 'kiln-topic']);
    expect(value.choices[0]?.choices?.map((c) => c.id)).toEqual(['own']);
    expect(value.migrations).toEqual({ someMigration: true });
  });

  it("QuickAdd: lifts the owner's choices out of a kiln menu it replaces, at any depth", () => {
    const current: Json = {
      choices: [
        { id: 'mine', name: 'Mine', type: 'Template' },
        {
          id: 'kiln-work-menu',
          name: 'New work',
          type: 'Multi',
          choices: [
            { id: 'kiln-work-bug', name: 'New bug', type: 'Template' },
            { id: 'own-spike', name: 'New spike', type: 'Template' },
            {
              id: 'kiln-work-old',
              name: 'Old',
              type: 'Multi',
              choices: [{ id: 'own-deep', name: 'Deep', type: 'Template' }],
            },
          ],
        },
      ],
    };
    const generated = [
      {
        id: 'kiln-work-menu',
        name: 'New work',
        type: 'Multi',
        choices: [{ id: 'kiln-work-bug', name: 'New bug', type: 'Template' }],
      },
    ];
    const { value, warnings } = merge('settings/plugins/quickadd.json', current, [], {}, { choices: generated });
    const choices = (value as { choices: { id: string; choices?: { id: string }[] }[] }).choices;
    expect(choices.map((c) => c.id)).toEqual([
      'mine',
      'own-spike',
      'own-deep',
      'kiln-capture',
      'kiln-log',
      'kiln-work-menu',
    ]);
    expect(choices.at(-1)?.choices?.map((c) => c.id)).toEqual(['kiln-work-bug']);
    expect(warnings).toContain(
      '.obsidian/plugins/quickadd/data.json: your choices own-spike, own-deep were inside kiln menus, so they move to the top level',
    );
  });

  it('QuickAdd: keeps kiln choices of a type only the vault has, and names others the blueprint dropped', () => {
    const runbook: Json = {
      id: 'kiln-runbook-menu',
      name: 'New runbook',
      type: 'Multi',
      choices: [{ id: 'kiln-runbook-restart', name: 'New restart', type: 'Template' }],
    };
    const current: Json = {
      choices: [
        {
          id: 'mine',
          name: 'Mine',
          type: 'Multi',
          choices: [{ id: 'kiln-runbookish', name: 'Gone', type: 'Template' }],
        },
        runbook,
        { id: 'kiln-capture', name: 'Capture to inbox', type: 'Template' },
        { id: 'kiln-retired', name: 'Retired', type: 'Template' },
      ],
    };
    const extra = { choices: [], vaultOnlyTypes: ['runbook'] };
    const { value, warnings } = merge('settings/plugins/quickadd.json', current, [], {}, extra);
    const choices = (value as { choices: { id: string; choices?: Json[] }[] }).choices;
    expect(choices.map((c) => c.id)).toEqual(['mine', 'kiln-runbook-menu', 'kiln-capture', 'kiln-log']);
    expect(choices[0]?.choices).toEqual([]);
    expect(choices[1]).toEqual(runbook);
    expect(warnings).toEqual([
      '.obsidian/plugins/quickadd/data.json: kiln choices the blueprint no longer makes are removed: kiln-runbookish, kiln-retired',
    ]);
    // kiln's own choices come back, so they aren't named; nothing is named twice.
    expect(merge('settings/plugins/quickadd.json', value ?? null, [], {}, extra)).toMatchObject({
      changes: [],
      warnings: [],
    });
  });

  it('Iconic: keeps kiln rules of a type only the vault has, and names others the blueprint dropped', () => {
    const current = {
      fileRules: [
        { id: 'mine', name: 'Mine' },
        { id: 'kiln-runbook', name: 'Runbook' },
        { id: 'kiln-work-bug', name: 'Old bug rule' },
        { id: 'kiln-retired', name: 'Old' },
      ],
    };
    const { value, warnings } = merge(
      'settings/plugins/iconic.json',
      current,
      [],
      {},
      {
        choices: [],
        vaultOnlyTypes: ['runbook'],
      },
    );
    const ids = (value as { fileRules: { id: string }[] }).fileRules.map((r) => r.id);
    expect(ids.slice(-2)).toEqual(['mine', 'kiln-runbook']);
    expect(ids.filter((id) => id === 'kiln-work-bug')).toHaveLength(1);
    expect(ids).not.toContain('kiln-retired');
    expect(warnings).toEqual([
      '.obsidian/plugins/iconic/data.json: kiln rules the blueprint no longer makes are removed: kiln-retired',
    ]);
  });

  it('the workspace: File properties becomes the visible tab, once', () => {
    const fresh = {
      main: { id: 'm', type: 'split', children: [] },
      right: {
        id: 'r',
        type: 'split',
        collapsed: true,
        children: [
          { id: 't', type: 'tabs', children: [{ id: 'b', type: 'leaf', state: { type: 'backlink', state: {} } }] },
        ],
      },
    };
    const first = merge('settings/workspace-file-properties.json', fresh);
    const right = (
      first.value as {
        right: { collapsed: boolean; children: { currentTab: number; children: { state: { type: string } }[] }[] };
      }
    ).right;
    expect(right.collapsed).toBe(false);
    expect(right.children[0]?.currentTab).toBe(1);
    expect(right.children[0]?.children[1]?.state.type).toBe('file-properties');
    expect(merge('settings/workspace-file-properties.json', first.value).changes).toEqual([]);
  });

  it('the workspace: an existing File properties leaf is made current; no file, no change', () => {
    const leaf = { id: 'p', type: 'leaf', state: { type: 'file-properties', state: {} } };
    const current = {
      right: {
        id: 'r',
        type: 'split',
        children: [{ id: 't', type: 'tabs', currentTab: 1, children: [leaf, { id: 'o', type: 'leaf' }] }],
      },
    };
    const value = merge('settings/workspace-file-properties.json', current).value as {
      right: { children: { currentTab: number }[] };
    };
    expect(value.right.children[0]?.currentTab).toBe(0);
    expect(merge('settings/workspace-file-properties.json', undefined).value).toBeUndefined();
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Json } from '../../src/setup/json.js';
import { mergeFragment, Merger } from '../../src/setup/merge.js';
import { BLUEPRINT } from '../kit/load.js';

const TARGET: Record<string, string> = {
  'settings/app.json': '.obsidian/app.json',
  'settings/types.json': '.obsidian/types.json',
  'settings/daily-notes.json': '.obsidian/daily-notes.json',
  'settings/core-plugins.json': '.obsidian/core-plugins.json',
  'settings/community-plugins.json': '.obsidian/community-plugins.json',
  'settings/plugins/homepage.json': '.obsidian/plugins/homepage/data.json',
};

/** Merges one blueprint fragment over `current`. */
function merge(fragment: string, current: Json | undefined, take: string[] = [], kept: Record<string, Json> = {}) {
  const blueprint = JSON.parse(readFileSync(join(BLUEPRINT, fragment), 'utf8')) as Json;
  const m = new Merger(TARGET[fragment] ?? fragment, { take: new Set(take), kept });
  const value = mergeFragment(fragment, current, blueprint, m, { choices: [] });
  return { value, changes: m.changes, overrides: m.overrides };
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

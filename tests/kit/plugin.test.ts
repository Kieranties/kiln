import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { KIT, splitFrontmatter } from './load.js';

// The kit folder is the kiln plugin for Claude Code. These checks keep it one folder: the plugin
// ships exactly the files the other kit tests read, and its skill points at the kit's own README.

const REPO = fileURLToPath(new URL('../../', import.meta.url));

type Entry = { name: string; source: unknown; version?: string };
const marketplace = JSON.parse(readFileSync(join(REPO, '.claude-plugin', 'marketplace.json'), 'utf8')) as {
  name: string;
  owner: { name: string };
  plugins: Entry[];
};
const manifest = JSON.parse(readFileSync(join(KIT, '.claude-plugin', 'plugin.json'), 'utf8')) as {
  name: string;
  version?: string;
};

const SKILL_NAME = 'apply-kit';
const skill = splitFrontmatter(readFileSync(join(KIT, 'skills', SKILL_NAME, 'SKILL.md'), 'utf8'));
const skillMeta = (parse(skill.frontmatter) ?? {}) as { name?: string; description?: string };

const readme = readFileSync(join(KIT, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
const readmeHeadings = [...readme.matchAll(/^## (.+)$/gm)].map((m) => m[1] ?? '');

/** The text of a `## ` section of the kit README. */
function section(heading: string): string {
  const start = readme.indexOf(`## ${heading}\n`);
  if (start < 0) throw new Error(`no section ${heading}`);
  const next = readme.indexOf('\n## ', start + 1);
  return readme.slice(start, next < 0 ? undefined : next);
}

const entry = marketplace.plugins[0];
const source = typeof entry?.source === 'string' ? entry.source : '';
const INSTALL = [
  `claude plugin marketplace add Kieranties/kiln --sparse .claude-plugin ${source.replace(/^\.\//, '')}`,
  `claude plugin install ${entry?.name ?? ''}@${marketplace.name}`,
];

describe('the kiln plugin', () => {
  it('the marketplace lists one plugin, and its source is the kit folder', () => {
    expect(marketplace.name).toBe('kiln');
    expect(marketplace.owner.name).not.toBe('');
    expect(marketplace.plugins).toHaveLength(1);
    expect(entry?.name).toBe('kiln');
    // One copy of the kit: the plugin is the folder every other kit test reads.
    expect(source).toBe('./kit');
    expect(resolve(REPO, source)).toBe(resolve(KIT));
  });

  it('the entry and manifest names match, and neither pins a version', () => {
    // A pinned version holds every user on it; without one, each commit to main is an update.
    expect(manifest.name).toBe(entry?.name);
    expect(manifest.version).toBeUndefined();
    expect(entry?.version).toBeUndefined();
  });

  it(`has one skill, ${SKILL_NAME}, that Claude can find`, () => {
    expect(readdirSync(join(KIT, 'skills'))).toEqual([SKILL_NAME]);
    expect(skillMeta.name).toBe(SKILL_NAME);
    // Claude Code truncates a skill's description at 1,536 characters in its listing.
    expect(skillMeta.description?.length ?? 0).toBeGreaterThan(0);
    expect(skillMeta.description?.length ?? 0).toBeLessThanOrEqual(1536);
    expect(skill.body).toContain('${CLAUDE_PLUGIN_ROOT}');
  });

  it('every quoted name in the skill is a README section or a setting the README names', () => {
    const quoted = [...skill.body.matchAll(/"([^"\n]+)"/g)].map((m) => m[1] ?? '');
    expect(quoted).toEqual(expect.arrayContaining(['Setting up a vault', 'Adding or changing a type']));
    for (const name of quoted) {
      if (readmeHeadings.includes(name)) continue;
      expect(readme, `"${name}" is neither a README section nor in the README`).toContain(name);
    }
  });

  it('every kit file and folder the skill names exists', () => {
    // Paths in backticks. Vault-only paths are allowed; `_kiln/<x>` is the vault copy of kit file <x>.
    const VAULT_ONLY = ['.obsidian/', '_kiln/', '/d/notes', 'workspace.json', 'Home.md', 'Board.base'];
    const paths = [...skill.body.matchAll(/`([^`\s<>\\]+)`/g)]
      .map((m) => m[1] ?? '')
      .filter((p) => /\/|.\.(md|json|base)$/.test(p) && !p.startsWith('$'));
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      if (VAULT_ONLY.includes(path)) continue;
      const inKit = join(KIT, path.replace(/^_kiln\//, ''));
      const ok = existsSync(inKit) || existsSync(join(REPO, path));
      expect(ok, `${path} is not in the kit or the repo`).toBe(true);
    }
    expect(existsSync(join(REPO, 'tests', 'fixtures', 'layer1'))).toBe(true);
  });

  it("the skill runs the README's procedure rather than restating it", () => {
    // These belong to "Setting up a vault" step 4. A copy in the skill would drift from the README.
    for (const detail of [
      'userIgnoreFilters',
      'enabledCssSnippets',
      'folder_templates',
      'fileRules',
      'templater-obsidian/data.json',
    ]) {
      expect(readme, detail).toContain(detail);
      expect(skill.body, detail).not.toContain(detail);
    }
  });

  it('the plugin files never go into a vault', () => {
    // The README's table says where every kit folder goes, so a new one cannot be copied by accident.
    const table = section('What the kit is');
    const folders = readdirSync(KIT, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const folder of folders) expect(table, folder.name).toContain(`\`${folder.name}/\``);
    const copy = section('Setting up a vault');
    for (const part of ['.claude-plugin/', 'skills/']) expect(copy, part).toContain(part);
  });
});

describe('installing the plugin', () => {
  const guide = readFileSync(join(KIT, 'GETTING-STARTED.md'), 'utf8');
  const sample = readFileSync(join(KIT, 'TRY-THE-SAMPLE.md'), 'utf8');
  const repoReadme = readFileSync(join(REPO, 'README.md'), 'utf8');

  it('the guides install it with the same commands, which name the marketplace and the kit folder', () => {
    for (const command of INSTALL) {
      expect(guide, command).toContain(command);
      expect(section('The kiln plugin'), command).toContain(command);
    }
    expect(repoReadme).toContain(INSTALL[0]);
  });

  it('setting up a vault needs no clone of the repo', () => {
    for (const doc of [guide, sample]) {
      expect(doc).not.toContain('git clone');
      expect(doc).not.toContain('Start Claude in the kiln repo');
      expect(doc).not.toMatch(/^\s*cd kiln$/m);
    }
  });

  it('the sample is loaded only when asked for', () => {
    const apply = guide
      .replace(/\r\n/g, '\n')
      .split('\n## ')
      .find((s) => s.startsWith('3. Apply the kit'));
    expect(apply).toContain('Set up the kiln kit in <vault folder>.');
    expect(apply).not.toMatch(/sample/i);
    expect(sample).toContain('with the Northwind Arena sample');
  });
});

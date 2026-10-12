import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { installedFiles } from '../../src/setup/blueprint.js';
import { BLUEPRINT } from '../support/blueprint.js';

const SAMPLE = fileURLToPath(new URL('../fixtures/sample/', import.meta.url));
const SITE = 'https://kiln.kieranties.com';

const GUIDES = fileURLToPath(new URL('../../docs/guides/', import.meta.url));
const readme = readFileSync(join(BLUEPRINT, 'README.md'), 'utf8');
const guide = readFileSync(join(GUIDES, 'getting-started.md'), 'utf8');
const sample = readFileSync(join(GUIDES, 'try-the-sample.md'), 'utf8');
const install = readFileSync(join(GUIDES, 'install.md'), 'utf8');

/** The text of a `## ` section of a Markdown document. */
function section(document: string, heading: string): string {
  const text = document.replace(/\r\n/g, '\n');
  const start = text.indexOf(`## ${heading}\n`);
  if (start < 0) throw new Error(`no section ${heading}`);
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next < 0 ? undefined : next);
}

describe('section()', () => {
  it('finds a section in a document with Windows line endings', () => {
    // Windows checkouts turn the docs' \n into \r\n.
    expect(section('## One\r\nfirst\r\n## Two\r\nsecond\r\n', 'One')).toContain('first');
  });
});

describe('the blueprint README and the guides', () => {
  it("both docs mention Templater's per-device trigger", () => {
    // Templater keeps this switch in Obsidian's local storage, so no settings file can set it.
    for (const doc of [readme, guide]) expect(doc).toContain('Trigger Templater on new file creation');
  });

  it('getting started sets up your own vault and links the sample as an extension', () => {
    expect(guide).not.toContain('tests/fixtures');
    expect(guide).toContain('](./try-the-sample.md)');
  });

  it('the sample page names every sample note', () => {
    expect(sample).toContain('tests/fixtures/sample');
    const notes = readdirSync(SAMPLE, { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
    for (const note of notes) expect(sample, note.name).toContain(basename(note.name, '.md'));
  });

  it('setting up a vault applies the kiln snippet', () => {
    const steps = section(readme, 'Setting up a vault');
    for (const part of ['snippets/kiln.css', 'appearance.json']) expect(steps, part).toContain(part);
  });

  it('the property list is copied, merged and kept up to date', () => {
    expect(section(readme, 'What the blueprint is')).toContain('properties.md');
    const setup = section(readme, 'Setting up a vault');
    for (const part of ['properties.md', 'propertyIcons']) expect(setup, part).toContain(part);
    expect(section(readme, 'Adding or changing a type')).toContain('properties.md');
  });

  it('setting up a vault opens file properties in the right sidebar', () => {
    const steps = section(readme, 'Setting up a vault');
    for (const part of ['workspace-file-properties.json', 'workspace.json', 'currentTab']) {
      expect(steps, part).toContain(part);
    }
    expect(guide).not.toContain('Run **Show file properties**');
  });

  it('setting up a vault copies the README, and points at the guides on the docs site', () => {
    const steps = section(readme, 'Setting up a vault');
    expect(steps).toContain('this README');
    for (const page of [
      'guides/getting-started#_2-make-your-vault',
      'guides/try-the-sample',
      'guides/getting-started#_4-check-it',
    ]) {
      expect(steps, page).toContain(`${SITE}/${page}`);
    }
  });

  it('adding a type names every place that must change', () => {
    const steps = section(readme, 'Adding or changing a type');
    for (const place of [
      'types/',
      'templates/',
      'views/',
      'settings/plugins/iconic.json',
      'settings/plugins/templater.json',
      'settings/types.json',
      'tests/blueprint/definitions.test.ts',
      'tests/fixtures/sample',
      'folder',
    ]) {
      expect(steps, place).toContain(place);
    }
  });
  it('the README says how Claude finds the vault, in Bash and PowerShell', () => {
    const conventions = section(readme, 'Conventions');
    for (const part of ['~/.kiln/config.json', 'KILN_VAULT', 'export KILN_VAULT=work', "$env:KILN_VAULT = 'work'"]) {
      expect(conventions, part).toContain(part);
    }
  });
});

describe('setting up from any folder', () => {
  it('the guides need no clone of the kiln repo', () => {
    for (const doc of [guide, sample]) {
      expect(doc).not.toContain('git clone');
      expect(doc).not.toContain('Start Claude in the kiln repo');
      expect(doc).not.toMatch(/^\s*cd kiln$/m);
    }
  });

  it('getting started installs the plugin by the install guide', () => {
    expect(guide).toContain('](./install.md)');
    expect(install).toMatch(/^## Install$/m);
  });

  it('section 3 is one prompt, without the sample; the sample is asked for', () => {
    const apply = section(guide, '3. Apply the blueprint');
    expect(apply).toContain('/kiln:setup <vault folder>');
    expect(apply).not.toMatch(/sample/i);
    expect(sample).toContain('/kiln:setup <trial vault folder> with the Northwind Arena sample');
  });

  it('Claude installs the five plugins through the Obsidian CLI, and the owner does it by hand only without the CLI', () => {
    const make = section(guide, '2. Make your vault');
    for (const part of ['Command line interface', 'keep it open', 'Without the Obsidian CLI', 'Exit restricted mode']) {
      expect(make, part).toContain(part);
    }
    // The manual steps are the fallback, after the CLI, not numbered steps of their own.
    expect(make.indexOf('Without the Obsidian CLI')).toBeLessThan(make.indexOf('Exit restricted mode'));
    expect(make).not.toMatch(/^\d+\. .*Exit restricted mode/m);
    const apply = section(guide, '3. Apply the blueprint');
    for (const part of [
      'installs',
      'restricted mode',
      'asks first',
      'Close Vault',
      'Trigger Templater on new file creation',
    ]) {
      expect(apply, part).toContain(part);
    }
    expect(guide).not.toContain('section 2, step 6');
    const steps = section(readme, 'Setting up a vault');
    for (const part of [
      'plugins:restrict off',
      "plugin:install id='<id>' enable",
      'obsidian.com',
      'Check for updates',
    ]) {
      expect(steps, part).toContain(part);
    }
  });

  it('Claudian: named by its author, its consent said, and checked by running /kiln:check in it', () => {
    expect(section(guide, '1. What you need')).toContain('Claudian');
    const make = section(guide, '2. Make your vault');
    for (const part of ['**Claudian**', 'Yishen Tu']) expect(make, part).toContain(part);
    expect(section(guide, '3. Apply the blueprint')).toContain("haven't reviewed");
    const check = section(guide, '4. Check it');
    for (const part of ['Open Claudian', '/kiln:check', 'Load user Claude Code settings']) {
      expect(check, part).toContain(part);
    }
    const steps = section(readme, 'Setting up a vault');
    for (const part of ['`realclaudian`', "haven't reviewed"]) expect(steps, part).toContain(part);
  });

  it('relative links in the blueprint docs stay in the blueprint, so they work in _kiln/', () => {
    const installed = installedFiles(BLUEPRINT);
    for (const doc of readdirSync(BLUEPRINT).filter((f) => f.endsWith('.md'))) {
      const text = readFileSync(join(BLUEPRINT, doc), 'utf8');
      for (const [, target = ''] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const file = decodeURI(target.split('#')[0] ?? '');
        expect(installed.has(`_kiln/${file}`), `${doc}: ${target}`).toBe(true);
      }
    }
  });

  it('the README is the manual fallback: the record, overrides, generated choices and minimum versions', () => {
    const steps = section(readme, 'Setting up a vault');
    for (const part of [
      '/kiln:setup',
      'requires.json',
      '.kiln/blueprint.json',
      '_kiln/templates/kinds/',
      '"kind": "apply", "mode": "doNothing"',
      'kiln-<type>-<kind>',
      '{{VALUE:title}}',
      'Close Vault',
    ]) {
      expect(steps, part).toContain(part);
    }
    expect(section(readme, 'Adding or changing a type')).toContain('/kiln:setup');
  });
});

describe('guide caveats', () => {
  it('says where a locally edited type reaches the vault from', () => {
    for (const doc of [guide, section(readme, 'Adding or changing a type')]) {
      expect(doc).toContain('--plugin-dir D:/src/kiln/claude-plugin');
      expect(doc).toContain('claude plugin update kiln@kiln');
    }
  });

  it('warns that hand-made notes need the trigger, and that a new plugin needs a reload', () => {
    expect(section(guide, '5. Your first notes')).toContain('Templater');
    expect(section(guide, '1. What you need')).toContain('/reload-plugins');
  });
});

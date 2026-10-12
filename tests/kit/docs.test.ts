import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BLUEPRINT } from './load.js';

const SAMPLE = fileURLToPath(new URL('../fixtures/layer1/', import.meta.url));

const readme = readFileSync(join(BLUEPRINT, 'README.md'), 'utf8');
const guide = readFileSync(join(BLUEPRINT, 'GETTING-STARTED.md'), 'utf8');

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

describe('blueprint docs', () => {
  it("both docs say to turn on Templater's per-device trigger", () => {
    // Templater keeps this switch in Obsidian's local storage, so no settings file can set it.
    for (const doc of [readme, guide]) expect(doc).toContain('Trigger Templater on new file creation');
  });

  it('getting started sets up your own vault and links the sample as an extension', () => {
    expect(guide).not.toContain('tests/fixtures');
    expect(guide).toContain('](TRY-THE-SAMPLE.md)');
  });

  it('the sample page names every sample note', () => {
    const sample = readFileSync(join(BLUEPRINT, 'TRY-THE-SAMPLE.md'), 'utf8');
    expect(sample).toContain('tests/fixtures/layer1');
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

  it('setting up a vault copies all three blueprint docs', () => {
    const steps = section(readme, 'Setting up a vault');
    for (const doc of ['GETTING-STARTED.md', 'TRY-THE-SAMPLE.md']) expect(steps, doc).toContain(doc);
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
      'tests/kit/definitions.test.ts',
      'tests/fixtures/layer1',
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

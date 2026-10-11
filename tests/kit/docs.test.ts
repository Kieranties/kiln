import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KIT } from './load.js';

const readme = readFileSync(join(KIT, 'README.md'), 'utf8');
const guide = readFileSync(join(KIT, 'GETTING-STARTED.md'), 'utf8');

/** The text of a `## ` section of a Markdown document. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}\n`);
  if (start < 0) throw new Error(`no section ${heading}`);
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next < 0 ? undefined : next);
}

describe('kit docs', () => {
  it("both docs say to turn on Templater's per-device trigger", () => {
    // Templater keeps this switch in Obsidian's local storage, so no settings file can set it.
    for (const doc of [readme, guide]) expect(doc).toContain('Trigger Templater on new file creation');
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
});

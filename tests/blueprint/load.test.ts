import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readBlueprint, readDefinitions, readPropertyCatalogue } from '../../src/blueprint/load.js';
import { sectionsOf, splitFrontmatter } from '../../src/blueprint/markdown.js';
import { BLUEPRINT } from '../support/blueprint.js';

const tmp = mkdtempSync(join(tmpdir(), 'kiln-blueprint-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readBlueprint', () => {
  it('reads the repo blueprint: twelve definitions and the property catalogue', () => {
    const blueprint = readBlueprint(BLUEPRINT);
    expect(blueprint.definitions.map((d) => d.name)).toEqual([
      'capture',
      'daily',
      'decision',
      'meeting',
      'organisation',
      'person',
      'product',
      'project',
      'reference',
      'research',
      'topic',
      'work',
    ]);
    expect(blueprint.properties.entries.attendees).toEqual({ links: 'person' });
  });

  it('names the file and field of a malformed definition', () => {
    mkdirSync(join(tmp, 'types'), { recursive: true });
    writeFileSync(
      join(tmp, 'types', 'bad.md'),
      '---\nname: bad\nfolder: Bad\nnaming: title\nstatuses: active\n---\nBad.\n',
    );
    expect(() => readDefinitions(tmp)).toThrow(/types\/bad\.md: statuses must be a list/);
  });

  it('requires a known naming rule', () => {
    mkdirSync(join(tmp, 'types'), { recursive: true });
    writeFileSync(join(tmp, 'types', 'bad.md'), '---\nname: bad\nfolder: Bad\nnaming: loud\n---\nBad.\n');
    expect(() => readDefinitions(tmp)).toThrow(
      /types\/bad\.md: naming must be one of title, date, date-title, source-title/,
    );
  });

  it('requires last to be one of the sections', () => {
    mkdirSync(join(tmp, 'types'), { recursive: true });
    writeFileSync(
      join(tmp, 'types', 'bad.md'),
      '---\nname: bad\nfolder: Bad\nnaming: title\nsections:\n  - Notes\nlast: Log\n---\nBad.\n',
    );
    expect(() => readDefinitions(tmp)).toThrow(/types\/bad\.md: last must be one of its sections/);
  });

  it('rejects a kind or property entry whose inner field is not text', () => {
    mkdirSync(join(tmp, 'types'), { recursive: true });
    writeFileSync(
      join(tmp, 'types', 'bad.md'),
      '---\nname: bad\nfolder: Bad\nnaming: title\nkinds:\n  odd:\n    icon: 3\n---\nBad.\n',
    );
    expect(() => readDefinitions(tmp)).toThrow(/types\/bad\.md: kinds\.odd is not valid/);
    writeFileSync(join(tmp, 'properties.md'), '---\nshared: [type]\nproperties:\n  owner:\n    links: [person]\n---\n');
    expect(() => readPropertyCatalogue(tmp)).toThrow(/properties\.md: properties\.owner is not valid/);
  });
});

describe('markdown', () => {
  it('splits frontmatter after a byte-order mark, with Windows line endings', () => {
    expect(splitFrontmatter('\uFEFF---\r\ntype: work\r\n---\r\n## Context\r\n')).toEqual({
      frontmatter: 'type: work',
      body: '## Context\r\n',
    });
  });

  it('trims section headings', () => {
    expect([...sectionsOf('## Log \n- 09:00 x\n').keys()]).toEqual(['Log']);
  });
});

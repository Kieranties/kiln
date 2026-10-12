import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { sortFile, usersOf } from '../../src/setup/files.js';
import { readRecord, writeRecord } from '../../src/setup/record.js';

const [R, V, B] = ['sha256:r', 'sha256:v', 'sha256:b'];

describe('sortFile: the spec table', () => {
  it.each([
    ['unchanged in the vault, changed in the blueprint: update', R, R, B, 'update'],
    ['changed by the owner, unchanged in the blueprint: keep', R, V, R, 'keep'],
    ['changed by both: ask', R, V, B, 'ask'],
    ['missing, new in the blueprint: add', undefined, undefined, B, 'add'],
    ['installed, then deleted by the owner: deleted, not restored', R, undefined, B, 'deleted'],
    ['present, dropped from the blueprint: dropped', R, V, undefined, 'dropped'],
  ] as const)('%s', (_name, recorded, vault, blueprint, action) => {
    expect(sortFile('_kiln/views/x.base', recorded, vault, blueprint, true)).toBe(action);
  });

  it('the cases around it', () => {
    expect(sortFile('_kiln/x.md', R, B, B, true)).toBe('unchanged');
    expect(sortFile('_kiln/x.md', R, undefined, R, true)).toBe('deleted');
    expect(sortFile('_kiln/x.md', R, undefined, undefined, true)).toBe('forget');
    expect(sortFile('_kiln/x.md', undefined, V, undefined, true)).toBe('skip');
    expect(sortFile('Home.md', undefined, V, B, true)).toBe('ask');
    expect(sortFile('Home.md', undefined, V, B, false)).toBe('ask');
    expect(sortFile('_kiln/types/work.md', undefined, V, B, false)).toBe('replace');
    expect(sortFile('_kiln/views/new.base', undefined, V, B, true)).toBe('ask');
  });
});

describe('usersOf', () => {
  const notes = [
    { path: 'Home.md', text: '## Inbox\n\n![[inbox.base]]\n' },
    { path: 'Runbooks/Restart.md', text: '---\ntype: runbook\n---\nSee [[Club Console]].\n' },
    { path: 'Work/Other.md', text: '---\ntype: work\n---\n' },
  ];
  it('finds notes that link to a dropped file, or use a dropped type', () => {
    expect(usersOf('_kiln/views/inbox.base', notes)).toEqual(['Home.md']);
    expect(usersOf('_kiln/types/runbook.md', notes)).toEqual(['Runbooks/Restart.md']);
    expect(usersOf('_kiln/templates/Runbook.md', notes)).toEqual([]);
  });
});

describe('the version record', () => {
  const vault = mkdtempSync(join(tmpdir(), 'kiln-record-'));
  afterAll(() => rmSync(vault, { recursive: true, force: true }));

  it('round-trips, sorted, and is written only when it changes', () => {
    const record = {
      plugin: 'a1b2c3d4e5f6',
      blueprint: 'sha256:x',
      files: { 'b.md': 'sha256:2', 'a.md': 'sha256:1' },
      kept: {},
    };
    expect(readRecord(vault)).toBeUndefined();
    expect(writeRecord(vault, record)).toBe(true);
    expect(readFileSync(join(vault, '.kiln', 'blueprint.json'), 'utf8')).toBe(
      '{\n  "plugin": "a1b2c3d4e5f6",\n  "blueprint": "sha256:x",\n  "files": {\n    "a.md": "sha256:1",\n    "b.md": "sha256:2"\n  }\n}\n',
    );
    expect(readRecord(vault)).toEqual(record);
    expect(writeRecord(vault, record)).toBe(false);
  });

  it('keeps kept overrides, and names itself when malformed', () => {
    const record = { plugin: 'p', blueprint: 'sha256:x', files: {}, kept: { 'Home.md': 'sha256:h' } };
    expect(writeRecord(vault, record)).toBe(true);
    expect(readRecord(vault)).toEqual(record);
    const file = join(vault, '.kiln', 'blueprint.json');
    writeFileSync(file, '{ "plugin": "p", "blueprint": "sha256:x", "files": { "a.md": 1 } }');
    expect(() => readRecord(vault)).toThrow('.kiln/blueprint.json: "files" has a value for a.md that is not text');
    writeFileSync(file, '[]');
    expect(() => readRecord(vault)).toThrow('.kiln/blueprint.json: not an object');
  });
});

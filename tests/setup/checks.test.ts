import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  checkPlugins,
  compareVersions,
  findObsidianCli,
  isObsidianRunning,
  type Exec,
} from '../../src/setup/checks.js';

const dir = mkdtempSync(join(tmpdir(), 'kiln-checks-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function plugin(id: string, version: string, files = ['manifest.json', 'main.js']) {
  const folder = join(dir, '.obsidian', 'plugins', id);
  mkdirSync(folder, { recursive: true });
  for (const f of files) writeFileSync(join(folder, f), f === 'manifest.json' ? JSON.stringify({ id, version }) : '');
}

describe('versions', () => {
  it('compare by number, ignoring a pre-release tag', () => {
    expect(compareVersions('2.32.0', '2.32')).toBe(0);
    expect(compareVersions('2.4.0', '2.32.0')).toBeLessThan(0);
    expect(compareVersions('2.25.2-beta.0', '2.25.2')).toBe(0);
  });
});

describe('checkPlugins', () => {
  it('needs manifest.json and main.js, and warns below the minimum', () => {
    plugin('iconic', '1.1.10');
    plugin('quickadd', '2.31.0');
    plugin('homepage', '4.5.0', ['manifest.json']);
    const requires = {
      obsidian: '1.14.0',
      plugins: { iconic: '1.1.10', 'templater-obsidian': '2.26.0', quickadd: '2.32.0', homepage: '4.5.0' },
    };
    expect(checkPlugins(dir, requires)).toEqual([
      { id: 'iconic', version: '1.1.10', minimum: '1.1.10', status: 'ok' },
      { id: 'templater-obsidian', version: null, minimum: '2.26.0', status: 'missing' },
      { id: 'quickadd', version: '2.31.0', minimum: '2.32.0', status: 'old' },
      { id: 'homepage', version: null, minimum: '4.5.0', status: 'missing' },
    ]);
  });
  it('treats a broken manifest, or one without a text version, as missing', () => {
    const folder = join(dir, '.obsidian', 'plugins');
    mkdirSync(join(folder, 'broken'), { recursive: true });
    writeFileSync(join(folder, 'broken', 'manifest.json'), '{ "version": ');
    writeFileSync(join(folder, 'broken', 'main.js'), '');
    mkdirSync(join(folder, 'numbered'), { recursive: true });
    writeFileSync(join(folder, 'numbered', 'manifest.json'), '{ "version": 2 }');
    writeFileSync(join(folder, 'numbered', 'main.js'), '');
    const requires = { obsidian: '1.14.0', plugins: { broken: '1.0.0', numbered: '1.0.0' } };
    expect(checkPlugins(dir, requires).map((p) => p.status)).toEqual(['missing', 'missing']);
  });
});

describe('the Obsidian CLI', () => {
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });

  it('is found on PATH as Obsidian.com on Windows', () => {
    writeFileSync(join(bin, 'Obsidian.com'), '');
    expect(findObsidianCli({ Path: `${join(dir, 'nothing')};;${bin}` }, 'win32')).toBe(join(bin, 'Obsidian.com'));
    expect(findObsidianCli({ Path: join(dir, 'nothing') }, 'win32')).toBeNull();
    expect(findObsidianCli({}, 'win32')).toBeNull();
  });
  // PATH splits on ":" outside Windows, so a Windows folder such as D:\tmp can't stand in for one there.
  it.skipIf(process.platform === 'win32')('is found on PATH as obsidian elsewhere', () => {
    const other = join(dir, 'other-bin');
    mkdirSync(other, { recursive: true });
    writeFileSync(join(other, 'Obsidian.com'), '');
    expect(findObsidianCli({ PATH: other }, 'linux')).toBeNull();
    writeFileSync(join(other, 'obsidian'), '');
    expect(findObsidianCli({ PATH: `${join(dir, 'nothing')}::${other}` }, 'linux')).toBe(join(other, 'obsidian'));
  });
});

describe('isObsidianRunning', () => {
  const calls: string[][] = [];
  const exec =
    (result: ReturnType<Exec>): Exec =>
    (command, args) => {
      calls.push([command, ...args]);
      return result;
    };

  it('asks tasklist on Windows', () => {
    expect(
      isObsidianRunning('win32', exec({ status: 0, stdout: '"Obsidian.exe","1234","Console","1","250,000 K"\r\n' })),
    ).toBe(true);
    expect(
      isObsidianRunning(
        'win32',
        exec({ status: 0, stdout: 'INFO: No tasks are running which match the specified criteria.\r\n' }),
      ),
    ).toBe(false);
    expect(calls[0]).toEqual(['tasklist', '/FI', 'IMAGENAME eq Obsidian.exe', '/NH', '/FO', 'CSV']);
  });
  it('asks pgrep elsewhere', () => {
    expect(isObsidianRunning('darwin', exec({ status: 0, stdout: '4321\n' }))).toBe(true);
    expect(isObsidianRunning('linux', exec({ status: 1, stdout: '' }))).toBe(false);
    expect(calls.at(-1)).toEqual(['pgrep', '-x', '-i', 'obsidian']);
  });
  it("is unknown when the check can't run", () => {
    expect(isObsidianRunning('win32', exec({ status: null, stdout: '', error: new Error('ENOENT') }))).toBeNull();
    expect(isObsidianRunning('linux', exec({ status: 2, stdout: '' }))).toBeNull();
    expect(isObsidianRunning('win32', exec({ status: 1, stdout: 'ERROR: Invalid argument.\r\n' }))).toBeNull();
  });
});

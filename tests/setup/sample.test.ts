import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadSample } from '../../src/setup/sample.js';
import { applySetup, planSetup, type Fetch } from '../../src/setup/setup.js';
import { cleanupAll, fakeGitHub, fingerprint, PLUGIN_ROOT, pluginCopy, testVault } from './fixture.js';

afterAll(cleanupAll);
const SAMPLE = join(PLUGIN_ROOT, '..', 'tests', 'fixtures', 'layer1');
const count = readdirSync(SAMPLE, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).length;
const SHA = 'a1b2c3d4e5f6';

describe('loadSample', () => {
  it("reads the plugin's own clone", async () => {
    const { source, files } = await loadSample(PLUGIN_ROOT, fakeGitHub(SHA));
    expect(source).toBe('local');
    expect(files).toHaveLength(count);
  });

  it("fetches it from GitHub at the plugin's commit", async () => {
    const github = fakeGitHub(SHA);
    const { source, files } = await loadSample(pluginCopy(SHA), github);
    expect(source).toBe(`github:Kieranties/kiln@${SHA.padEnd(40, '0')}`);
    expect(files.find((f) => f.path === 'People/Priya Raman.md')?.text).toBe(
      readFileSync(join(SAMPLE, 'People', 'Priya Raman.md'), 'utf8'),
    );
    expect(github.urls[0]).toBe(`https://api.github.com/repos/Kieranties/kiln/commits/${SHA}`);
    expect(github.urls).toContain(
      `https://raw.githubusercontent.com/Kieranties/kiln/${SHA.padEnd(40, '0')}/tests/fixtures/layer1/People/Priya%20Raman.md`,
    );
  });

  it('refuses a plugin version that is not a commit', async () => {
    await expect(loadSample(pluginCopy('claude-plugin-dev'), fakeGitHub(SHA))).rejects.toThrow(
      'can\'t pin the sample: the plugin version "claude-plugin-dev" isn\'t a commit',
    );
  });

  it('names the URL when there is no network', async () => {
    const offline = () => Promise.reject(new Error('getaddrinfo ENOTFOUND api.github.com'));
    await expect(loadSample(pluginCopy(SHA), offline)).rejects.toThrow(
      `can't fetch the sample: getaddrinfo ENOTFOUND api.github.com https://api.github.com/repos/Kieranties/kiln/commits/${SHA}`,
    );
  });

  it('refuses a file list GitHub cut short', async () => {
    const github = fakeGitHub(SHA);
    const cut: Fetch = (url, init) =>
      github(url, init).then((response) =>
        url.includes('/git/trees/')
          ? { ...response, json: () => Promise.resolve({ sha: SHA.padEnd(40, '0'), truncated: true, tree: [] }) }
          : response,
      );
    await expect(loadSample(pluginCopy(SHA), cut)).rejects.toThrow("the sample's file list was cut short");
  });
});

describe('setup with the sample', () => {
  it('loads every sample note, skipping files already there', async () => {
    const t = testVault();
    t.write('Work/Fix renewal date rollover.md', 'mine\n');
    const report = await applySetup(t.options({ sample: true, pluginRoot: pluginCopy(SHA), fetch: fakeGitHub(SHA) }));
    expect(report.sample).toMatchObject({ skipped: ['Work/Fix renewal date rollover.md'] });
    expect((report.sample as { files: string[] }).files).toHaveLength(count - 1);
    expect(t.read('Work/Fix renewal date rollover.md')).toBe('mine\n');
    expect(existsSync(join(t.vault, 'People', 'Priya Raman.md'))).toBe(true);
    expect(Object.keys((t.json('.kiln/blueprint.json') as { files: object }).files)).not.toContain(
      'People/Priya Raman.md',
    );
  });

  it('writes nothing at all when the fetch fails halfway', async () => {
    const t = testVault();
    const before = fingerprint(t.root);
    const report = await applySetup(
      t.options({ sample: true, pluginRoot: pluginCopy(SHA), fetch: fakeGitHub(SHA, { fail: 'Priya%20Raman' }) }),
    );
    expect(report.applied).toBe(false);
    expect(report.stop[0]).toMatch(
      /^can't fetch the sample: 403 https:\/\/raw\.githubusercontent\.com\/.*Priya%20Raman\.md$/,
    );
    expect(fingerprint(t.root)).toBe(before);
  });

  it('needs Obsidian closed, even to re-apply', async () => {
    const t = testVault();
    await applySetup(t.options());
    expect(planSetup(t.options({ sample: true, obsidianRunning: true })).stop).toContain(
      'The sample is written as plain files, which needs Obsidian closed (Templater would run on new notes). Close Obsidian, then run setup again.',
    );
  });

  it('counts the notes already in the vault, so the skill can ask first', () => {
    const t = testVault();
    t.write('Work/My own.md', 'x\n');
    expect(planSetup(t.options({ sample: true })).sample).toEqual({ notes: 1 });
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { applySetup, permissionRules, planSetup, vaultName } from '../../src/setup/setup.js';
import { blueprintHash, hash } from '../../src/setup/hash.js';
import { cleanupAll, fingerprint, PLUGIN_ROOT, testVault } from './fixture.js';

afterAll(cleanupAll);

describe('a fresh vault', () => {
  const t = testVault();

  it('plans with nothing to ask', () => {
    const plan = planSetup(t.options());
    expect(plan).toMatchObject({
      mode: 'setup',
      plugin: 'claude-plugin',
      applied: false,
      stop: [],
      asks: [],
      warnings: [],
    });
    expect(plan.folders.map((f) => f.path)).toContain('Work');
    expect(plan.files).toContainEqual({ path: '_kiln/templates/kinds/Work bug.md', action: 'add' });
    expect(plan.files).toContainEqual({ path: 'Home.md', action: 'add' });
    expect(existsSync(join(t.vault, '_kiln'))).toBe(false);
  });

  it('applies: the blueprint, the settings, the record and the kiln file', async () => {
    const report = await applySetup(t.options());
    expect(report.applied).toBe(true);
    expect(t.read('_kiln/types/work.md')).toBe(
      readFileSync(join(PLUGIN_ROOT, 'blueprint', 'types', 'work.md'), 'utf8'),
    );
    expect(existsSync(join(t.vault, 'Work'))).toBe(true);
    const app = t.read('.obsidian/app.json');
    expect(app.endsWith('}')).toBe(true);
    expect(app).not.toContain('\r');
    expect(JSON.parse(app)).toMatchObject({ alwaysUpdateLinks: true, newFileFolderPath: 'Inbox' });
    const quickadd = t.json('.obsidian/plugins/quickadd/data.json') as { choices: { id: string }[] };
    expect(quickadd.choices.map((c) => c.id)).toEqual(
      expect.arrayContaining(['kiln-capture', 'kiln-log', 'kiln-work-menu', 'kiln-topic']),
    );
    const record = t.json('.kiln/blueprint.json') as {
      plugin: string;
      blueprint: string;
      files: Record<string, string>;
    };
    expect(record.plugin).toBe('claude-plugin');
    expect(record.blueprint).toBe(blueprintHash(join(PLUGIN_ROOT, 'blueprint')));
    expect(record.files['Home.md']).toBe(hash(t.read('Home.md')));
    expect(JSON.parse(readFileSync(t.configFile, 'utf8'))).toEqual({
      default: 'Trial-Vault',
      vaults: { 'Trial-Vault': t.vault },
    });
    expect(report.kiln).toMatchObject({ name: 'Trial-Vault', recorded: 'new', default: 'Trial-Vault' });
  });

  it('a second apply changes nothing, not even a modified time', async () => {
    const before = fingerprint(join(t.root));
    const again = await applySetup(t.options());
    expect(fingerprint(join(t.root))).toBe(before);
    expect(again).toMatchObject({ mode: 'reapply', files: [], settings: [], folders: [], asks: [] });
    expect(again.kiln.recorded).toBe('already');
  });
});

describe('what stops setup', () => {
  it('a missing plugin, with nothing written', async () => {
    const t = testVault({ plugins: { quickadd: null } });
    const before = fingerprint(t.root);
    const report = await applySetup(t.options());
    expect(report.applied).toBe(false);
    expect(report.stop).toEqual([
      "quickadd isn't installed: .obsidian/plugins/quickadd/ needs manifest.json and main.js. Install it and turn it on in Obsidian (Getting started, section 2)",
    ]);
    expect(fingerprint(t.root)).toBe(before);
  });

  it('an old plugin only warns', () => {
    const report = planSetup(testVault({ plugins: { homepage: '4.4.4' } }).options());
    expect(report.stop).toEqual([]);
    expect(report.warnings).toContain(
      'homepage 4.4.4 is older than 4.5.0, the oldest the blueprint is written for. Update it in Obsidian.',
    );
  });

  it('Obsidian running, or unknown until the owner confirms', () => {
    const t = testVault();
    expect(planSetup(t.options({ obsidianRunning: true })).stop[0]).toMatch(
      /^Obsidian is running\. Setup needs it closed/,
    );
    expect(planSetup(t.options({ obsidianRunning: null })).stop).toEqual([
      "Couldn't tell whether Obsidian is running. Ask the owner, and pass --confirm-closed once it is closed.",
    ]);
    expect(planSetup(t.options({ obsidianRunning: null, confirmClosed: true })).stop).toEqual([]);
  });

  it('a settings file that is not valid JSON, named', () => {
    const t = testVault();
    t.write('.obsidian/app.json', '{ "showInlineTitle": tru }');
    expect(planSetup(t.options()).stop[0]).toMatch(
      /app\.json: not valid JSON: .*; fix or remove it, then run setup again$/,
    );
  });

  it('no Obsidian CLI only warns', () => {
    expect(planSetup(testVault().options({ cliPath: null })).warnings[0]).toMatch(/^The Obsidian CLI isn't on PATH/);
  });
});

describe('a vault already in use', () => {
  it("asks about the owner's Home.md and new-note folder, and keeps both unless taken", async () => {
    const t = testVault();
    t.write('Home.md', 'My own home.\n');
    t.write('.obsidian/app.json', '{\n  "newFileFolderPath": "Notes"\n}');
    const plan = planSetup(t.options());
    expect(plan.asks.map((a) => a.id).sort()).toEqual(['.obsidian/app.json#newFileFolderPath', 'Home.md']);
    await applySetup(t.options());
    expect(t.read('Home.md')).toBe('My own home.\n');
    expect(t.json('.obsidian/app.json')).toMatchObject({ newFileFolderPath: 'Notes' });
    expect(planSetup(t.options()).asks).toEqual([]);

    const taken = await applySetup(t.options({ take: ['Home.md'] }));
    expect(taken.files).toContainEqual({
      path: 'Home.md',
      action: 'replace',
      backup: '.kiln/backup/2026-10-12T09-30-00/Home.md',
    });
    expect(t.read('.kiln/backup/2026-10-12T09-30-00/Home.md')).toBe('My own home.\n');
    expect(t.read('Home.md')).toBe(readFileSync(join(PLUGIN_ROOT, 'blueprint', 'root', 'Home.md'), 'utf8'));
  });
});

describe('names and permissions', () => {
  it('names a vault after its folder, never taking another vault’s name', () => {
    const t = testVault();
    const elsewhere = join(t.root, 'elsewhere');
    const other = join(t.root, 'Other', 'Trial Vault');
    const w = { platform: process.platform, home: t.root };
    expect(vaultName(t.vault, undefined, w)).toEqual({ name: 'Trial-Vault', recorded: false });
    const config = { default: 'Trial-Vault', vaults: { 'Trial-Vault': elsewhere, trial: t.vault + sep } };
    expect(vaultName(t.vault, config, w)).toEqual({ name: 'trial', recorded: true });
    expect(vaultName(other, config, w)).toEqual({ name: 'Trial-Vault-2', recorded: false });
    expect(vaultName(other, config, w, 'Trial-Vault')).toEqual({
      error: `vault name "Trial-Vault" is already ${elsewhere} in the kiln file; choose another with --name`,
    });
  });

  it('keeps to the names recordVault accepts, and reads recorded paths as the resolver does', () => {
    const t = testVault();
    const w = { platform: process.platform, home: t.root };
    expect(vaultName(join(t.root, '.hidden notes'), undefined, w)).toEqual({ name: 'hidden-notes', recorded: false });
    expect(vaultName(t.vault, undefined, w, 'D:\\notes')).toEqual({
      error: 'vault names use letters, digits, ".", "-" and "_": "D:\\notes"',
    });
    // A relative recorded path matches nothing; "~/" is the home folder.
    expect(vaultName(t.vault, { vaults: { rel: 'Trial Vault', mine: '~/Trial Vault' } }, w)).toEqual({
      name: 'mine',
      recorded: true,
    });
  });

  it('the permission rules match Claude Code paths', () => {
    expect(permissionRules('D:\\notes', 'win32')).toEqual({
      additionalDirectories: ['D:\\notes'],
      ask: ['Edit(//d/notes/.obsidian/**)', 'Edit(//d/notes/_kiln/**)'],
    });
    expect(permissionRules('/home/sam/notes/', 'linux').ask).toEqual([
      'Edit(//home/sam/notes/.obsidian/**)',
      'Edit(//home/sam/notes/_kiln/**)',
    ]);
  });
});

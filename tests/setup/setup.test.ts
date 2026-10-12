import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
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

  it('a settings file of a shape the merge can’t use, named', () => {
    const t = testVault();
    t.write('.obsidian/community-plugins.json', '{ "quickadd": true }');
    expect(planSetup(t.options()).stop).toEqual([
      '.obsidian/community-plugins.json: expected a JSON list; fix or remove it, then run setup again',
    ]);
  });

  it('a broken record, named', () => {
    const t = testVault();
    t.write('.kiln/blueprint.json', '{ "plugin": ');
    expect(planSetup(t.options()).stop[0]).toMatch(
      /^\.kiln\/blueprint\.json: not valid JSON: .*; fix or remove it, then run setup again$/,
    );
  });
});

describe('what only warns', () => {
  it('a --take that matches nothing', () => {
    expect(planSetup(testVault().options({ take: ['Nope.md'] })).warnings).toContain('--take Nope.md matched nothing');
  });

  it("a kiln file that can't be read: setup goes ahead, and doesn't record the vault", async () => {
    const t = testVault();
    t.write('../kiln-home/config.json', '{ "vaults": ');
    const report = await applySetup(t.options());
    expect(report.applied).toBe(true);
    expect(report.kiln).toMatchObject({ name: 'Trial-Vault', recorded: 'skipped', default: null });
    expect(report.warnings.find((w) => w.startsWith("can't record the vault:"))).toMatch(/not valid JSON/);
    expect(readFileSync(t.configFile, 'utf8')).toBe('{ "vaults": ');
  });

  it("a kiln file that can't be written: setup goes ahead, and says so", async () => {
    const t = testVault();
    // recordVault writes config.json.tmp first; a folder there makes the write fail.
    mkdirSync(`${t.configFile}.tmp`, { recursive: true });
    const report = await applySetup(t.options());
    expect(report.applied).toBe(true);
    expect(report.kiln).toMatchObject({ recorded: 'skipped', default: null });
    expect(report.warnings.some((w) => w.startsWith("can't record the vault:"))).toBe(true);
    expect(existsSync(t.configFile)).toBe(false);
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

    // The first apply backed up the settings files it changed at 09-30-00, so this run's backups go to -2.
    const taken = await applySetup(t.options({ take: ['Home.md'] }));
    expect(taken.files).toContainEqual({
      path: 'Home.md',
      action: 'replace',
      backup: '.kiln/backup/2026-10-12T09-30-00-2/Home.md',
    });
    expect(t.read('.kiln/backup/2026-10-12T09-30-00-2/Home.md')).toBe('My own home.\n');
    expect(t.read('Home.md')).toBe(readFileSync(join(PLUGIN_ROOT, 'blueprint', 'root', 'Home.md'), 'utf8'));
  });
});

describe('backups', () => {
  it('copies every settings file it rewrites, byte for byte, before writing', async () => {
    const t = testVault();
    const own = '{\r\n    "showInlineTitle": false,\r\n    "mine": 1\r\n}\r\n';
    t.write('.obsidian/app.json', own);
    const report = await applySetup(t.options());
    const backup = '.kiln/backup/2026-10-12T09-30-00/.obsidian/app.json';
    expect(report.backups).toContain(backup);
    expect(readFileSync(join(t.vault, ...backup.split('/')))).toEqual(Buffer.from(own));
    expect(t.json('.obsidian/app.json')).toMatchObject({ showInlineTitle: true, mine: 1 });
    // A file setup didn't change, or didn't find, isn't backed up.
    expect(report.backups).not.toContain('.kiln/backup/2026-10-12T09-30-00/.obsidian/daily-notes.json');
    expect(planSetup(t.options()).backups).toEqual([]);
  });

  it('never overwrites an earlier backup, even in the same second', async () => {
    const t = testVault();
    await applySetup(t.options({ now: new Date('2026-10-11T08:00:00Z') }));
    // With no record, setup replaces _kiln/ with the blueprint's, backing up the vault's copy.
    const replaceByHand = async (text: string) => {
      rmSync(join(t.vault, '.kiln', 'blueprint.json'));
      t.write('_kiln/types/work.md', text);
      return applySetup(t.options());
    };
    await replaceByHand('first\n');
    const second = await replaceByHand('second\n');
    expect(second.files).toContainEqual({
      path: '_kiln/types/work.md',
      action: 'replace',
      backup: '.kiln/backup/2026-10-12T09-30-00-2/_kiln/types/work.md',
    });
    expect(t.read('.kiln/backup/2026-10-12T09-30-00/_kiln/types/work.md')).toBe('first\n');
    expect(t.read('.kiln/backup/2026-10-12T09-30-00-2/_kiln/types/work.md')).toBe('second\n');
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

  it('takes a name that is also an Object property, such as constructor', () => {
    const t = testVault();
    const w = { platform: process.platform, home: t.root };
    expect(vaultName(t.vault, undefined, w, 'constructor')).toEqual({ name: 'constructor', recorded: false });
    expect(vaultName(t.vault, { vaults: {} }, w, 'toString')).toEqual({ name: 'toString', recorded: false });
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

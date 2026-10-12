import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { splitFrontmatter } from '../../src/blueprint/markdown.js';
import { USAGE } from '../../src/setup/run.js';
import { permissionRules, planSetup } from '../../src/setup/setup.js';
import { cleanupAll, PLUGIN_ROOT, testVault } from './fixture.js';

afterAll(cleanupAll);
const { body } = splitFrontmatter(readFileSync(join(PLUGIN_ROOT, 'skills', 'setup', 'SKILL.md'), 'utf8'));
const readme = readFileSync(join(PLUGIN_ROOT, 'blueprint', 'README.md'), 'utf8').replace(/\r\n/g, '\n');
const headings = [...readme.matchAll(/^## (.+)$/gm)].map((m) => m[1] ?? '');

describe('/kiln:setup', () => {
  it('runs the helper to plan and to apply', () => {
    expect(body).toContain("node '${CLAUDE_PLUGIN_ROOT}/scripts/kiln-setup.mjs' plan --vault '<vault>'");
    expect(body).toContain("node '${CLAUDE_PLUGIN_ROOT}/scripts/kiln-setup.mjs' apply --vault '<vault>'");
  });

  it('puts every value in single quotes, and says how to quote a quote in each shell', () => {
    // Values, not flags: --vault, --take and --name always take one.
    const values = [...body.matchAll(/--(?:vault|take|name) (\S+)/g)].map((m) => m[1] ?? '');
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(value, value).toMatch(/^'[^'\s]+'/);
    for (const part of ["'\\''", "''", 'Bash', 'pwsh']) expect(body, part).toContain(part);
  });

  it('uses only options the helper has', () => {
    const flags = [...new Set([...body.matchAll(/(?<![\w-])--[a-z][a-z-]*/g)].map((m) => m[0]))].filter(
      (f) => f !== '--version', // node --version
    );
    expect(flags.length).toBeGreaterThan(0);
    for (const flag of flags) expect(USAGE, flag).toContain(flag);
  });

  it('acts on fields the report really has', () => {
    const report = planSetup(testVault().options());
    for (const key of [
      'stop',
      'warnings',
      'install',
      'cli',
      'asks',
      'backups',
      'obsidian',
      'vaultOnlyTypes',
      'sample',
      'kiln',
      'permissions',
    ]) {
      expect(body, key).toContain(`\`${key}\``);
      expect(Object.keys(report), key).toContain(key);
    }
  });

  it('names README sections that exist, and runs the procedure rather than restating it', () => {
    for (const name of ['Setting up a vault', 'Adding or changing a type']) {
      expect(body).toContain(`"${name}"`);
      expect(headings).toContain(name);
    }
    for (const detail of [
      'userIgnoreFilters',
      'enabledCssSnippets',
      'folder_templates',
      'fileRules',
      'templater-obsidian/data.json',
    ]) {
      expect(body, detail).not.toContain(detail);
    }
  });

  it('asks, closes, offers and never', () => {
    for (const part of [
      'Close Vault',
      'node --version',
      '--confirm-closed',
      'Flatpak',
      'additionalDirectories',
      'Trigger Templater on new file creation',
      'only when the owner asks',
      '## Never',
    ]) {
      expect(body, part).toContain(part);
    }
  });

  it('checks Obsidian only at step 5, and says what each exit code means', () => {
    const step2 = body.slice(body.indexOf('## 2. Plan'), body.indexOf('## 3.'));
    expect(step2).toContain('deal with it at step 5');
    expect(step2).toContain('handled at step 3');
    expect(step2).toContain("carry on to step 4 with the plan's `asks`");
    expect(step2).toContain('Exit code 2 prints usage text, not JSON');
    const step5 = body.slice(body.indexOf('## 5.'), body.indexOf('## 6.'));
    for (const part of ['`mode`', '`setup`', '`reapply`', 'ask them to close it']) expect(step5, part).toContain(part);
    const step6 = body.slice(body.indexOf('## 6.'), body.indexOf('## 7.'));
    for (const part of [
      '(`kiln.recorded`)',
      'set to `new`',
      'a recorded vault keeps its name',
      '`error`',
      '`.kiln/backup/`',
    ])
      expect(step6, part).toContain(part);
    expect(step6).not.toContain('stopped before writing anything');
  });

  it('installs missing plugins through the Obsidian CLI at step 3 only, with consent, as the vault rules call it', () => {
    const step3 = body.slice(body.indexOf('## 3.'), body.indexOf('## 4.'));
    for (const part of [
      '`install`',
      '`install.vault`',
      '`install.plugins`',
      '`cli` is `null`',
      'restricted mode',
      'Run nothing until the owner says yes',
      // The CLI was seen not to start Obsidian on Windows: the owner opens it, and nothing is written by hand.
      'open the vault in Obsidian and keep it open',
      'run the command again',
      // What the CLI prints when Obsidian is closed (seen on Windows with Obsidian 1.14.4).
      '"The CLI is unable to find Obsidian" means Obsidian isn\'t running, not that a plugin is missing',
      'Never write plugin files yourself',
      'obsidian.com',
      'Calling the Obsidian CLI',
      'Check for updates',
      'plan again',
    ]) {
      expect(step3, part).toContain(part);
    }
    // Every CLI call in the skill is in step 3, and names the vault first with a single-quoted value.
    const calls = [...body.matchAll(/^\s*(obsidian .*)$/gm)].map((m) => m[1]);
    expect(calls).toEqual([
      "obsidian vault='<install.vault>' plugins:restrict off",
      "obsidian vault='<install.vault>' plugin:install id='<id>' enable",
      "obsidian vault='<install.vault>' plugins filter=community versions",
    ]);
    for (const call of calls) expect(step3).toContain(call);
    const never = body.slice(body.indexOf('## Never'));
    expect(never).toContain('Call the Obsidian CLI anywhere but step 3');
  });

  it('keeps the Never list true without Node, and offers the permission rules by hand', () => {
    const never = body.slice(body.indexOf('## Never'));
    expect(never).toContain('With Node, write to the vault yourself');
    const step7 = body.slice(body.indexOf('## 7.'), body.indexOf('## 8.'));
    const template = ['Edit(<rule path>/.obsidian/**)', 'Edit(<rule path>/_kiln/**)'];
    for (const part of ['only entries not already there', 'Without Node there is no plan', ...template]) {
      expect(step7, part).toContain(part);
    }
    // The examples, filled into the template, are what the helper writes.
    for (const [vault, platform, rulePath] of [
      ['D:\\notes', 'win32', '//d/notes'],
      ['/home/me/notes', 'linux', '//home/me/notes'],
    ] as const) {
      expect(step7, rulePath).toContain(`\`${rulePath}\``);
      expect(step7, vault).toContain(`\`${vault}\``);
      expect(permissionRules(vault, platform).ask).toEqual(template.map((t) => t.replace('<rule path>', rulePath)));
    }
  });
});

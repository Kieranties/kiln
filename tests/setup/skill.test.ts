import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { splitFrontmatter } from '../../src/blueprint/markdown.js';
import { USAGE } from '../../src/setup/run.js';
import { planSetup } from '../../src/setup/setup.js';
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
      // node --version, and winget's flags for installing Node.
      (f) => !['--version', '--id', '--exact'].includes(f),
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
      'restricted mode',
      // Claudian is the one plugin Obsidian staff haven't reviewed, and it runs Claude Code in the vault.
      "When `realclaudian` is in the list, also say that Claudian is the one plugin Obsidian staff haven't reviewed",
      'Run nothing until the owner says yes',
      // The CLI doesn't start Obsidian on Windows (1.14.4), and says so: open the vault by its URI and retry,
      // then ask the owner. Nothing is written by hand.
      '"The CLI is unable to find Obsidian" means Obsidian isn\'t running, not that a plugin is missing',
      '`install.uri`',
      "Start-Process '<install.uri>'",
      // explorer.exe didn't start Obsidian from Git Bash (#114); rundll32 did, from Git Bash and from WSL.
      "rundll32.exe url.dll,FileProtocolHandler '<install.uri>'",
      'WSL',
      '`WSL_DISTRO_NAME`',
      "open '<install.uri>'",
      "xdg-open '<install.uri>'",
      'judge by the retry',
      // Right after Claude opened Obsidian, the vault may still be loading: "not found" then means wait.
      '"command not found"',
      'still loading',
      'only right after you opened',
      'really is missing',
      'up to three times',
      'open the vault in Obsidian',
      'Never write plugin files yourself',
      'obsidian.com',
      'Calling the Obsidian CLI',
      'Check for updates',
      'plan again',
    ]) {
      expect(step3, part).toContain(part);
    }
    expect(body).not.toContain('explorer.exe');
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

  it('needs Node and the Obsidian CLI, with no by-hand route: it offers to install Node, and names the CLI switch', () => {
    const step1 = body.slice(body.indexOf('## 1.'), body.indexOf('## 2.'));
    for (const part of [
      'Node 24 or later',
      'run nothing until the owner says yes',
      'winget install --id OpenJS.NodeJS.LTS --exact',
      'brew install node',
      'new terminal',
    ]) {
      expect(step1, part).toContain(part);
    }
    const step2 = body.slice(body.indexOf('## 2.'), body.indexOf('## 3.'));
    expect(step2).toContain('Settings → General → Command line interface');
    expect(body).not.toMatch(/Without Node|without the CLI|Exit restricted mode/i);
    expect(body).not.toMatch(/GETTING-STARTED|TRY-THE-SAMPLE/);
    // The checks work offline; the guides on the docs site are fetched for the latest when they can be.
    const step8 = body.slice(body.indexOf('## 8.'), body.indexOf('## Never'));
    for (const part of ['works offline', 'File properties', '/kiln:check', 'Load user Claude Code settings']) {
      expect(step8, part).toContain(part);
    }
    for (const page of ['guides/getting-started', 'guides/try-the-sample']) {
      expect(step8, page).toContain(`https://kiln.kieranties.com/${page}`);
    }
    expect(body).not.toMatch(/kiln\.kieranties\.com\/[^\s]*#/);
  });

  it('keeps the Never list true, and adds only permission entries not already there', () => {
    const never = body.slice(body.indexOf('## Never'));
    expect(never).toContain('Write to the vault yourself');
    const step7 = body.slice(body.indexOf('## 7.'), body.indexOf('## 8.'));
    expect(step7).toContain('only entries not already there');
  });
});

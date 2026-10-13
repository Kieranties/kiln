import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { splitFrontmatter } from '../../src/blueprint/markdown.js';
import { obsidianUri } from '../../src/setup/setup.js';

const PLUGIN = fileURLToPath(new URL('../../claude-plugin/', import.meta.url));
const RULES = 'reference/vault-rules.md';
const read = (path: string) => readFileSync(join(PLUGIN, path), 'utf8').replace(/\r\n/g, '\n');
const SKILLS = readdirSync(join(PLUGIN, 'skills'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
const rules = read(RULES);

/** The text of the rule numbered n, from its heading to the next `## `. */
function rule(n: number): string {
  const start = rules.indexOf(`\n## ${n}. `);
  if (start < 0) throw new Error(`no rule ${n}`);
  const next = rules.indexOf('\n## ', start + 1);
  return rules.slice(start, next < 0 ? undefined : next);
}

describe('the vault rules', () => {
  it('say <plugin>, which each skill names: Claude Code fills in ${CLAUDE_PLUGIN_ROOT} only in skills', () => {
    expect(rules).not.toContain('${CLAUDE_PLUGIN_ROOT}');
    const intro = rules.slice(0, rules.indexOf('\n## 1. '));
    expect(intro).toContain("`<plugin>` is the Claude plugin's folder, which the skill named in its Follow line");
  });

  it("number the spec's six rules in order, so skills can name them", () => {
    const headings = [...rules.matchAll(/^## (\d)\. (.+)$/gm)].map((m) => `${m[1]}. ${m[2]}`);
    expect(headings.map((h) => h.slice(0, 2))).toEqual(['1.', '2.', '3.', '4.', '5.', '6.']);
    for (const [n, words] of [
      [1, 'resolver'],
      [2, 'type definition'],
      [3, 'QuickAdd'],
      [4, 'Obsidian CLI'],
      [5, '<%'],
      [6, 'kiln-check'],
    ] as const) {
      expect(headings[n - 1], String(n)).toContain(words);
    }
  });

  it('1. run the resolver, and leave the kiln file to setup', () => {
    for (const part of [
      "node '<plugin>/scripts/kiln-vault.mjs'",
      "node '<plugin>/scripts/kiln-vault.mjs' '<folder>'",
      'Exit code 2: the arguments were wrong; run it again with only the path (or none)',
      'candidates',
      'reasons',
      "isn't set up for kiln",
      '/kiln:setup',
      '~/.kiln/config.json',
    ]) {
      expect(rule(1), part).toContain(part);
    }
  });

  it("2. read the vault's own definition, not the plugin's blueprint", () => {
    for (const part of ['_kiln/types/<type>.md', '_kiln/properties.md', '_kiln/README.md']) {
      expect(rule(2), part).toContain(part);
    }
    // Leave alone what only setup changes, and the vault's .claude/, which kiln never writes.
    for (const part of ['`_kiln/`', '`.obsidian/`', '`.claude/`']) expect(rule(2), part).toContain(part);
  });

  it('3. look before creating, then create through QuickAdd', () => {
    const text = rule(3);
    // "check the file", not the heading's "checking the file": the step itself must come first.
    const look = text.indexOf("check the file doesn't exist");
    expect(look).toBeGreaterThan(0);
    // The name is made linkable first, so the check and the var use the same name.
    for (const part of ['`naming`', 'File names stay linkable']) {
      expect(text.indexOf(part), part).toBeGreaterThan(0);
      expect(text.indexOf(part), part).toBeLessThan(look);
    }
    expect(text).toContain('exactly the name from step 1');
    expect(text.indexOf("obsidian vault='<folder name>' quickadd:check")).toBeGreaterThan(look);
    const run = text.indexOf("obsidian vault='<folder name>' quickadd:run choice='");
    expect(run).toBeGreaterThan(text.indexOf("obsidian vault='<folder name>' quickadd:check"));
    // Then read the new note before editing it: a <% left in it means Templater didn't run.
    const reread = text.indexOf('Read the new note before you edit it');
    expect(reread).toBeGreaterThan(run);
    expect(text.slice(reread)).toMatch(/still holds `<%`[^.]*stop and tell the owner/);
  });

  it('5. no <% anywhere, a QuickAdd var included', () => {
    for (const part of ['including a QuickAdd var', '{{VALUE:', 'Templater runs'])
      expect(rule(5), part).toContain(part);
  });

  it('4. rename and move with the CLI', () => {
    for (const part of ["obsidian vault='<folder name>' rename path='", "obsidian vault='<folder name>' move path='"])
      expect(rule(4), part).toContain(part);
  });

  it('call the CLI in Git Bash and pwsh, from inside the vault or outside it, and say T2 is pending', () => {
    const start = rules.indexOf('\n## Calling the Obsidian CLI');
    expect(start).toBeGreaterThan(0);
    const section = rules.slice(start);
    for (const part of ['obsidian.com', 'pwsh']) expect(section, part).toContain(part);
    // Name the vault on every call: from a folder inside a vault the CLI may act on the active vault.
    for (const part of [
      "vault='<folder name>'",
      'active vault',
      "the last part of rule 1's `vault`",
      '_kiln/types/',
      'stop and ask the owner',
    ]) {
      expect(section, part).toContain(part);
    }
    expect(section).not.toContain('current-folder');
    const calls = [...rules.matchAll(/\bobsidian (\S+)/g)].map((m) => m[1] ?? '');
    expect(calls.length).toBeGreaterThanOrEqual(4);
    for (const call of calls) expect(call).toMatch(/^vault=/);
    // Values go in single quotes in both shells, with each shell's escape for a quote, and JSON-escaped in vars.
    for (const part of [
      'single quotes',
      "`'\\''` in Bash",
      "`''` in pwsh",
      'JSON-escape',
      'pwsh 7.3 or later',
      // The examples the report shows working, in each shell, with a quote and a $.
      `vars='{"title":"Bob'\\''s \\"big\\" $5 idea"}'`,
      `vars='{"title":"Bob''s \\"big\\" $5 idea"}'`,
    ]) {
      expect(section, part).toContain(part);
    }
    // The intro, before rule 1, says T2 is pending and sends the reader to the section.
    const intro = rules.slice(0, rules.indexOf('\n## 1. '));
    for (const part of ['T2', 'Calling the Obsidian CLI']) expect(intro, part).toContain(part);
  });

  it('open a closed Obsidian by the vault link and retry while it loads, in every shell (#114)', () => {
    const section = rules.slice(rules.indexOf('\n## Calling the Obsidian CLI'));
    for (const part of [
      'unable to find Obsidian',
      // The link, encoded as setup's helper encodes it, with an example that needs the encoding.
      'obsidian://open?vault=<encoded name>',
      `\`${obsidianUri("Bob's notes")}\``,
      // The open command per shell and OS: rundll32 from Git Bash and WSL, never explorer.exe.
      "Start-Process '<link>'",
      "rundll32.exe url.dll,FileProtocolHandler '<link>'",
      '`WSL_DISTRO_NAME`',
      "open '<link>'",
      "xdg-open '<link>'",
      'judge by the retry',
      // "not found" means still loading only right after Claude opened Obsidian.
      '"command not found"',
      'still loading',
      'only right after you opened',
      'really is missing',
      'up to three times',
      'ask the owner to open the vault in Obsidian',
    ]) {
      expect(section, part).toContain(part);
    }
    expect(rules).not.toContain('explorer.exe');
    // The intro's "stop if a call fails" leaves the closed and loading cases to the section.
    const intro = rules.slice(0, rules.indexOf('\n## 1. '));
    expect(intro).toContain('still loading');
  });

  it('6. check what the flow touched, by full path, with --new for what it created', () => {
    for (const part of [
      "node '<plugin>/scripts/kiln-check.mjs' '<note>'",
      "node '<plugin>/scripts/kiln-check.mjs' --new '<new note>'",
      '<vault>/<note path>',
      // --today lists other notes too: writes stay targeted.
      "--today '<vault>'",
      'fix only the notes this flow touched, and report the rest',
    ]) {
      expect(rule(6), part).toContain(part);
    }
  });
});

describe('commands in the rules and the skills', () => {
  it('put every value in single quotes; only the JSON in vars holds double quotes', () => {
    const docs = [RULES, ...SKILLS.map((s) => `skills/${s}/SKILL.md`)];
    const commands: string[] = [];
    for (const doc of docs) {
      const text = read(doc);
      for (const [, block = ''] of text.matchAll(/```\n([\s\S]*?)```/g)) commands.push(...block.trim().split('\n'));
      for (const [, span = ''] of text.matchAll(/`((?:node|obsidian|--today) [^`]+)`/g)) commands.push(span);
    }
    expect(commands.length).toBeGreaterThanOrEqual(10);
    const doubled = commands.filter((c) => c.replace(/vars='[^']*'/g, '').includes('"'));
    expect(doubled).toEqual([]);
  });
});

describe('plugin files named by the rules and the skills', () => {
  it('all exist', () => {
    const docs = [RULES, ...SKILLS.map((s) => `skills/${s}/SKILL.md`)];
    const named: string[] = [];
    const missing: string[] = [];
    for (const doc of docs) {
      for (const [, path = ''] of read(doc).matchAll(/(?:\$\{CLAUDE_PLUGIN_ROOT\}|<plugin>)\/([^\s"'`)]+)/g)) {
        named.push(`${doc}: ${path}`);
        if (!existsSync(join(PLUGIN, path))) missing.push(`${doc}: ${path}`);
      }
    }
    expect(missing).toEqual([]);
    // The rules name their scripts as <plugin>/..., so this check reaches them too.
    for (const script of ['kiln-vault.mjs', 'kiln-check.mjs']) expect(named).toContain(`${RULES}: scripts/${script}`);
  });
});

const FOLLOW = 'Follow `${CLAUDE_PLUGIN_ROOT}/reference/vault-rules.md`, where `<plugin>` is `${CLAUDE_PLUGIN_ROOT}`.';

describe('every skill', () => {
  it('includes /kiln:check', () => {
    expect(SKILLS).toContain('check');
  });

  it.each(SKILLS)('%s follows the vault rules', (skill) => {
    expect(read(`skills/${skill}/SKILL.md`).split('\n')).toContain(FOLLOW);
  });

  it.each(SKILLS)('%s is a short verb with a description that keeps to kiln work', (skill) => {
    const meta = parse(splitFrontmatter(read(`skills/${skill}/SKILL.md`)).frontmatter) as Record<string, unknown>;
    expect(meta.name).toBe(skill);
    expect(skill).toMatch(/^[a-z]{3,12}$/);
    expect(typeof meta.description).toBe('string');
    const description = String(meta.description);
    expect(description).toMatch(/\bkiln\b/);
    expect(description.length).toBeLessThanOrEqual(300);
  });
});

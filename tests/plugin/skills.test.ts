import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
      'node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-vault.mjs"',
      'node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-vault.mjs" "<folder>"',
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
  });

  it('3. look before creating, then create through QuickAdd', () => {
    const text = rule(3);
    // "check the file", not the heading's "checking the file": the step itself must come first.
    const look = text.indexOf("check the file doesn't exist");
    expect(look).toBeGreaterThan(0);
    expect(text.indexOf('obsidian quickadd:check')).toBeGreaterThan(look);
    expect(text.indexOf('obsidian quickadd:run choice="')).toBeGreaterThan(text.indexOf('obsidian quickadd:check'));
  });

  it('4. rename and move with the CLI', () => {
    for (const part of ['obsidian rename path="', 'obsidian move path="']) expect(rule(4), part).toContain(part);
  });

  it('call the CLI in Git Bash and pwsh, from inside the vault or outside it, and say T2 is pending', () => {
    for (const part of ['obsidian.com', 'pwsh', 'vault="', 'current-folder', 'T2']) expect(rules, part).toContain(part);
  });

  it('6. check what the flow touched, by full path, with --new for what it created', () => {
    for (const part of [
      'node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" "<note>"',
      'node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" --new "<new note>"',
      '<vault>/<note path>',
    ]) {
      expect(rule(6), part).toContain(part);
    }
  });
});

describe('plugin files named by the rules and the skills', () => {
  it('all exist', () => {
    const docs = [RULES, ...SKILLS.map((s) => `skills/${s}/SKILL.md`)];
    const missing: string[] = [];
    for (const doc of docs) {
      for (const [, path = ''] of read(doc).matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s"'`)]+)/g)) {
        if (!existsSync(join(PLUGIN, path))) missing.push(`${doc}: ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

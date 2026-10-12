# Plugin Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One user-scope install gives every Claude Code session, Claudian included, kiln's skills, and every kiln skill follows one set of vault rules. The README says how to install, update, turn off and extend the plugin.

**Architecture:** The plugin gains `claude-plugin/reference/vault-rules.md`: six numbered rules written for Claude, with the exact commands to run. It is not a skill. Each skill's `SKILL.md` says `Follow ${CLAUDE_PLUGIN_ROOT}/reference/vault-rules.md`, and `/kiln:check` drops its own copy of the resolver steps in favour of rule 1. `tests/plugin/skills.test.ts` checks the rules and every skill generically, so later skills (`/kiln:setup` in #72, then each flow's) are held to the same rules without new tests. The README's plugin section covers install, update, auto-update, turning the plugin off in one repo, and the companion Obsidian skills. No code.

**Tech Stack:** Markdown, vitest, `yaml`. Node 24, TypeScript 7 ESM for the tests.

**Spec:** [docs/specs/2026-10-11-plugin-install-design.md](../specs/2026-10-11-plugin-install-design.md), for #82. The rules state what [vault access](../specs/2026-10-11-vault-access-design.md) (#80), [finding the vault](../specs/2026-10-11-finding-the-vault-design.md) (#81) and the [note check](../specs/2026-10-11-note-check-design.md) (#83) decided.

**Revised against the #83 and #81 code.** This plan was drafted before #83 and #81 were built, then checked against the built #81 branch. What changed:
- Rule 1 says what `candidates` hold (`path`, and `name` when the kiln file records the vault), because the resolver prints objects, not paths.
- Rule 3 passes every `{{VALUE:<name>}}` the choice uses, in its file name format or its format: the blueprint's `kiln-log` choice is a Capture choice whose value is in `format`, not `fileNameFormat`. The blueprint's `kiln-capture` choice still has `fileExistsBehavior: prompt` (until #72 generates per-kind choices), so the look-before-create step is load-bearing; the rule 3 test now pins the step's own words, not the heading's.
- Rule 6 says to pass full note paths: `kiln-check.mjs` resolves a path against the current folder, so a vault-relative path (as rule 4 uses) fails outside the vault.
- "Calling the Obsidian CLI" ties naming the vault to rule 1's output: name it unless `source` is `current-folder`, and by the last part of `vault` (the Obsidian name), not the kiln file's `name`.
- Task 1 Step 4 drops the oxlint hedge: `tests/check/skill.test.ts` already puts `${CLAUDE_PLUGIN_ROOT}` in single-quoted strings, and lint passes.
- Task 2 Step 3 names the exact range to replace in `/kiln:check` step 1, and keeps its first paragraph word for word.
- Task 3 keeps the README's one-line description of `/kiln:check`, which #83 added. The Update step tells the owner to run `/kiln:setup`, which re-applies the blueprint once #72 lands ([vault setup](../specs/2026-10-11-vault-setup-design.md), "Re-applying the blueprint"); "ask Claude to re-apply the blueprint with `/kiln:setup`" read as if the owner had to ask twice. "Not in this plan" says what #72 must keep true.
- Test counts: the suite starts at 197 passed, 1 skipped. Task 1 adds 8 tests (205), Task 2 adds 3 and replaces 1 (208), Task 3 adds 4 (212 passed, 1 skipped).

**Starts from:** the #81 branch, which builds on #83 and #105. In place there:
- `claude-plugin/` is the plugin, with `.claude-plugin/plugin.json` (no version), `blueprint/`, `scripts/kiln-check.mjs`, `scripts/kiln-vault.mjs` and `skills/check/SKILL.md`, and no `reference/` folder yet. `.claude-plugin/marketplace.json` is the catalog (marketplace `kiln`, one plugin `kiln` from `./claude-plugin`).
- `node kiln-vault.mjs [<path>]` (`src/vault/run.ts`): at most one `<path>`, "a vault folder, or a folder or note inside one"; it is a path only, never a vault name. It tries `<path>`, then the vault holding the current folder, then `KILN_VAULT` (a name or a path), then the kiln file's `default`, then the only kiln vault in Obsidian's vault list. It prints JSON (`JSON.stringify(…, null, 2)`). Exit 0: `{ "vault": "<folder>", "source": "explicit" | "current-folder" | "KILN_VAULT" | "default" | "obsidian", "name"?: "<name in the kiln file>" }`. Exit 1: `{ "vault": null, "candidates": [{ "path", "name"?, "from": "kiln" | "obsidian" }], "reasons": ["…"] }`. Exit 2: bad arguments; it prints the usage text, not JSON.
- `node kiln-check.mjs [--today] [--new] <note-or-folder>...` (`src/check/run.ts`): each path is resolved against the current folder and may be a note, a folder of notes, or the vault folder; each finds its own vault by walking up to `_kiln/types/`. `--today` keeps notes changed since midnight; `--new` makes `<%` and an empty body errors for every path given. It prints each note with findings, its `error` and `warn` lines, then a summary. Exit 0 no errors (there may be warnings), 1 errors, 2 bad arguments (usage text).
- `claude-plugin/skills/check/SKILL.md`: frontmatter `name: check` and a description naming kiln; `# Check kiln notes`; the intro paragraph "Checks notes against the type definitions in the vault's `_kiln/types/`. The check never changes a note."; `## 1. Find the vault`, whose first paragraph is "If the owner named notes or folders to check, skip this step: the check finds their vault itself.", followed by the resolver paragraph, the two `kiln-vault.mjs` commands and a paragraph on exit codes, `reasons`, `candidates`, `/kiln:setup` and `~/.kiln/config.json`; then `## 2. Run the check` (the whole vault, `--today`, the exit codes and the without-Node fallback), `## 3. Report, then offer fixes` and `## The rules` (a table).
- `tests/check/skill.test.ts` reads the skill's `body` and `meta` through `splitFrontmatter` and `yaml`'s `parse`, with `PLUGIN` (trailing `/`) and `existsSync` in scope. It has four tests; the last, `finds the vault with the resolver, and leaves the kiln file to setup`, came from #81 and checks both `kiln-vault.mjs` commands, the four words, that `The vault resolver replaces this step` is gone, and that `scripts/kiln-vault.mjs` exists. Its strings hold `${CLAUDE_PLUGIN_ROOT}` in single quotes, and oxlint passes.
- `src/blueprint/markdown.ts` exports `splitFrontmatter(text: string): { frontmatter: string; body: string }`.
- `tests/plugin/layout.test.ts` has `REPO` (the repo root), `PLUGIN` (`join(REPO, 'claude-plugin')`), `catalog` (typed `{ name; owner; plugins: { name; source }[] }`), `manifest`, `readFileSync` and `join` in scope. Its `the living docs` block has a `LIVING` list (`README.md`, `CLAUDE.md`, `docs/vision.md`, the layer 1 design, `tests/fixtures/README.md`, then every `.md` in `claude-plugin/blueprint/`) whose relative Markdown links must resolve and which must name no `kit/` path.
- `README.md` has `### The Claude plugin` under `## Get started`: one sentence, the two install commands, and a paragraph naming `/kiln:check` and how to try a branch. "What's in the repo" has rows for `claude-plugin/blueprint/`, `claude-plugin/skills/` ("one folder each: `check`"), `claude-plugin/scripts/` and `tests/plugin/` ("Checks the catalog, the plugin manifest and folder, the release zip, and the living docs' links").
- `claude-plugin/blueprint/README.md` (copied to the vault's `_kiln/README.md` by setup) has a `## Conventions` section, which rule 2 points at. It already says "No title heading" and "Relationships are always lists of links, even with one entry: `projects: ["[[Season Ticket Renewals 2027]]"]`", and how Claude finds the vault. This plan doesn't change it.
- The blueprint's QuickAdd settings (`settings/plugins/quickadd.json`) hold two choices: `kiln-capture` ("Capture to inbox", a Template choice, file name `{{DATE:YYYY-MM-DD}} {{VALUE:Capture}}`, `fileExistsBehavior: prompt`) and `kiln-log` ("Log to daily", a Capture choice, `{{VALUE:Log}}` in its `format`).
- Prettier ignores `*.md`, so `npm run format` only touches the tests. `npm run build:check` exists and is in CI and in the "Before pushing" lists of `README.md` and `CLAUDE.md`. `.gitattributes` checks every file out with LF.

## Global Constraints

- **Public repo.** Nothing committed may contain employer or client names, private links, or real local paths of any machine. Paths in docs are examples such as `D:\notes`; test data is the fictional Northwind Arena.
- **One user-scope plugin.** The install is `claude plugin marketplace add Kieranties/kiln`, then `claude plugin install kiln@kiln` (user scope is the default). kiln never writes to a vault's `.claude/`, and nothing tells the owner to enable kiln in a vault's settings.
- **The six vault rules** (copied from the spec), in this order:
  1. Find the vault with the resolver.
  2. Read the note's type definition before changing it.
  3. Create notes through QuickAdd, after checking the file doesn't exist.
  4. Rename and move through the Obsidian CLI.
  5. Never write `<%`.
  6. Run `kiln-check` on the notes the flow touched, then fix or report what fails.
- **Obsidian CLI** (vault access): Git Bash calls `obsidian.com`, because bare `obsidian` there starts the app; pwsh calls `obsidian`. Notes are created with `obsidian quickadd:run choice="..." vars='{...}'` after `obsidian quickadd:check`. These parts wait on trial T2 (#80), and the rules say so.
- **Every command in docs and skills works in both Bash and pwsh,** or both forms are given.
- **Skill names are short verbs** (`check`, `setup`, later `capture`, `triage`). **Descriptions are at most 300 characters and name kiln,** so they trigger only on kiln work in every session, code repos included.
- **Not in scope:** an auto-update hook, readable versions, the setup skill and `GETTING-STARTED.md` (#72).
- Docs: plain British English, short sentences. The design notes and dated plans stay as written; README, the plugin's files and the skills are living docs.
- Code and text blocks in this plan aren't Prettier-formatted: run `npm run format` before each commit.
- Commits stage files by explicit path (never `git add -A` or `git add .`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before pushing: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build:check`.
- Never install the plugin into your own Claude Code config. Validate with `claude plugin validate .`; the only install trial (Task 3) runs in a throwaway `CLAUDE_CONFIG_DIR`.

## Decisions this plan makes

Record these in the PR description; they are exploratory.

1. **The rules own how to find the vault.** `/kiln:check` step 1 points at rule 1 instead of repeating the resolver steps, so one file says how to run it and what to do with no vault.
2. **The rules name the QuickAdd choice by reading the vault's QuickAdd settings** (ids starting `kiln-`), not by a fixed list: #72 generates one choice per kind, and their names aren't fixed yet.
3. **Outside the vault, CLI calls start with `vault="<vault folder name>"`.** The Obsidian CLI otherwise acts on the vault the current folder is in, which a session in a repo has none of. Pending T2, like the rest of rules 3 and 4.
4. **Two conventions are restated in the rules,** no title heading and relationships as lists of links, because the vault access design says kiln's skills hold them. The rules point at the vault's `_kiln/README.md` "Conventions" for the rest rather than copying it.
5. **`_kiln/` and `.obsidian/` belong to `/kiln:setup`.** Other skills read them and never change them; setup is also the one skill that writes notes as files (the sample, with Obsidian closed).
6. **Turning the plugin off in one repo** is `claude plugin disable kiln@kiln --scope local`, which writes `"kiln@kiln": false` to that repo's `.claude/settings.local.json`. A local setting overrides the user one, only for that repo and only for the owner. Checked against the Claude Code plugin docs (2026-10-12).
7. **The companion plugin is `obsidian@obsidian-skills`.** Checked against kepano/obsidian-skills' `.claude-plugin/marketplace.json` (2026-10-12): marketplace `obsidian-skills`, one plugin `obsidian`, which holds `obsidian-cli` and `obsidian-markdown` among others.
8. **The plugin's description and keywords stay as they are.** They already say what the plugin is.

## Review Focus

1. **A session that isn't in the vault** (a terminal in a repo). The CLI then has no vault to act on, so rule 3 and 4 commands must name it with `vault=`. Pinned in Task 1.
2. **Git Bash on Windows,** where `obsidian` starts the app instead of running the command. The rules must say `obsidian.com`. Pinned in Task 1.
3. **A QuickAdd run over an existing note,** which could hang or overwrite. The existence check must come before the run in rule 3. Pinned in Task 1.
4. **A later skill** (`/kiln:setup`, then each flow's) that forgets the rules, grows a long description, or names a plugin file that doesn't exist yet. Every skill is checked generically. Pinned in Task 2.
5. **A repo where kiln's skills are noise.** Turning the plugin off there must not turn it off anywhere else, and the commands must use the catalog's names. Pinned in Task 3 (test and install trial).

---

## File structure

| File | Responsibility |
|---|---|
| `claude-plugin/reference/vault-rules.md` | The six rules every kiln skill follows in a vault |
| `claude-plugin/skills/check/SKILL.md` | Follows the rules; step 1 points at rule 1 |
| `tests/plugin/skills.test.ts` | The rules, every skill, and every `${CLAUDE_PLUGIN_ROOT}` path they name |
| `tests/check/skill.test.ts` | #81's resolver test becomes "step 1 uses rule 1" |
| `tests/plugin/layout.test.ts` | The README's plugin commands; the rules join the living docs |
| `README.md` | Install, update, auto-update, turning off, companion skills, Claudian |

---

### Task 1: The vault rules

**Files:**
- Create: `claude-plugin/reference/vault-rules.md`
- Modify: `tests/plugin/layout.test.ts` (the `LIVING` list only)
- Test: `tests/plugin/skills.test.ts`

**Interfaces:**
- Consumes: `kiln-vault.mjs` and `kiln-check.mjs`, their arguments, JSON and exit codes (#81, #83).
- Produces:
  - `claude-plugin/reference/vault-rules.md`, with headings `## 1.` to `## 6.` in the spec's order. Skills refer to a rule by its number ("rule 1 of the vault rules").
  - The line every skill carries: ``Follow `${CLAUDE_PLUGIN_ROOT}/reference/vault-rules.md`.`` (Task 2, and #72's setup skill).
  - In `tests/plugin/skills.test.ts`: `PLUGIN` (absolute path of `claude-plugin/` with a trailing separator), `read(path: string): string` (a plugin file's text), and `SKILLS: string[]` (the folder names under `claude-plugin/skills/`, sorted). Task 2 appends to this file.

- [ ] **Step 1: Write the failing tests** in `tests/plugin/skills.test.ts`

```ts
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
```

In `tests/plugin/layout.test.ts`, add `'claude-plugin/reference/vault-rules.md'` to `LIVING`, after `'tests/fixtures/README.md'`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/plugin`
Expected: FAIL. `skills.test.ts` fails to load with `ENOENT` for `reference/vault-rules.md`, and `the living docs link only to files that exist` and `name no kit/ path` fail with the same `ENOENT`.

- [ ] **Step 3: Write `claude-plugin/reference/vault-rules.md`**

````markdown
# kiln vault rules

Every kiln skill follows these rules whenever it reads or changes notes in a kiln vault. Nobody runs this file; skills point at it. Commands are the same in Bash and pwsh unless a rule says otherwise. `<vault>` is the vault folder from rule 1.

Rules 3 and 4 use the Obsidian CLI and QuickAdd, which wait on trial T2 (https://github.com/Kieranties/kiln/issues/80), so their commands may change. If one fails, stop and tell the owner what failed. Never fall back to writing a new note as a file or renaming on disk.

## 1. Find the vault with the resolver

Run it the first time the flow needs the vault. Pass a folder only if the owner named one:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-vault.mjs"
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-vault.mjs" "<folder>"
```

It prints JSON. Exit code 0: `vault` is the vault folder, and `source` says how it was found. Exit code 1: no vault was found. Tell the owner the `reasons`, list the `candidates` (each a `path`, with a `name` if the owner recorded one), and ask which vault to use. Offer to record the answer with `/kiln:setup`, the only writer of `~/.kiln/config.json`; never edit that file yourself.

Without Node 24 (`node --version`), use the current folder if it or a folder above it holds `_kiln/types/`. Otherwise ask the owner.

## 2. Read the type definition before changing a note

Before you write to a note, read `<vault>/_kiln/types/<type>.md` for its `type`, and `<vault>/_kiln/properties.md` before you add a property. They give the folder, naming, kinds, statuses, properties and sections. Use the vault's copies, not the plugin's blueprint: the vault may have types of its own.

Keep to the conventions in `<vault>/_kiln/README.md`, "Conventions". The ones most often missed:

- No title heading. The file name is the title.
- Relationships are always lists of links, even with one entry: `projects: ["[[Season Ticket Renewals 2027]]"]`.
- Change only the properties and sections you mean to.
- Archive, never delete: retire a note through its `status`.
- Leave `_kiln/` and `.obsidian/` alone. Only `/kiln:setup` changes them.

## 3. Create notes through QuickAdd, after checking the file doesn't exist

Never create a note by writing a new file. With Templater's trigger on, Obsidian runs any `<%` in a new file, and merges the template over a file with only properties. (`/kiln:setup` is the one exception: it writes with Obsidian closed.)

1. Work out the note's path from its definition (`folder` and `naming`) and check the file doesn't exist. If it does, use that note, or ask the owner.
2. Run `obsidian quickadd:check`.
3. Find the choice for the type and kind: kiln's choices have ids starting `kiln-` in `<vault>/.obsidian/plugins/quickadd/data.json`. Read that file; don't change it. Pass each `{{VALUE:<name>}}` the choice uses, in its file name format or its format, as a var:

   ```
   obsidian quickadd:run choice="<choice name>" vars='{"<name>":"<value>"}'
   ```

4. Fill in the new note's properties and body as edits to its file, by rule 2.

## 4. Rename and move through the Obsidian CLI

Obsidian then rewrites every link to the note. A rename on disk breaks them. Paths are relative to the vault, with `/`:

```
obsidian rename path="<note path>" name="<new name>"
obsidian move path="<note path>" to="<folder>/"
```

## 5. Never write `<%`

Not in a new note, an existing note or captured text: Templater runs it as code. If text you are saving contains `<%`, leave that part out and tell the owner.

## 6. Run kiln-check on the notes the flow touched

At the end of the flow, check every note it changed. Check the notes it created in a separate run with `--new`. Pass each note's full path, `<vault>/<note path>`: the check reads a shorter path from the current folder.

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" "<note>" "<note>"
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" --new "<new note>"
```

A flow that touched much of the day's work may check `--today "<vault>"` instead. Exit code 0: no errors; report any warnings. Exit code 1: fix each error by these rules (move a note by rule 4), run the check again, and report what you couldn't fix. Without Node 24, check each note against its definition, as `/kiln:check` describes.

## Calling the Obsidian CLI

- In Git Bash, call `obsidian.com`: bare `obsidian` there starts the app. In pwsh, and on macOS and Linux, call `obsidian`.
- Unless rule 1's `source` was `current-folder`, name the vault first: the current folder may not be inside it. Use its folder name, the last part of `vault` (not the `name` in the kiln file): for `D:\notes`, `obsidian vault="notes" quickadd:check`.
- The CLI needs Obsidian running. The first command starts it.
````

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/plugin && npm run typecheck && npm run lint`
Expected: PASS, 8 new tests. The `'${CLAUDE_PLUGIN_ROOT}'` strings need no lint exception: `tests/check/skill.test.ts` has the same strings and lint passes.

Run: `npm test`
Expected: 205 passed, 1 skipped.

- [ ] **Step 5: Commit**

```bash
npm run format
git add claude-plugin/reference/vault-rules.md tests/plugin/skills.test.ts tests/plugin/layout.test.ts
git commit -m "feat(plugin): the vault rules every kiln skill follows" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Skills follow the rules

**Files:**
- Modify: `claude-plugin/skills/check/SKILL.md` (the intro and step 1 only), `tests/check/skill.test.ts` (#81's resolver test only)
- Test: `tests/plugin/skills.test.ts`

**Interfaces:**
- Consumes: `PLUGIN`, `read`, `SKILLS` (Task 1); `splitFrontmatter` from `src/blueprint/markdown.ts` (#83); rule 1 (Task 1).
- Produces: the checks every later skill must pass: it follows the rules, its `name` is its folder name and a short lower-case verb, and its description names kiln in at most 300 characters. #72's `skills/setup/SKILL.md` must carry the Follow line.

- [ ] **Step 1: Write the failing tests**

Append to `tests/plugin/skills.test.ts` (add `import { parse } from 'yaml';` and `import { splitFrontmatter } from '../../src/blueprint/markdown.js';`):

```ts
const FOLLOW = 'Follow `${CLAUDE_PLUGIN_ROOT}/reference/vault-rules.md`.';

describe('every skill', () => {
  it('includes /kiln:check', () => {
    expect(SKILLS).toContain('check');
  });

  it.each(SKILLS)('%s follows the vault rules', (skill) => {
    expect(read(`skills/${skill}/SKILL.md`)).toContain(FOLLOW);
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
```

In `tests/check/skill.test.ts`, replace the test `finds the vault with the resolver, and leaves the kiln file to setup` with:

```ts
  it('finds the vault by rule 1 of the vault rules, which say how to run the resolver', () => {
    const step = body.slice(body.indexOf('## 1. Find the vault'), body.indexOf('## 2.'));
    expect(step).toContain('rule 1 of the vault rules');
    expect(step).not.toContain('kiln-vault.mjs');
  });
```

(`tests/plugin/skills.test.ts` now checks the resolver commands in rule 1, and that `kiln-vault.mjs` exists.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/plugin/skills.test.ts tests/check/skill.test.ts`
Expected: FAIL: `check follows the vault rules`, and `finds the vault by rule 1 of the vault rules, ...` (step 1 lacks `rule 1 of the vault rules` and still holds `kiln-vault.mjs`). The other two new tests pass.

- [ ] **Step 3: Edit `claude-plugin/skills/check/SKILL.md`**

After the intro paragraph under `# Check kiln notes` ("Checks notes against the type definitions in the vault's `_kiln/types/`. The check never changes a note."), add a paragraph:

```markdown
Follow `${CLAUDE_PLUGIN_ROOT}/reference/vault-rules.md`.
```

Replace everything from `## 1. Find the vault` up to (not including) `## 2. Run the check`, that is the skip paragraph, the resolver paragraph, the two `kiln-vault.mjs` commands and the paragraph on exit codes, with:

```markdown
## 1. Find the vault

If the owner named notes or folders to check, skip this step: the check finds their vault itself. Otherwise find the vault by rule 1 of the vault rules.
```

Leave steps 2 and 3, the rules table and the frontmatter as they are. Step 3 already says to move and rename through the Obsidian CLI and never to write `<%`, which `falls back to reading the definitions without Node, ...` checks.

- [ ] **Step 4: Run all tests, and validate the plugin**

Run: `npm run format && npm test && npm run typecheck && npm run lint`
Expected: PASS, 208 passed, 1 skipped.

Run: `claude plugin validate .`
Expected: `✔ Validation passed with warnings`, the only warning the expected no-version one.

- [ ] **Step 5: Commit**

```bash
git add claude-plugin/skills/check/SKILL.md tests/plugin/skills.test.ts tests/check/skill.test.ts
git commit -m "feat(plugin): kiln skills follow the vault rules; /kiln:check finds the vault by rule 1" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Install, update and companion skills in the README

**Files:**
- Modify: `README.md` (the `### The Claude plugin` section, and two rows of "What's in the repo")
- Test: `tests/plugin/layout.test.ts`

**Interfaces:**
- Consumes: `catalog` in `tests/plugin/layout.test.ts` (#105).
- Produces: README anchors `#install`, `#update`, `#turn-it-off-in-one-repo` and `#companion-skills` under `### The Claude plugin`. #72's rewritten `GETTING-STARTED.md` links to `../../README.md#install`.

- [ ] **Step 1: Write the failing test**

Append to `tests/plugin/layout.test.ts`:

```ts
describe('the README', () => {
  const readme = readFileSync(join(REPO, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
  const commands = [...readme.matchAll(/^claude plugin .+$/gm)].map((m) => m[0].trim());
  const id = `${catalog.plugins[0]?.name}@${catalog.name}`;

  it('installs, updates and turns off kiln by the names in the catalog', () => {
    for (const command of [
      'claude plugin marketplace add Kieranties/kiln',
      `claude plugin install ${id}`,
      `claude plugin marketplace update ${catalog.name}`,
      `claude plugin update ${id}`,
      `claude plugin disable ${id} --scope local`,
    ]) {
      expect(commands, command).toContain(command);
    }
  });

  it('turns kiln off only in one repo, never at user scope', () => {
    const off = commands.filter((c) => c.startsWith(`claude plugin disable ${id}`));
    expect(off).toEqual([`claude plugin disable ${id} --scope local`]);
  });

  it('gives commands that read the same in Bash and pwsh', () => {
    // No variables, quoting, pipes, separators or backslash paths that differ between the shells.
    for (const command of commands) expect(command, command).not.toMatch(/[$`'"|;&\\]/);
  });

  it('documents the companion Obsidian skills and Claudian', () => {
    expect(commands).toContain('claude plugin install obsidian@obsidian-skills');
    expect(readme).toContain('Load user Claude Code settings');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/plugin/layout.test.ts`
Expected: FAIL: three of the four new tests, since the README has no update, disable or companion commands. `gives commands that read the same in Bash and pwsh` already passes on the two install commands.

- [ ] **Step 3: Rewrite the plugin section of `README.md`**

Replace everything from `### The Claude plugin` up to (not including) `## What's in the repo` with:

````markdown
### The Claude plugin

This repo is also a Claude Code plugin marketplace with one plugin, `kiln`. The plugin carries the blueprint, kiln's skills and the rules every kiln skill follows in a vault. So far there is one skill: `/kiln:check` checks a vault's notes, or today's changes, against their type definitions. The commands are the same in Bash and PowerShell.

#### Install

Install it once, for your user (the default), so it reaches every Claude Code session in any folder:

```
claude plugin marketplace add Kieranties/kiln
claude plugin install kiln@kiln
```

Claudian runs your own Claude Code inside Obsidian, so it loads the plugin too, as long as its **Load user Claude Code settings** switch is on (the default). Enabling kiln in a vault's `.claude/settings.json` isn't a substitute: it only turns on a plugin that is already installed, Claude Code ignores it in a folder you haven't trusted, and it reaches only that folder.

To try a branch, add the marketplace at that branch instead: `claude plugin marketplace add Kieranties/kiln#some-branch`.

#### Update

Refresh the catalog, then update the plugin:

```
claude plugin marketplace update kiln
claude plugin update kiln@kiln
```

The new version loads in your next session, or after `/reload-plugins`. Then run `/kiln:setup` to re-apply the blueprint to your vault, so the vault's types, templates, views and settings match the new version.

Auto-update is off by default for marketplaces outside Anthropic's own. You can turn it on for `kiln` in `/plugin`, under **Marketplaces**, but it only runs in interactive sessions. Claudian never auto-updates, so if you mostly use Claudian, update from a terminal now and then.

#### Turn it off in one repo

kiln's skills show in every session. In a repo where they are noise, run this in the repo:

```
claude plugin disable kiln@kiln --scope local
```

It writes `"kiln@kiln": false` to the repo's `.claude/settings.local.json`, which applies only to you and only there. `claude plugin enable kiln@kiln --scope local` turns it back on.

#### Companion skills

kepano's [Obsidian skills](https://github.com/kepano/obsidian-skills) teach Claude the Obsidian CLI (`obsidian-cli`) and Obsidian's Markdown (`obsidian-markdown`), among others. kiln's skills work without them. To add them:

```
claude plugin marketplace add kepano/obsidian-skills
claude plugin install obsidian@obsidian-skills
```

````

In "What's in the repo":
- After the `claude-plugin/blueprint/` row, add: `| `claude-plugin/reference/vault-rules.md` | The rules every kiln skill follows in a vault: find the vault, read the type definition, create through QuickAdd, rename through the Obsidian CLI, never write `<%`, check at the end |`
- In the `tests/plugin/` row, change the description to: "Checks the catalog, the plugin manifest and folder, the release zip, the vault rules and every skill, the README's plugin commands, and the living docs' links".

- [ ] **Step 4: Run all tests**

Run: `npm run format && npm test && npm run typecheck && npm run lint`
Expected: PASS, 212 passed, 1 skipped, including `the living docs link only to files that exist`.

- [ ] **Step 5: Try the README commands in a throwaway Claude Code config, in Bash and pwsh**

This proves the issue's "the install steps work in Bash and pwsh" without touching your own config. Run from the repo root. `./` adds this checkout as the marketplace, in place of `Kieranties/kiln`; every other command is as the README gives it.

Bash:

```bash
export CLAUDE_CONFIG_DIR="$(mktemp -d)"
claude plugin list
```

Expected: no plugins. **If any plugin you have installed is listed, `CLAUDE_CONFIG_DIR` isn't honoured: stop here, `unset CLAUDE_CONFIG_DIR`, and note in the PR that the trial was skipped.** Otherwise:

```bash
claude plugin marketplace add ./
claude plugin install kiln@kiln
claude plugin marketplace update kiln
claude plugin update kiln@kiln
repo="$(mktemp -d)" && (cd "$repo" && git init -q && claude plugin disable kiln@kiln --scope local && cat .claude/settings.local.json && claude plugin list)
claude plugin list
rm -rf "$repo" "$CLAUDE_CONFIG_DIR"; unset CLAUDE_CONFIG_DIR
```

Expected: `Successfully added marketplace: kiln`; `Successfully installed plugin: kiln@kiln (scope: user)`; `Successfully updated marketplace: kiln`; the update says kiln is at the latest version; in the repo, `Successfully disabled plugin: kiln (scope: local)`, `.claude/settings.local.json` holds `"kiln@kiln": false` under `enabledPlugins`, and `claude plugin list` there shows kiln disabled; outside the repo, the last `claude plugin list` shows kiln enabled.

pwsh, the same check:

```powershell
$env:CLAUDE_CONFIG_DIR = (New-Item -ItemType Directory -Path (Join-Path ([IO.Path]::GetTempPath()) "kiln-config-$(Get-Random)")).FullName
claude plugin list
claude plugin marketplace add ./
claude plugin install kiln@kiln
claude plugin marketplace update kiln
claude plugin update kiln@kiln
$repo = (New-Item -ItemType Directory -Path (Join-Path ([IO.Path]::GetTempPath()) "kiln-repo-$(Get-Random)")).FullName
Push-Location $repo; git init -q; claude plugin disable kiln@kiln --scope local; Get-Content .claude/settings.local.json; claude plugin list; Pop-Location
claude plugin list
Remove-Item -Recurse -Force $repo, $env:CLAUDE_CONFIG_DIR; Remove-Item Env:CLAUDE_CONFIG_DIR
```

Expected: as for Bash, with the same stop rule after the first `claude plugin list`. If any README command fails or prints something else, fix the README (and its test) to match what Claude Code does, and record what changed in the PR.

- [ ] **Step 6: Run everything, and validate the plugin**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build:check`
Expected: all PASS.

Run: `claude plugin validate .`
Expected: `✔ Validation passed with warnings`, the only warning the expected no-version one.

- [ ] **Step 7: Commit**

```bash
git add README.md tests/plugin/layout.test.ts
git commit -m "docs: install, update, turn off and extend the kiln plugin" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Not in this plan

- **`/kiln:setup`** and the rewrite of `claude-plugin/blueprint/GETTING-STARTED.md` (#72), which comes after this plan and owns `claude-plugin/skills/setup/`. Setup's `SKILL.md` must carry ``Follow `${CLAUDE_PLUGIN_ROOT}/reference/vault-rules.md`.``, keep its description to 300 characters naming kiln, and name only plugin files that exist; `tests/plugin/skills.test.ts` checks all three. The guide links to the README's `#install`.
- **What #72 must keep true in the README.** Until #72 lands, the README's Update step, rule 1 and `/kiln:check` (since #81) name `/kiln:setup` ahead of it. The Update step says "run `/kiln:setup` to re-apply the blueprint to your vault", so setup must re-apply when run on a vault already set up (as the vault setup design says), with no other words from the owner; then that sentence needs no change. #72 also adds `setup` to the README's "So far there is one skill" sentence and to the `claude-plugin/skills/` row of "What's in the repo".
- **QuickAdd choices per kind:** #72 generates them. Rule 3 finds them by their `kiln-` ids.
- **Trial T2** (#80), which may change the commands in rules 3 and 4.
- **A start-up self-update hook** for Claudian, and **readable versions**: the spec's open questions.

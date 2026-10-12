# Vault Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/kiln:setup` sets up a vault from the blueprint from any Claude session, with no clone: a bundled Node helper, `kiln-setup.mjs`, plans and applies the blueprint, re-applies it three-way after an update, records the vault, and loads the Northwind Arena sample on request.

**Architecture:** A new `src/setup/` holds the helper's logic as pure-ish functions over a vault folder and a plugin folder: the blueprint's install map and generated QuickAdd choices, the settings merges (one rule per fragment), the three-way file sort, the version record, the environment checks and the sample fetch. `planSetup` computes a JSON report; `applySetup` computes the same report and writes it. `src/cli/kiln-setup.ts` is the only reader of `process`; #83's esbuild script bundles it into `claude-plugin/scripts/kiln-setup.mjs`. The skill does the judgement: it shows the plan, asks about each override, checks Obsidian is closed, runs `apply`, and offers the permission settings.

**Tech Stack:** Node 24, TypeScript 7 ESM (NodeNext), `yaml`, vitest, oxlint (type-aware), Prettier, esbuild (from #83). No new dependencies.

**Spec:** [docs/specs/2026-10-11-vault-setup-design.md](../specs/2026-10-11-vault-setup-design.md), for #72. Context: [vault access](../specs/2026-10-11-vault-access-design.md), [finding the vault](../specs/2026-10-11-finding-the-vault-design.md) ("Permissions"), [plugin install](../specs/2026-10-11-plugin-install-design.md), [repo layout](../specs/2026-10-11-repo-layout-design.md). The closed first attempt, #78, supplies the skill's structure, confirmations, "never" list, the guide changes and most of its `plugin.test.ts`.

**Revised against the #83, #81 and #82 code.** This plan was drafted before #83, #81 and #82 were built, then checked against the built branch. What changed:
- **`Json` and `Choice` (Task 1).** `Choice` was `{ ...; [key: string]: unknown }`, which isn't assignable to `Json`, so Task 7 couldn't pass generated choices to the QuickAdd merge. Task 1 now creates `src/setup/json.ts` with the `Json` types only (Task 3 adds its functions), `Choice`'s index signature is `Json`, and `isChoice` narrows the blueprint's choices.
- **`installedFiles` (Task 2)** reads definitions with `readDefinitions(dir)`; `readBlueprint` also reads `properties.md`, which it doesn't need. `Definition.template` is `''` when a definition has none.
- **`usersOf` (Tasks 5 and 7):** `openVault(vault).notes` is a list of vault-relative paths, not texts, and `openVault` throws when the vault's `_kiln/` isn't a readable blueprint. Task 7 reads each note's text itself.
- **Vault names (decision 12, Task 7)** follow `recordVault`'s rule, `^[A-Za-z0-9][A-Za-z0-9._-]*$`: a folder name is cleaned to fit it (a leading `.`, `-` or `_` is dropped; nothing left gives `vault`), and a `--name` that breaks it stops setup with `recordVault`'s own message instead of failing after every other write. A recorded path matches a folder only when it is absolute after `~` is expanded, as the resolver uses it, so `SetupOptions` and `vaultName` take `home`. A `recordVault` throw at the end of apply becomes a warning.
- **A plain Obsidian vault (Task 10):** the resolver stops with "an Obsidian vault without kiln … Set it up with /kiln:setup first" when the current folder is one. The skill takes that folder as the vault to set up, after confirming.
- **The skill's description and checks (Task 10):** #82's `tests/plugin/skills.test.ts` also requires `name` to match `^[a-z]{3,12}$`, and checks every `${CLAUDE_PLUGIN_ROOT}/...` path up to a space, quote, backtick or `)`. `setup` passes; its description is 239 characters. #82's `it.each(SKILLS)` adds two tests for `setup`.
- **The repo README (Task 11):** #82 left two things to #72: the "So far there is one skill" sentence, and the `claude-plugin/skills/` row ("one folder each: `check`"). Task 11 now updates them, the `src/`, `claude-plugin/scripts/` and `tests/` rows, and adds a layout test that the README names every skill. #82's Update step ("Then run `/kiln:setup` to re-apply the blueprint") needs no change: setup re-applies when run with no other words.
- **Decision 13 kept against #82's note.** #82's plan says the guide links `../../README.md#install`; this plan keeps the absolute `https://github.com/Kieranties/kiln#install`, because the guide is copied into `_kiln/`. #105's living-docs test skips `https:` links.
- **Tests and lint (Tasks 8 and 9):** `typescript/require-await` applies to `tests/`, so the fake fetch returns `Promise.resolve(...)` rather than being an `async` function without `await`. The bundle test drops the real `HOME`, `USERPROFILE`, `KILN_HOME`, `KILN_VAULT` and `KILN_OBSIDIAN_RUNNING` by upper-cased name, as `tests/vault/bundle.test.ts` does, and checks the bundle carries `yaml`'s licence, as `tests/check/bundle.test.ts` does. The CLI passes `fetch` through an arrow function.
- **The Follow line and quoting (Task 10), from #82's final review:** every skill carries exactly ``Follow `${CLAUDE_PLUGIN_ROOT}/reference/vault-rules.md`, where `<plugin>` is `${CLAUDE_PLUGIN_ROOT}`.``, since the rules are read with the Read tool and say `<plugin>/scripts/...`. Values in the skill's shell commands are single-quoted (`'` written `'\''` in Bash, `''` in pwsh), pinned by a new skill test, and every Obsidian CLI call names the vault first (setup makes none).
- **Decision 3's wording:** `kiln-log` is a Capture choice that keeps `{{VALUE:Log}}`; "every one takes `title`" now says every Template choice.
- **Test counts.** Call the suite after #82 **N** passed, 1 skipped (#82's plan ends at 212 from 197; the branch had 200 before #82, so expect about 215). Each task gives its delta; the plan ends at N + 90.

**Starts from:** the #82 branch (on #81, on #83, on #105). In place there:
- `claude-plugin/blueprint/` is the blueprint. `src/blueprint/load.ts` exports `readDefinitions(dir): Definition[]` (sorted by file name), `readPropertyCatalogue(dir): PropertyCatalogue` (`{ shared, optional, entries }`), `readBlueprint(dir): { definitions; properties }`, `NAMINGS`, `type Naming` (`'title' | 'date' | 'date-title' | 'source-title'`) and `type Definition` (`name`, `folder`, `template` such as `Work.md` or `''`, `naming`, `icon`, `color`, `statuses`, `properties`, `kinds: Record<string, { icon?; color? }>`, `sections`, `last?`, `views`, `body`). `src/blueprint/markdown.ts` exports `splitFrontmatter(text): { frontmatter; body }` and `sectionsOf`.
- `src/check/vault.ts` exports `openVault(path, blueprintDir?): Vault`; `Vault.notes` is the sorted vault-relative `/` paths of every `.md` outside dot-folders and `_kiln/` (paths only). It throws whatever `readBlueprint(<vault>/_kiln)` throws.
- `src/vault/paths.ts` exports `type Env`, `type Where = { cwd; env; home; platform }`, `envValue`, `expandHome(path, home)`, `pathKey(path, platform)` (resolved, trailing separators dropped, lower-cased on Windows and macOS), `isFolder`, `findUp`.
- `src/vault/config.ts` exports `type KilnConfig = { default?: string; vaults: Record<string, string>; [key: string]: unknown }`, `kilnConfigPath({ env, home })` (`<home>/.kiln/config.json`, or `config.json` in `KILN_HOME`), `readKilnConfig(file): KilnConfig | undefined` (throws `not valid JSON: …`, `not a JSON object`, `vaults must be a map of names to folders` or `default must be a vault name`, without the file name), and `recordVault(file, name, path, { makeDefault?, home? }): KilnConfig`. `recordVault` throws `vault names use letters, digits, ".", "-" and "_": "<name>"` unless the name matches `^[A-Za-z0-9][A-Za-z0-9._-]*$`; refuses a folder without `_kiln/types/` (`checkVault`'s reason); throws `<file> can't be read, so it was left as it is: …` over a broken file; makes the first vault the default; and writes `JSON.stringify(config, null, 2) + '\n'` through a temporary file.
- `src/vault/find.ts` exports `findVault(path)` and `checkVault(path, { walkUp }): { ok: true; root } | { ok: false; reason; plain?: true }`; `plain` marks an Obsidian vault without kiln. `src/vault/resolve.ts` uses a recorded path only when it is absolute after `~` is expanded, and stops at a plain Obsidian vault holding the current folder.
- `scripts/build.mjs` bundles every `src/cli/*.ts` into `claude-plugin/scripts/*.mjs`, with a header and the licence of each inlined package (from esbuild's metafile); `npm run build` writes and prints `Built <names>`, `npm run build:check` compares and prints `Bundles match src/.`; CI's `check` job (Ubuntu) runs format, lint, typecheck, test and `build:check`.
- `claude-plugin/reference/vault-rules.md` (#82). `tests/plugin/skills.test.ts` checks every skill folder: its `SKILL.md` contains exactly ``Follow `${CLAUDE_PLUGIN_ROOT}/reference/vault-rules.md`, where `<plugin>` is `${CLAUDE_PLUGIN_ROOT}`.`` (after #82's final review: the rules are read with the Read tool, where `${CLAUDE_PLUGIN_ROOT}` is never substituted, so they say `<plugin>/scripts/...` and the skill line maps `<plugin>`), its `name` is its folder name and matches `^[a-z]{3,12}$`, its description names kiln (`\bkiln\b`) in at most 300 characters, and every `${CLAUDE_PLUGIN_ROOT}/<path>` it names exists. Rule 3 finds QuickAdd choices by ids starting `kiln-` and passes each `{{VALUE:<name>}}` a choice uses as a var.
- The repo README's `### The Claude plugin` has `#### Install` (anchor `#install`), `#### Update` (`#update`; it ends "Then run `/kiln:setup` to re-apply the blueprint to your vault, …"), `#### Turn it off in one repo` and `#### Companion skills`, and the sentence "So far there is one skill: `/kiln:check` checks a vault's notes, or today's changes, against their type definitions." Don't duplicate those sections.
- `tests/plugin/layout.test.ts` has `REPO`, `PLUGIN`, `readFileSync`, `join` and `readdirSync` in scope, and a living-docs test: every relative Markdown link in README, `CLAUDE.md`, the layer 1 design, the vault rules and each blueprint `.md` resolves from the repo (links starting `https:`, `mailto:` or `#` are skipped).
- The blueprint's QuickAdd fragment holds `kiln-capture` (a Template choice: `command: true`, `openFile: true`, file name `{{DATE:YYYY-MM-DD}} {{VALUE:Capture}}`, `fileExistsBehavior: { "kind": "prompt" }`) and `kiln-log` (a Capture choice, `{{VALUE:Log}}` in its `format`). `tests/kit/settings.test.ts` defines `type Choice` and pins both.
- `.oxlintrc.json` turns `no-unsafe-*` off only for `tests/**` and `scripts/**`; every other rule, `require-await` and `restrict-template-expressions` included, applies to tests too.

## Global Constraints

- **Public repo.** Nothing committed may contain employer or client names, private links, or real local paths of any machine. Paths in code, tests and docs are examples such as `D:\notes` or `D:\tmp\kiln-sample`. Test data is the fictional Northwind Arena.
- **Tests never touch the real home folder, `~/.kiln`, `~/.claude` or a real vault.** Every test vault and kiln file is under `os.tmpdir()`; the bundle test replaces `HOME`, `USERPROFILE` and `KILN_HOME` with temporary folders.
- **Test counts:** N is the suite after #82 (N passed, 1 skipped). Each task's last run gives N plus the running total. Nothing in `src/setup/` reads `process.env`, `process.cwd()`, `process.platform`, `os.homedir()` or the global `fetch`; only `src/cli/kiln-setup.ts` does.
- **The helper's steps** (copied from the spec): 1 check the plugins (`iconic`, `templater-obsidian`, `quickadd`, `homepage`: `manifest.json` and `main.js`, at or above the blueprint's minimums); 2 check the Obsidian CLI is registered; 3 plan, showing every override in a vault already in use; 4 check Obsidian is closed, at this step and only here; 5 apply the type folders, the blueprint into `_kiln/`, the settings merges, one QuickAdd choice and template per kind with "file exists" set so it never prompts, and "Automatically update internal links" on; 6 record `.kiln/blueprint.json` and the vault in `~/.kiln/config.json`; 7 offer, with consent, the permission settings and Templater's trigger (a suggestion); 8 report.
- **JSON the helper writes into `.obsidian/`** is written like Obsidian: `JSON.stringify(value, null, 2)`, LF, no final newline. A file whose parsed value wouldn't change is not rewritten. `core-plugins.json` may be a list (older Obsidian) or an object.
- **A vault already in use:** these settings are the owner's, and each one that would change is shown and asked first: Homepage (`homepages["Main Homepage"]`), the new-note folder (`newFileLocation`, `newFileFolderPath`), the daily-note folder, format and template, Templater's template folder and folder templates, and property types. An existing `Home.md` is never replaced without asking. A fresh vault has nothing to ask.
- **Re-apply is three-way** (copied from the spec):

  | The vault's copy | The blueprint | Re-apply |
  |---|---|---|
  | Unchanged | Changed | Update it |
  | Changed by the owner | Unchanged | Keep the owner's edit |
  | Changed by the owner | Changed | Show both, and ask |
  | Missing | New | Add it |
  | Present | Dropped | Leave it, and report which notes still use it (archive, never delete) |

- **With Obsidian open, re-apply touches only** `_kiln/` files, Iconic's and Templater's settings. Everything else waits. QuickAdd joins only after trial T3: leave it out.
- **The version record** is `.kiln/blueprint.json`: `{ "plugin": "<last folder name of the plugin root>", "blueprint": "sha256:…", "files": { "<vault path>": "sha256:…" } }`. Only the helper reads or writes it.
- **The sample** is loaded only on request, pinned to the plugin's commit, and only with Obsidian closed (it is written as plain files).
- **Never delete or rename anything in a vault.** A file setup replaces is first copied to `.kiln/backup/<stamp>/<vault path>`.
- **Skills:** `claude-plugin/skills/setup/SKILL.md` carries exactly ``Follow `${CLAUDE_PLUGIN_ROOT}/reference/vault-rules.md`, where `<plugin>` is `${CLAUDE_PLUGIN_ROOT}`.``, `name: setup`, a description naming kiln in at most 300 characters, and names only plugin files that exist. `${CLAUDE_PLUGIN_ROOT}` is substituted only in skill text, inline and with forward slashes on Windows, so the skill writes it in its commands and never in files it reads. Values in shell commands go in single quotes, the same in Bash and pwsh: `'` inside a value is written `'\''` in Bash and `''` in pwsh. Every Obsidian CLI call names the vault first, `vault="<folder name>"` (setup makes none: Obsidian must be closed).
- Every command shown in docs and skills works in Bash and pwsh. Scripts are Node, never shell.
- Node 24, ESM, `.js` import extensions. `src/` gets oxlint's full `no-unsafe-*` rules: parse JSON into `unknown` and narrow, never cast.
- Code blocks in this plan aren't Prettier-formatted: run `npm run format` before each commit.
- Commits stage explicit paths (never `git add -A` or `git add .`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before pushing: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build:check`.
- Docs: plain British English, short sentences. The dated plans and #79 design notes stay as written; living docs (README, `CLAUDE.md`, the blueprint guides, the layer 1 design) move with the code.

## Decisions this plan makes

Record these in the PR description; they are exploratory.

1. **Kind templates and choices are generated at apply time,** from the plugin's blueprint, not committed. A kind template is the type's template without its first line (the kind picker) and with `kind: <% kind %>` replaced by `kind: <kind>`, at `_kiln/templates/kinds/<template name> <kind>.md`. The type templates keep their picker for people creating notes by hand; making the folder template "the default kind" waits for trial T2.
2. **Choice ids and names** (bound by #82's vault rules): `kiln-<type>-<kind>` named `New <kind>`, inside a Multi `kiln-<type>-menu` named `New <type>`; a type without kinds gets `kiln-<type>` named `New <type>`, using its own template, unless the blueprint's `quickadd.json` already has that id (`kiln-capture`, "Capture to inbox", which serves the capture type). Duplicate ids or names fail generation.
3. **Generated choices:** Template type, the type's folder, not a command, `openFile: false`, `fileExistsBehavior: { "kind": "apply", "mode": "doNothing" }` (QuickAdd 2.32: keep the existing file, never ask). File name by `naming`: `title` and `source-title` → `{{VALUE:title}}`; `date-title` → `{{DATE:YYYY-MM-DD}} {{VALUE:title}}`; `date` → `{{DATE:YYYY-MM-DD}}`. The hand-written `kiln-capture` changes to `{{DATE:YYYY-MM-DD}} {{VALUE:title}}` and `{ "kind": "apply", "mode": "duplicateSuffix" }` (a second capture with the same title is kept, not lost), so no kiln choice ever prompts and every Template choice takes `title`. `kiln-log`, a Capture choice, keeps `{{VALUE:Log}}`; rule 3 of the vault rules passes whichever values a choice uses.
4. **`requires.json`** in the blueprint: `obsidian` `1.14.0` (the board's kanban needs 1.14, which is above the CLI's 1.12.7), `quickadd` `2.32.0`, and the other three at their latest release when this was written (`iconic` `1.1.10`, `templater-obsidian` `2.26.0`, `homepage` `4.5.0`). Older plugins warn; missing plugins stop. Obsidian's own version can't be read reliably with the app closed, so it is reported, not checked.
5. **The Obsidian CLI check is a PATH lookup** (`Obsidian.com` on Windows, `obsidian` elsewhere). Running `obsidian version` would start Obsidian, which setup needs closed. A miss warns (kiln's other skills need the CLI; setup doesn't), and says to restart the terminal and Claude after registering.
6. **The process check** runs `tasklist /FI "IMAGENAME eq Obsidian.exe" /NH /FO CSV` on Windows and `pgrep -x -i obsidian` elsewhere, through `spawnSync` (no shell, so no MSYS rewriting). If it can't run, the answer is "unknown": first setup stops until the owner confirms (`--confirm-closed`); re-apply treats it as running. `KILN_OBSIDIAN_RUNNING=0|1` overrides it, for tests only.
7. **Overrides default to keep.** `apply` takes the blueprint's value only for ids passed with `--take <id>`. A kept override is recorded in the record's `kept` (with the blueprint value at the time), so re-apply doesn't ask again until the blueprint's value changes. Ids are `<vault path>#<key path>` for settings (`.obsidian/app.json#newFileFolderPath`) and the vault path for files (`Home.md`).
8. **A vault without a record** (set up by hand from the README) is re-applied with no installed hashes: a `_kiln/` file that differs from the blueprint is replaced (backed up first), since the old procedure only ever copied the blueprint there; any other differing file is asked about.
9. **A dropped file's users** are the notes whose text links to it (`[[name`, case-insensitive), and for a dropped type definition, the notes whose `type` is that type. The record then forgets the file, so it is reported once.
10. **The sample** comes from the plugin's own clone when `<plugin root>/../tests/fixtures/layer1` exists (a `--plugin-dir` checkout). Otherwise the plugin version must look like a commit (7–40 hex characters): the helper resolves it with GitHub's commits API, lists `tests/fixtures/layer1/` from the tree API, and fetches each file from `raw.githubusercontent.com`. No git, no tar. Everything is fetched before anything is written. Sample files are skipped where a file already exists, and are not in the record (they are the owner's notes from then on).
11. **Permission settings are written by Claude, not the helper,** with consent, into the user settings file; the helper only computes the exact rules (`permissions` in its report): the vault in `additionalDirectories`, and `Edit(//d/notes/.obsidian/**)` and `Edit(//d/notes/_kiln/**)` in `ask` (Claude Code matches Windows paths in POSIX form).
12. **The vault's name in `~/.kiln/config.json`:** the name already recorded for this folder (a recorded path counts only when it is absolute after `~` is expanded, as the resolver uses it); else `--name`; else the folder name with every run of characters outside `A-Z a-z 0-9 . _ -` turned into `-`, any leading character other than a letter or digit dropped, and any trailing `-` dropped (`Trial Vault` → `Trial-Vault`, `.notes` → `notes`; nothing left gives `vault`), with `-2`, `-3`… when another entry has that name. A `--name` must match `recordVault`'s rule, `^[A-Za-z0-9][A-Za-z0-9._-]*$`. Recording only happens when something changes, so a second apply leaves the file alone.
13. **Guides link to the repo README with absolute URLs** (`https://github.com/Kieranties/kiln#install`), because they are copied into a vault's `_kiln/`, where relative links out of the blueprint break. (#82's plan expected `../../README.md#install`; that link breaks in `_kiln/`.) The same fixes the blueprint README's `../../docs/...` link. A test keeps every relative link in the blueprint docs inside the blueprint.

## Review Focus

1. **Settings files edited by hand:** a byte-order mark, CRLF, or broken JSON in `.obsidian/app.json`. The first two read the same; broken JSON stops setup with the file named, and nothing is written. Pinned in Task 3 and Task 7.
2. **The owner's own entries next to kiln's:** their QuickAdd choices (including one inside a Multi next to a `kiln-` choice), Iconic rules, Templater folder templates, ignore filters and enabled plugins. All survive every apply, and only `kiln-` entries are replaced. Pinned in Tasks 3 and 4.
3. **Obsidian's state unknown, or open on another vault:** the check can't tell which vault is open. Unknown stops first setup until confirmed; on re-apply both are treated as running, and only live-safe changes are made. Pinned in Tasks 6 and 7.
4. **The sample fetch failing halfway** (a 403 rate limit, no network). Nothing at all is written, and the report names the URL. Pinned in Task 8.
5. **Vault paths and names:** `~/notes`, a relative path, a trailing separator, a folder name with spaces, a name another vault already uses. The vault resolves to one absolute folder, gets a valid kiln name, and never repoints another vault's name. Pinned in Tasks 7 and 9.

---

## File structure

| File | Responsibility |
|---|---|
| `claude-plugin/blueprint/requires.json` | Minimum versions of Obsidian and the four plugins |
| `claude-plugin/blueprint/settings/plugins/quickadd.json` | `kiln-capture` takes `title` and never prompts |
| `src/setup/json.ts` | `Json`, `JsonObject` (Task 1); `isObject`, `sameJson`, `readJson`, `obsidianJson` (Task 3) |
| `src/setup/quickadd.ts` | `kindTemplates`, `kindChoices`, `isChoice`: generated from the definitions |
| `src/setup/hash.ts` | `hash`, `blueprintHash` |
| `src/setup/blueprint.ts` | `readRequires`, `installedFiles`, `SETTINGS` (fragment → target, live or not) |
| `src/setup/merge.ts` | `Merger`, `mergeFragment`: one rule per settings fragment, with overrides |
| `src/setup/files.ts` | `sortFile` (the three-way sort), `usersOf` |
| `src/setup/record.ts` | `.kiln/blueprint.json`: `readRecord`, `writeRecord` |
| `src/setup/checks.ts` | `compareVersions`, `checkPlugins`, `findObsidianCli`, `isObsidianRunning` |
| `src/setup/sample.ts` | `loadSample`: the sample from the clone or GitHub at the plugin's commit |
| `src/setup/setup.ts` | `planSetup`, `applySetup`, `permissionRules`, `vaultName`, the report types |
| `src/setup/run.ts` | `runSetup`, `USAGE`: arguments in, JSON and exit code out |
| `src/cli/kiln-setup.ts` | Entry point: the only reader of `process` |
| `claude-plugin/scripts/kiln-setup.mjs` | The committed bundle |
| `claude-plugin/skills/setup/SKILL.md` | `/kiln:setup` |
| `claude-plugin/blueprint/README.md`, `GETTING-STARTED.md`, `TRY-THE-SAMPLE.md` | No clone; the helper; the manual fallback |
| `README.md`, `tests/plugin/layout.test.ts` | The repo README names `/kiln:setup` and the new code; a test that it names every skill |
| `tests/setup/fixture.ts` | `testVault()`, `pluginCopy()`, `fakeGitHub()`, `fingerprint()` |
| `tests/setup/*.test.ts` | One file per module, plus `bundle.test.ts` and `skill.test.ts` |

---

### Task 1: Generated QuickAdd choices and kind templates

**Files:**
- Create: `src/setup/json.ts` (types only; Task 3 adds its functions), `src/setup/quickadd.ts`
- Modify: `claude-plugin/blueprint/settings/plugins/quickadd.json`, `tests/kit/settings.test.ts`
- Test: `tests/setup/quickadd.test.ts`

**Interfaces:**
- Consumes: `readBlueprint`, `type Definition`, `type Naming` (#83, `src/blueprint/load.ts`).
- Produces, in `src/setup/json.ts`:
  - `type Json = null | boolean | number | string | Json[] | { [key: string]: Json }`; `type JsonObject = { [key: string]: Json }`.
- Produces, in `src/setup/quickadd.ts`:
  - `type KindTemplate = { path: string; text: string }` (`path` is vault-relative with `/`).
  - `kindTemplates(definitions: Definition[], readTemplate: (file: string) => string): KindTemplate[]`.
  - `type Choice = { id: string; name: string; type: string; [key: string]: Json }`. Its index signature is `Json`, so a `Choice[]` is a `Json[]` (Task 4's merge takes it as `extra.choices`).
  - `isChoice(v: Json | undefined): v is Choice`: an object whose `id`, `name` and `type` are text.
  - `kindChoices(definitions: Definition[], blueprintChoices: Choice[]): Choice[]`: the generated choices only, in definition order. Throws `QuickAdd choice id "<id>" is used twice` or `QuickAdd choice name "<name>" is used twice`, checking generated and blueprint choices together, at every depth.
  - `FILE_NAME: Record<Naming, string>`.

- [ ] **Step 1: Write the failing tests** in `tests/setup/quickadd.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readBlueprint } from '../../src/blueprint/load.js';
import { kindChoices, kindTemplates, type Choice } from '../../src/setup/quickadd.js';
import { BLUEPRINT } from '../kit/load.js';

const { definitions } = readBlueprint(BLUEPRINT);
const read = (file: string) => readFileSync(join(BLUEPRINT, 'templates', file), 'utf8');
const fragment = JSON.parse(readFileSync(join(BLUEPRINT, 'settings/plugins/quickadd.json'), 'utf8')) as { choices: Choice[] };
const flat = (choices: Choice[]): Choice[] =>
  choices.flatMap((c) => [c, ...flat(Array.isArray(c.choices) ? (c.choices as Choice[]) : [])]);

describe('kindTemplates', () => {
  it('writes one template per kind, with the kind fixed and no picker', () => {
    const templates = kindTemplates(definitions, read);
    expect(templates).toHaveLength(25);
    const bug = templates.find((t) => t.path === '_kiln/templates/kinds/Work bug.md');
    expect(bug?.text.startsWith('---\ntype: work\nkind: bug\nstatus: backlog\n')).toBe(true);
    for (const t of templates) expect(t.text, t.path).not.toMatch(/tp\.system|<% kind %>/);
  });

  it('names the template when its picker is missing', () => {
    expect(() => kindTemplates(definitions, (f) => (f === 'Work.md' ? '---\ntype: work\n---\n' : read(f)))).toThrow(
      /^templates\/Work\.md: expected a kind picker/,
    );
  });
});

describe('kindChoices', () => {
  const choices = kindChoices(definitions, fragment.choices);
  const all = flat(choices);

  it('groups a type with kinds in a menu, one choice per kind', () => {
    const menu = choices.find((c) => c.id === 'kiln-work-menu');
    expect(menu).toMatchObject({ name: 'New work', type: 'Multi', command: false });
    expect(flat([menu as Choice]).slice(1).map((c) => [c.id, c.name])).toEqual([
      ['kiln-work-feature', 'New feature'],
      ['kiln-work-bug', 'New bug'],
      ['kiln-work-chore', 'New chore'],
      ['kiln-work-incident', 'New incident'],
      ['kiln-work-task', 'New task'],
    ]);
    expect(all.find((c) => c.id === 'kiln-work-bug')).toEqual({
      id: 'kiln-work-bug',
      name: 'New bug',
      type: 'Template',
      command: false,
      templatePath: '_kiln/templates/kinds/Work bug.md',
      fileNameFormat: { enabled: true, format: '{{VALUE:title}}' },
      folder: { enabled: true, folders: ['Work'], chooseWhenCreatingNote: false, createInSameFolderAsActiveFile: false, chooseFromSubfolders: false },
      appendLink: false,
      openFile: false,
      fileOpening: { location: 'tab', direction: 'vertical', mode: 'default', focus: true },
      fileExistsBehavior: { kind: 'apply', mode: 'doNothing' },
    });
  });

  it('names notes by the type naming rule', () => {
    const format = (id: string) => ((all.find((c) => c.id === id) as Choice).fileNameFormat as { format: string }).format;
    expect(format('kiln-meeting-standup')).toBe('{{DATE:YYYY-MM-DD}} {{VALUE:title}}');
    expect(format('kiln-daily')).toBe('{{DATE:YYYY-MM-DD}}');
    expect(format('kiln-reference-ticket')).toBe('{{VALUE:title}}');
    expect(all.find((c) => c.id === 'kiln-topic')).toMatchObject({ name: 'New topic', templatePath: '_kiln/templates/Topic.md' });
  });

  it("leaves a type to the blueprint's own choice when it has one", () => {
    expect(all.some((c) => c.id === 'kiln-capture')).toBe(false);
  });

  it('refuses a duplicate name', () => {
    const extra: Choice = { id: 'mine', name: 'New bug', type: 'Template' };
    expect(() => kindChoices(definitions, [...fragment.choices, extra])).toThrow('QuickAdd choice name "New bug" is used twice');
  });
});
```

In `tests/kit/settings.test.ts`, `describe('QuickAdd')`: change the capture test's expected format to `'{{DATE:YYYY-MM-DD}} {{VALUE:title}}'` and add `fileExistsBehavior: { kind: 'apply', mode: 'duplicateSuffix' }` to its `toMatchObject`. Add:

```ts
  it('no kiln choice asks what to do when the file exists', () => {
    const choices = loadJson<{ choices: Choice[] }>('settings/plugins/quickadd.json').choices;
    for (const c of choices) expect(c.fileExistsBehavior, c.id).not.toEqual({ kind: 'prompt' });
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/setup/quickadd.test.ts tests/kit/settings.test.ts`
Expected: FAIL: `../../src/setup/quickadd.js` can't be resolved; the capture choice still prompts.

- [ ] **Step 3: Change `kiln-capture`** in `claude-plugin/blueprint/settings/plugins/quickadd.json`: `fileNameFormat.format` becomes `"{{DATE:YYYY-MM-DD}} {{VALUE:title}}"`, `fileExistsBehavior` becomes `{ "kind": "apply", "mode": "duplicateSuffix" }`.

- [ ] **Step 4: Write `src/setup/json.ts` and implement `src/setup/quickadd.ts`**

`src/setup/json.ts`, for now:

```ts
/** A JSON value: what `JSON.parse` gives, and what Obsidian and its plugins store. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
```

`src/setup/quickadd.ts`:

```ts
import type { Definition, Naming } from '../blueprint/load.js';
import type { Json } from './json.js';

export type KindTemplate = { path: string; text: string };
export type Choice = { id: string; name: string; type: string; [key: string]: Json };

export function isChoice(v: Json | undefined): v is Choice {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.type === 'string'
  );
}

/** The kind picker every type-with-kinds template starts with (a modal, which a headless run can't answer). */
const PICKER = /^<%\* const kind = await tp\.system\.suggester\(.*\) -%>\r?\n/;
const KIND = 'kind: <% kind %>';

export const FILE_NAME: Record<Naming, string> = {
  title: '{{VALUE:title}}',
  'source-title': '{{VALUE:title}}',
  'date-title': '{{DATE:YYYY-MM-DD}} {{VALUE:title}}',
  date: '{{DATE:YYYY-MM-DD}}',
};

const base = (d: Definition) => d.template.replace(/\.md$/, '');
const kindPath = (d: Definition, kind: string) => `_kiln/templates/kinds/${base(d)} ${kind}.md`;

export function kindTemplates(definitions: Definition[], readTemplate: (file: string) => string): KindTemplate[] {
  return definitions.flatMap((d) => {
    const kinds = Object.keys(d.kinds);
    if (kinds.length === 0) return [];
    const text = readTemplate(d.template);
    if (!PICKER.test(text) || !text.includes(KIND)) {
      throw new Error(`templates/${d.template}: expected a kind picker on its first line and "${KIND}"`);
    }
    return kinds.map((kind) => ({ path: kindPath(d, kind), text: text.replace(PICKER, '').replace(KIND, `kind: ${kind}`) }));
  });
}

function templateChoice(id: string, name: string, d: Definition, templatePath: string): Choice {
  return {
    id,
    name,
    type: 'Template',
    command: false,
    templatePath,
    fileNameFormat: { enabled: true, format: FILE_NAME[d.naming] },
    folder: { enabled: true, folders: [d.folder], chooseWhenCreatingNote: false, createInSameFolderAsActiveFile: false, chooseFromSubfolders: false },
    appendLink: false,
    openFile: false,
    fileOpening: { location: 'tab', direction: 'vertical', mode: 'default', focus: true },
    fileExistsBehavior: { kind: 'apply', mode: 'doNothing' },
  };
}

export function kindChoices(definitions: Definition[], blueprintChoices: Choice[]): Choice[] {
  const taken = new Set(blueprintChoices.map((c) => c.id));
  const generated: Choice[] = [];
  for (const d of definitions) {
    const kinds = Object.keys(d.kinds);
    if (kinds.length === 0) {
      const id = `kiln-${d.name}`;
      if (!taken.has(id)) generated.push(templateChoice(id, `New ${d.name}`, d, `_kiln/templates/${d.template}`));
      continue;
    }
    generated.push({
      id: `kiln-${d.name}-menu`,
      name: `New ${d.name}`,
      type: 'Multi',
      command: false,
      collapsed: true,
      choices: kinds.map((k) => templateChoice(`kiln-${d.name}-${k}`, `New ${k}`, d, kindPath(d, k))),
    });
  }
  assertUnique([...blueprintChoices, ...generated]);
  return generated;
}
```

`assertUnique(choices: Choice[])` walks every choice and its nested `choices` (when an array, keeping the entries `isChoice` accepts), and throws on the first repeated `id`, then on the first repeated name, with the messages above.

- [ ] **Step 5: Run them to verify they pass**

Run: `npx vitest run tests/setup tests/kit && npm run typecheck && npm run lint`
Expected: PASS.

Run: `npm test`
Expected: N + 7 passed, 1 skipped (6 in `quickadd.test.ts`, 1 in `settings.test.ts`).

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/setup/json.ts src/setup/quickadd.ts tests/setup/quickadd.test.ts claude-plugin/blueprint/settings/plugins/quickadd.json tests/kit/settings.test.ts
git commit -m "feat(setup): generate a QuickAdd choice and template per kind" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: What setup installs: `requires.json`, the install map and hashes

**Files:**
- Create: `claude-plugin/blueprint/requires.json`, `src/setup/hash.ts`, `src/setup/blueprint.ts`, `tests/setup/fixture.ts`
- Modify: `claude-plugin/blueprint/README.md` ("What the blueprint is" table only)
- Test: `tests/setup/blueprint.test.ts`

**Interfaces:**
- Consumes: `readDefinitions` (#83, `src/blueprint/load.ts`); `kindTemplates` (Task 1).
- Produces, in `src/setup/hash.ts`:
  - `hash(data: string | Uint8Array): string`: `sha256:<hex>`; a string is hashed as UTF-8.
  - `blueprintHash(dir: string): string`: every file under `dir`, sorted by its `/` relative path, fed in as `<path>\0<hash(content)>\n`; `sha256:<hex>`.
- Produces, in `src/setup/blueprint.ts`:
  - `type Requires = { obsidian: string; plugins: Record<string, string> }`; `readRequires(dir: string): Requires` (throws `requires.json: <problem>`).
  - `installedFiles(dir: string): Map<string, string>`: vault path → text, sorted by path. `types/`, `templates/` and `views/` go to `_kiln/` under the same names; every `*.md` at the blueprint root to `_kiln/`; `root/*` to the vault root; `settings/snippets/*` to `.obsidian/snippets/`; plus `kindTemplates(readDefinitions(dir), (file) => readFileSync(join(dir, 'templates', file), 'utf8'))`.
  - `type SettingTarget = { fragment: string; target: string; live: boolean }`; `SETTINGS: SettingTarget[]`, in this order:

    | `fragment` | `target` | `live` |
    |---|---|---|
    | `settings/app.json` | `.obsidian/app.json` | false |
    | `settings/types.json` | `.obsidian/types.json` | false |
    | `settings/daily-notes.json` | `.obsidian/daily-notes.json` | false |
    | `settings/core-plugins.json` | `.obsidian/core-plugins.json` | false |
    | `settings/community-plugins.json` | `.obsidian/community-plugins.json` | false |
    | `settings/appearance.json` | `.obsidian/appearance.json` | false |
    | `settings/plugins/iconic.json` | `.obsidian/plugins/iconic/data.json` | true |
    | `settings/plugins/templater.json` | `.obsidian/plugins/templater-obsidian/data.json` | true |
    | `settings/plugins/quickadd.json` | `.obsidian/plugins/quickadd/data.json` | false (QuickAdd reloads live since 2.30; true after trial T3) |
    | `settings/plugins/homepage.json` | `.obsidian/plugins/homepage/data.json` | false |
    | `settings/workspace-file-properties.json` | `.obsidian/workspace.json` | false |

  - `NOT_INSTALLED = ['requires.json']`: blueprint entries setup reads but never copies.
  - `isLive(vaultPath: string): boolean`: true for paths under `_kiln/` and the live `SETTINGS` targets.
- Produces, in `tests/setup/fixture.ts` (later tasks add to it):
  - `PLUGIN_ROOT`: `fileURLToPath(new URL('../../claude-plugin/', import.meta.url))` (absolute, with a trailing separator, as in `tests/plugin/skills.test.ts`).
  - `pluginCopy(name: string, change?: (blueprint: string) => void): string`: makes a new temporary folder (`mkdtempSync(join(tmpdir(), 'kiln-plugin-'))`), copies `claude-plugin/blueprint/` to `<that>/<name>/blueprint/` with `cpSync(..., { recursive: true })`, runs `change(<that>/<name>/blueprint)`, and returns `<that>/<name>`. The last folder name is the plugin version setup records, so two copies may share a name. Removed by `cleanupAll()`.
  - `cleanupAll()`: removes every temporary folder the fixture made (call in `afterAll`).

- [ ] **Step 1: Write the failing tests** in `tests/setup/blueprint.test.ts`

```ts
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { installedFiles, isLive, NOT_INSTALLED, readRequires, SETTINGS } from '../../src/setup/blueprint.js';
import { blueprintHash, hash } from '../../src/setup/hash.js';
import { BLUEPRINT } from '../kit/load.js';
import { cleanupAll, pluginCopy } from './fixture.js';

afterAll(cleanupAll);
const files = installedFiles(BLUEPRINT);

describe('installedFiles', () => {
  it('maps the blueprint to its vault paths', () => {
    for (const path of [
      '_kiln/types/work.md',
      '_kiln/templates/Work.md',
      '_kiln/templates/kinds/Work bug.md',
      '_kiln/views/today.base',
      '_kiln/properties.md',
      '_kiln/README.md',
      '_kiln/GETTING-STARTED.md',
      '_kiln/TRY-THE-SAMPLE.md',
      'Home.md',
      'Board.base',
      '.obsidian/snippets/kiln.css',
    ]) {
      expect(files.has(path), path).toBe(true);
    }
    expect(files.get('_kiln/types/work.md')).toBe(readFileSync(join(BLUEPRINT, 'types', 'work.md'), 'utf8'));
    expect([...files.keys()]).toEqual([...files.keys()].sort());
  });

  it('accounts for every blueprint entry: installed, merged, or read only', () => {
    const merged = new Set(SETTINGS.map((s) => s.fragment));
    for (const entry of readdirSync(join(BLUEPRINT, 'settings'), { recursive: true, withFileTypes: true }).filter((e) => e.isFile())) {
      const path = join(entry.parentPath, entry.name).slice(BLUEPRINT.length).split(/[\\/]/).join('/');
      expect(merged.has(path) || path.startsWith('settings/snippets/'), path).toBe(true);
    }
    const handled = ['types', 'templates', 'views', 'root', 'settings', ...NOT_INSTALLED];
    for (const entry of readdirSync(BLUEPRINT)) expect(handled.includes(entry) || entry.endsWith('.md'), entry).toBe(true);
  });

  it('only _kiln/, Iconic and Templater are live', () => {
    expect(isLive('_kiln/types/work.md')).toBe(true);
    expect(isLive('.obsidian/plugins/iconic/data.json')).toBe(true);
    expect(isLive('.obsidian/plugins/templater-obsidian/data.json')).toBe(true);
    for (const path of ['Home.md', '.obsidian/plugins/quickadd/data.json', '.obsidian/app.json', '.obsidian/snippets/kiln.css']) {
      expect(isLive(path), path).toBe(false);
    }
  });
});

describe('requires.json', () => {
  it('names Obsidian and the four plugins', () => {
    const requires = readRequires(BLUEPRINT);
    expect(requires.obsidian).toBe('1.14.0');
    expect(requires.plugins).toEqual({ iconic: '1.1.10', 'templater-obsidian': '2.26.0', quickadd: '2.32.0', homepage: '4.5.0' });
  });
});

describe('hashes', () => {
  it('hash a string as UTF-8', () => {
    expect(hash('kiln')).toBe(hash(new TextEncoder().encode('kiln')));
    expect(hash('kiln')).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('the blueprint hash changes with any file', () => {
    const a = pluginCopy('aaaaaaaaaaaa');
    const b = pluginCopy('bbbbbbbbbbbb', (dir) => writeFileSync(join(dir, 'views', 'today.base'), 'changed\n'));
    expect(blueprintHash(join(a, 'blueprint'))).toBe(blueprintHash(BLUEPRINT));
    expect(blueprintHash(join(b, 'blueprint'))).not.toBe(blueprintHash(BLUEPRINT));
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/setup/blueprint.test.ts`
Expected: FAIL: the modules don't exist.

- [ ] **Step 3: Write `claude-plugin/blueprint/requires.json`**

```json
{
  "obsidian": "1.14.0",
  "plugins": {
    "iconic": "1.1.10",
    "templater-obsidian": "2.26.0",
    "quickadd": "2.32.0",
    "homepage": "4.5.0"
  }
}
```

Add a row to the README's "What the blueprint is" table, after `settings/`: ``| `requires.json` | The oldest Obsidian and plugin versions the blueprint is written for. Setup warns when a plugin is older | Read by setup; not copied |``.

- [ ] **Step 4: Implement `src/setup/hash.ts`, `src/setup/blueprint.ts` and the fixture**

`hash` uses `createHash('sha256')`. `installedFiles` reads every file with `readFileSync(path, 'utf8')`, walking folders with `readdirSync(dir, { recursive: true, withFileTypes: true })` and joining relative paths with `/`. `readRequires` narrows from `unknown`: `obsidian` is text, `plugins` a map of text.

- [ ] **Step 5: Run them to verify they pass**

Run: `npx vitest run tests/setup tests/kit && npm run typecheck && npm run lint`
Expected: PASS.

Run: `npm test`
Expected: N + 13 passed, 1 skipped (6 new in `blueprint.test.ts`). `requires.json` is in the release zip from now on; nothing else in CI changes.

- [ ] **Step 6: Commit**

```bash
npm run format
git add claude-plugin/blueprint/requires.json claude-plugin/blueprint/README.md src/setup/hash.ts src/setup/blueprint.ts tests/setup/fixture.ts tests/setup/blueprint.test.ts
git commit -m "feat(setup): the install map, minimum versions and blueprint hashes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: JSON like Obsidian, and the Obsidian settings merges

**Files:**
- Create: `src/setup/merge.ts`
- Modify: `src/setup/json.ts` (Task 1 made it with the types)
- Test: `tests/setup/json.test.ts`, `tests/setup/merge.test.ts`

**Interfaces:**
- Consumes: `Json`, `JsonObject` (Task 1).
- Produces, in `src/setup/json.ts`:
  - `isObject(v: unknown): v is JsonObject`: a non-null, non-array object (the caller's value is already `Json`, or is narrowed by `isJson`).
  - `sameJson(a: unknown, b: unknown): boolean`: deep equality; object key order ignored, array order kept.
  - `readJson(file: string): Json | undefined`: `undefined` when the file doesn't exist; strips a leading `\uFEFF`; throws `` `${file}: not valid JSON: ${message}` ``.
  - `obsidianJson(value: Json): string`: `JSON.stringify(value, null, 2)`, which is LF with no final newline.
- Produces, in `src/setup/merge.ts`:
  - `type Answers = { take: ReadonlySet<string>; kept: Readonly<Record<string, Json>> }`.
  - `type Change = { file: string; key: string; from?: Json; to?: Json }`: `from` and `to` only when both are scalars.
  - `type Override = { id: string; file: string; key: string; current: Json; blueprint: Json; asked: boolean; taken: boolean }`. `asked` is false when `kept[id]` equals `blueprint` (the owner already said keep to this value).
  - `class Merger` (below), constructed with the target's vault path (`.obsidian/app.json`) and `Answers`.
  - `type MergeExtra = { choices: Json[] }` (Task 1's generated choices).
  - `mergeFragment(fragment: string, current: Json | undefined, blueprint: Json, m: Merger, extra: MergeExtra): Json | undefined`: the new value for the target; `undefined` means leave the target alone (only `workspace.json` when missing). Never mutates `current`. A target of the wrong shape throws `` `${m.file}: expected a JSON object` `` (or `list`).

**The rules.** This task: app, types, daily notes, core plugins, community plugins, appearance, Homepage. Task 4: Iconic, Templater, QuickAdd, the workspace.

| Fragment | Rule | The owner's (`setOwned`, asked) |
|---|---|---|
| `app.json` | Set each key; `userIgnoreFilters` gains the blueprint's entries it lacks | `newFileLocation`, `newFileFolderPath` |
| `types.json` | Set each `types/<prop>` | every `types/<prop>` |
| `daily-notes.json` | Set each key | `folder`, `format`, `template` |
| `core-plugins.json` | Object: set each key. List (older Obsidian, the plugins that are on): drop ids the blueprint sets `false`, append ids it sets `true` that are missing | none |
| `community-plugins.json` | Append the ids that are missing | none |
| `appearance.json` | `enabledCssSnippets` gains `kiln` | none |
| `plugins/homepage.json` | Set `version`; `homepages/Main Homepage` is the owner's, compared on `value` and `kind` only (Homepage writes its own defaults on install, `Home` and `File`, which aren't an override) | `homepages/Main Homepage` |

- [ ] **Step 1: Write the failing tests**

`tests/setup/json.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { obsidianJson, readJson, sameJson } from '../../src/setup/json.js';

const dir = mkdtempSync(join(tmpdir(), 'kiln-json-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('JSON like Obsidian', () => {
  it('reads a file saved by another editor: byte-order mark and CRLF', () => {
    writeFileSync(join(dir, 'app.json'), '\uFEFF{\r\n  "showInlineTitle": false\r\n}\r\n');
    expect(readJson(join(dir, 'app.json'))).toEqual({ showInlineTitle: false });
  });
  it('names a broken file, and treats a missing one as absent', () => {
    writeFileSync(join(dir, 'broken.json'), '{ "a": 1,, }');
    expect(() => readJson(join(dir, 'broken.json'))).toThrow(`${join(dir, 'broken.json')}: not valid JSON: `);
    expect(readJson(join(dir, 'missing.json'))).toBeUndefined();
  });
  it('writes two-space JSON with LF and no final newline', () => {
    expect(obsidianJson({ a: [1, { b: true }] })).toBe('{\n  "a": [\n    1,\n    {\n      "b": true\n    }\n  ]\n}');
  });
  it('compares values, not key order', () => {
    expect(sameJson({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(sameJson([1, 2], [2, 1])).toBe(false);
  });
});
```

`tests/setup/merge.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Json } from '../../src/setup/json.js';
import { mergeFragment, Merger } from '../../src/setup/merge.js';
import { BLUEPRINT } from '../kit/load.js';

const TARGET: Record<string, string> = {
  'settings/app.json': '.obsidian/app.json',
  'settings/types.json': '.obsidian/types.json',
  'settings/daily-notes.json': '.obsidian/daily-notes.json',
  'settings/core-plugins.json': '.obsidian/core-plugins.json',
  'settings/community-plugins.json': '.obsidian/community-plugins.json',
  'settings/plugins/homepage.json': '.obsidian/plugins/homepage/data.json',
};

/** Merges one blueprint fragment over `current`. */
function merge(fragment: string, current: Json | undefined, take: string[] = [], kept: Record<string, Json> = {}) {
  const blueprint = JSON.parse(readFileSync(join(BLUEPRINT, fragment), 'utf8')) as Json;
  const m = new Merger(TARGET[fragment] ?? fragment, { take: new Set(take), kept });
  const value = mergeFragment(fragment, current, blueprint, m, { choices: [] });
  return { value, changes: m.changes, overrides: m.overrides };
}

describe('the Obsidian settings', () => {
  it('a fresh app.json takes every key, with nothing to ask', () => {
    const { value, overrides } = merge('settings/app.json', {});
    expect(value).toMatchObject({ newFileFolderPath: 'Inbox', alwaysUpdateLinks: true, userIgnoreFilters: ['_kiln/'] });
    expect(overrides).toEqual([]);
  });

  it("keeps the owner's new-note folder unless taken, and their ignore filters always", () => {
    const current = { newFileLocation: 'folder', newFileFolderPath: 'Notes', userIgnoreFilters: ['Archive/'] };
    const kept = merge('settings/app.json', current);
    expect(kept.value).toMatchObject({ newFileFolderPath: 'Notes', userIgnoreFilters: ['Archive/', '_kiln/'] });
    expect(kept.overrides).toEqual([
      { id: '.obsidian/app.json#newFileFolderPath', file: '.obsidian/app.json', key: 'newFileFolderPath', current: 'Notes', blueprint: 'Inbox', asked: true, taken: false },
    ]);
    const taken = merge('settings/app.json', current, ['.obsidian/app.json#newFileFolderPath']);
    expect(taken.value).toMatchObject({ newFileFolderPath: 'Inbox' });
    expect(taken.changes).toContainEqual({ file: '.obsidian/app.json', key: 'newFileFolderPath', from: 'Notes', to: 'Inbox' });
  });

  it('does not ask again about an override the owner kept, until the blueprint changes it', () => {
    const current = { newFileFolderPath: 'Notes' };
    expect(merge('settings/app.json', current, [], { '.obsidian/app.json#newFileFolderPath': 'Inbox' }).overrides[0]?.asked).toBe(false);
    expect(merge('settings/app.json', current, [], { '.obsidian/app.json#newFileFolderPath': 'Capture' }).overrides[0]?.asked).toBe(true);
  });

  it("asks before changing the owner's property types, and keeps their own", () => {
    const { value, overrides } = merge('settings/types.json', { types: { created: 'datetime', mood: 'text', tags: 'tags' } });
    expect(overrides.map((o) => o.id)).toEqual(['.obsidian/types.json#types/created']);
    expect(value).toMatchObject({ types: { created: 'datetime', mood: 'text', tags: 'tags', projects: 'multitext' } });
  });

  it("asks before moving the owner's daily notes", () => {
    const { overrides } = merge('settings/daily-notes.json', { folder: 'Journal', format: 'YYYY-MM-DD' });
    expect(overrides.map((o) => o.id)).toEqual(['.obsidian/daily-notes.json#folder']);
  });

  it('core plugins: an object is set, an older list keeps its form', () => {
    expect(merge('settings/core-plugins.json', { templates: true, graph: true }).value).toMatchObject({
      templates: false,
      graph: true,
      bases: true,
    });
    const list = merge('settings/core-plugins.json', ['file-explorer', 'templates', 'graph']).value;
    expect(list).toEqual([
      'file-explorer',
      'graph',
      'bases',
      'daily-notes',
      'properties',
      'backlink',
      'switcher',
      'global-search',
      'command-palette',
    ]);
  });

  it("adds kiln's plugins and snippet to the owner's", () => {
    expect(merge('settings/community-plugins.json', ['dataview', 'quickadd']).value).toEqual([
      'dataview',
      'quickadd',
      'iconic',
      'templater-obsidian',
      'homepage',
    ]);
  });

  it("Homepage's own defaults are not an override; another homepage is", () => {
    const defaults = { version: 4, homepages: { 'Main Homepage': { value: 'Home', kind: 'File', openMode: 'Replace all open notes' } } };
    expect(merge('settings/plugins/homepage.json', defaults).overrides).toEqual([]);
    const own = { homepages: { 'Main Homepage': { value: 'Dashboard', kind: 'File' } } };
    expect(merge('settings/plugins/homepage.json', own).overrides.map((o) => o.id)).toEqual([
      '.obsidian/plugins/homepage/data.json#homepages/Main Homepage',
    ]);
  });

  it('never changes the value it was given', () => {
    const current = { userIgnoreFilters: ['Archive/'] };
    merge('settings/app.json', current);
    expect(current).toEqual({ userIgnoreFilters: ['Archive/'] });
  });

  it('a second merge of its own result changes nothing', () => {
    const first = merge('settings/app.json', { newFileFolderPath: '' }).value;
    expect(merge('settings/app.json', first).changes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/setup/json.test.ts tests/setup/merge.test.ts`
Expected: FAIL: the modules don't exist.

- [ ] **Step 3: Implement `src/setup/json.ts`**

`JSON.parse`'s result is `Json` by construction; narrow it with a recursive `isJson(v: unknown): v is Json` guard rather than a cast.

- [ ] **Step 4: Implement `Merger` and this task's rules** in `src/setup/merge.ts`

```ts
const scalar = (v: Json | undefined) => v === undefined || v === null || typeof v !== 'object';
const blank = (v: Json | undefined) => v === undefined || v === null || v === '';

export class Merger {
  readonly changes: Change[] = [];
  readonly overrides: Override[] = [];
  constructor(
    readonly file: string,
    private readonly answers: Answers,
  ) {}

  /** Sets obj[key] = to, recording a change when the value differs. */
  set(obj: JsonObject, key: string, to: Json, path: string = key): void {
    const from = obj[key];
    if (sameJson(from, to)) return;
    obj[key] = to;
    this.changes.push(scalar(from) && scalar(to) ? { file: this.file, key: path, from, to } : { file: this.file, key: path });
  }

  /** Records a change to a value replaced wholesale (core-plugins.json as a list). */
  changed(path: string): void {
    this.changes.push({ file: this.file, key: path });
  }

  /**
   * Whether the blueprint's value goes in over the owner's. A set value that differs is an override:
   * recorded, and replaced only when the owner took the blueprint's value.
   */
  decide(path: string, current: Json | undefined, to: Json, same: (a: Json, b: Json) => boolean = sameJson): boolean {
    if (blank(current) || current === undefined || same(current, to)) return true;
    const id = `${this.file}#${path}`;
    const taken = this.answers.take.has(id);
    const before = this.answers.kept[id];
    const asked = before === undefined || !sameJson(before, to);
    this.overrides.push({ id, file: this.file, key: path, current, blueprint: to, asked, taken });
    return taken;
  }

  setOwned(obj: JsonObject, key: string, to: Json, path: string = key, same?: (a: Json, b: Json) => boolean): void {
    if (this.decide(path, obj[key], to, same)) this.set(obj, key, to, path);
  }

  /** obj[key] as an object, made when it is missing or isn't one. */
  object(obj: JsonObject, key: string): JsonObject {
    const value = obj[key];
    if (isObject(value)) return value;
    const made: JsonObject = {};
    obj[key] = made;
    return made;
  }
}
```

`mergeFragment` dispatches on `fragment` to a `RULES: Record<string, Rule>` table, `type Rule = (current: Json, blueprint: Json, m: Merger, extra: MergeExtra) => Json`, and throws `` `no merge rule for ${fragment}` `` for any other fragment. For `settings/workspace-file-properties.json` with `current` `undefined`, it returns `undefined` before any rule runs. Otherwise it passes `structuredClone(current)`, or `{}` (`[]` for `community-plugins.json`) when `current` is `undefined`. Two helpers: `union(current: Json | undefined, add: Json | undefined): Json[]` (the current list, then each added entry it lacks; a non-list counts as empty) and `asObject(v, m)` / `asArray(v, m)` (throw the shape errors). The rules for this task, by the table:

```ts
const OWNED: Record<string, readonly string[]> = {
  'settings/app.json': ['newFileLocation', 'newFileFolderPath'],
  'settings/daily-notes.json': ['folder', 'format', 'template'],
};

function setKeys(fragment: string): Rule {
  return (current, blueprint, m) => {
    const o = asObject(current, m);
    for (const [key, value] of Object.entries(asObject(blueprint, m))) {
      if (key === 'userIgnoreFilters') m.set(o, key, union(o[key], value));
      else if (OWNED[fragment]?.includes(key)) m.setOwned(o, key, value);
      else m.set(o, key, value);
    }
    return o;
  };
}

// 'settings/core-plugins.json', when current is a list:
const on = current.filter((id) => typeof id !== 'string' || b[id] !== false);
for (const [id, enabled] of Object.entries(b)) if (enabled === true && !on.includes(id)) on.push(id);
if (!sameJson(on, current)) m.changed('(enabled plugins)');
return on;
```

`types.json`: `const types = m.object(o, 'types')`, then `m.setOwned(types, prop, value, \`types/${prop}\`)` per entry. Homepage: `m.set(o, 'version', ...)`, then `m.setOwned(m.object(o, 'homepages'), 'Main Homepage', main, 'homepages/Main Homepage', (a, b) => isObject(a) && isObject(b) && a.value === b.value && a.kind === b.kind)`.

- [ ] **Step 5: Run them to verify they pass**

Run: `npx vitest run tests/setup && npm run typecheck && npm run lint`
Expected: PASS.

Run: `npm test`
Expected: N + 27 passed, 1 skipped (4 in `json.test.ts`, 10 in `merge.test.ts`).

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/setup/json.ts src/setup/merge.ts tests/setup/json.test.ts tests/setup/merge.test.ts
git commit -m "feat(setup): merge the Obsidian settings, asking before overriding the owner's" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The plugin settings and the workspace

**Files:**
- Modify: `src/setup/merge.ts`
- Test: `tests/setup/merge.test.ts`

**Interfaces:**
- Consumes: `Merger`, `mergeFragment`, `isKiln` (below) (Task 3); Task 1's choices arrive as `extra.choices`.
- Produces: the rules for `settings/plugins/iconic.json`, `settings/plugins/templater.json`, `settings/plugins/quickadd.json` and `settings/workspace-file-properties.json`; `isKiln(v: Json): boolean` (an object whose `id` is text starting `kiln-`).

| Fragment | Rule | The owner's |
|---|---|---|
| `plugins/iconic.json` | Set `showAllFileIcons`, `showAllFolderIcons`, `minimalFolderIcons`; set each `fileIcons/<name>` and `propertyIcons/<name>`; `fileRules` becomes the blueprint's rules, then the owner's rules that aren't `kiln-` (so kiln's win) | none |
| `plugins/templater.json` | Set `trigger_on_file_creation_mode`; `folder_templates` becomes the owner's entries for other folders (in order), then, for each blueprint folder, the blueprint's entry, or the owner's when they keep it | `templates_folder`; `folder_templates/<folder>` (compared on `template`) |
| `plugins/quickadd.json` | `choices` becomes the owner's choices without any `kiln-` choice at any depth, then the blueprint's, then `extra.choices`. Every other key stays | none |
| `workspace-file-properties.json` | `workspace.json` missing: `undefined` (skip). Otherwise, under `right`: if a `tabs` group holds a leaf whose `state.type` is `file-properties`, make it that group's `currentTab`; else append the blueprint's leaf to the first `tabs` group and make it current; else add `{ "id": "6b696c6e74616273", "type": "tabs", "children": [<leaf>], "currentTab": 0 }` to `right.children`. Then `right.collapsed: true` becomes `false`. No `right`: unchanged | none |

- [ ] **Step 1: Write the failing tests**, appended to `tests/setup/merge.test.ts` (add the four targets to `TARGET`: `.obsidian/plugins/iconic/data.json`, `.obsidian/plugins/templater-obsidian/data.json`, `.obsidian/plugins/quickadd/data.json`, `.obsidian/workspace.json`; and let `merge` accept `extra` as a fifth argument, default `{ choices: [] }`)

```ts
describe('the plugin settings', () => {
  it("Iconic: kiln's rules first, the owner's kept, old kiln rules gone", () => {
    const current = {
      fileIcons: { Archive: { icon: 'lucide-archive' } },
      fileRules: [{ id: 'mine', name: 'Mine' }, { id: 'kiln-retired', name: 'Old' }],
    };
    const value = merge('settings/plugins/iconic.json', current).value as { fileRules: { id: string }[]; fileIcons: Record<string, unknown> };
    const ids = value.fileRules.map((r) => r.id);
    expect(ids.at(-1)).toBe('mine');
    expect(ids).not.toContain('kiln-retired');
    expect(ids[0]).toMatch(/^kiln-/);
    expect(value.fileIcons.Archive).toEqual({ icon: 'lucide-archive' });
    expect(value.fileIcons.Work).toEqual({ icon: 'lucide-square-check', color: '#8be9fd' });
  });

  it("Templater: asks about the owner's template folder and their template for a kiln folder", () => {
    const current = {
      templates_folder: 'Templates',
      folder_templates: [
        { folder: '', template: '' },
        { folder: 'Journal', template: 'Templates/Journal.md' },
        { folder: 'Work', template: 'Templates/Task.md' },
      ],
    };
    const kept = merge('settings/plugins/templater.json', current);
    expect(kept.overrides.map((o) => o.id)).toEqual([
      '.obsidian/plugins/templater-obsidian/data.json#templates_folder',
      '.obsidian/plugins/templater-obsidian/data.json#folder_templates/Work',
    ]);
    const entries = (kept.value as { folder_templates: { folder: string; template: string }[] }).folder_templates;
    expect(entries.slice(0, 2)).toEqual([{ folder: '', template: '' }, { folder: 'Journal', template: 'Templates/Journal.md' }]);
    expect(entries.find((e) => e.folder === 'Work')).toEqual({ folder: 'Work', template: 'Templates/Task.md' });
    expect(entries.find((e) => e.folder === 'Topics')).toEqual({ folder: 'Topics', template: '_kiln/templates/Topic.md' });
    const taken = merge('settings/plugins/templater.json', current, ['.obsidian/plugins/templater-obsidian/data.json#folder_templates/Work']);
    const work = (taken.value as { folder_templates: { folder: string; template: string }[] }).folder_templates.filter((e) => e.folder === 'Work');
    expect(work).toEqual([{ folder: 'Work', template: '_kiln/templates/Work.md' }]);
  });

  it("QuickAdd: replaces kiln's choices at any depth and keeps the owner's", () => {
    // Typed as Json: inferred, the two choices' shapes union into `choices?: undefined`, which isn't Json.
    const current: Json = {
      choices: [
        { id: 'mine', name: 'My menu', type: 'Multi', choices: [{ id: 'kiln-work-bug', name: 'New bug' }, { id: 'own', name: 'Own' }] },
        { id: 'kiln-capture', name: 'Capture to inbox', type: 'Template' },
      ],
      macros: [],
      migrations: { someMigration: true },
    };
    const generated = [{ id: 'kiln-topic', name: 'New topic', type: 'Template' }];
    const value = merge('settings/plugins/quickadd.json', current, [], {}, { choices: generated }).value as {
      choices: { id: string; choices?: { id: string }[] }[];
      migrations: unknown;
    };
    expect(value.choices.map((c) => c.id)).toEqual(['mine', 'kiln-capture', 'kiln-log', 'kiln-topic']);
    expect(value.choices[0]?.choices?.map((c) => c.id)).toEqual(['own']);
    expect(value.migrations).toEqual({ someMigration: true });
  });

  it('the workspace: File properties becomes the visible tab, once', () => {
    const fresh = {
      main: { id: 'm', type: 'split', children: [] },
      right: {
        id: 'r',
        type: 'split',
        collapsed: true,
        children: [{ id: 't', type: 'tabs', children: [{ id: 'b', type: 'leaf', state: { type: 'backlink', state: {} } }] }],
      },
    };
    const first = merge('settings/workspace-file-properties.json', fresh);
    const right = (first.value as { right: { collapsed: boolean; children: { currentTab: number; children: { state: { type: string } }[] }[] } }).right;
    expect(right.collapsed).toBe(false);
    expect(right.children[0]?.currentTab).toBe(1);
    expect(right.children[0]?.children[1]?.state.type).toBe('file-properties');
    expect(merge('settings/workspace-file-properties.json', first.value).changes).toEqual([]);
  });

  it('the workspace: an existing File properties leaf is made current; no file, no change', () => {
    const leaf = { id: 'p', type: 'leaf', state: { type: 'file-properties', state: {} } };
    const current = { right: { id: 'r', type: 'split', children: [{ id: 't', type: 'tabs', currentTab: 1, children: [leaf, { id: 'o', type: 'leaf' }] }] } };
    const value = merge('settings/workspace-file-properties.json', current).value as { right: { children: { currentTab: number }[] } };
    expect(value.right.children[0]?.currentTab).toBe(0);
    expect(merge('settings/workspace-file-properties.json', undefined).value).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/setup/merge.test.ts`
Expected: FAIL: no rule for the plugin fragments.

- [ ] **Step 3: Implement the four rules**

QuickAdd and Templater's folder templates, which decide the ordering:

```ts
export const isKiln = (v: Json): boolean => isObject(v) && typeof v.id === 'string' && v.id.startsWith('kiln-');

function withoutKiln(choices: Json[]): Json[] {
  return choices
    .filter((c) => !isKiln(c))
    .map((c) => (isObject(c) && Array.isArray(c.choices) ? { ...c, choices: withoutKiln(c.choices) } : c));
}

// quickadd
m.set(o, 'choices', [...withoutKiln(asArray(o.choices ?? [], m)), ...asArray(b.choices, m), ...extra.choices]);

// templater
m.setOwned(o, 'templates_folder', b.templates_folder ?? null);
m.set(o, 'trigger_on_file_creation_mode', b.trigger_on_file_creation_mode ?? null);
const ours = asArray(b.folder_templates, m).filter(isObject);
const folders = new Set(ours.map((e) => e.folder));
const theirs = asArray(o.folder_templates ?? [], m);
const next = theirs.filter((e) => !(isObject(e) && folders.has(e.folder ?? null)));
for (const entry of ours) {
  const own = theirs.find((e): e is JsonObject => isObject(e) && e.folder === entry.folder);
  // Not String(entry.folder): typescript/no-base-to-string rejects it for a Json value.
  const folder = typeof entry.folder === 'string' ? entry.folder : '';
  const useOurs = !own || m.decide(`folder_templates/${folder}`, own.template, entry.template ?? null);
  next.push(useOurs ? entry : own);
}
m.set(o, 'folder_templates', next);
```

The workspace finds `tabs` groups depth-first under `right` (a group is an object with `type: 'tabs'`; recurse into every `children` list). Use `m.set` for `currentTab`, `children` and `collapsed`, with key paths `right/currentTab`, `right/children` and `right/collapsed`.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/setup && npm run typecheck && npm run lint`
Expected: PASS.

Run: `npm test`
Expected: N + 32 passed, 1 skipped (5 new in `merge.test.ts`).

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/setup/merge.ts tests/setup/merge.test.ts
git commit -m "feat(setup): merge Iconic, Templater and QuickAdd settings and the workspace" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The three-way sort and the version record

**Files:**
- Create: `src/setup/files.ts`, `src/setup/record.ts`
- Test: `tests/setup/files.test.ts`

**Interfaces:**
- Consumes: `hash` (Task 2); `Json`, `isObject`, `readJson` (Tasks 1 and 3); `splitFrontmatter` (#83, `src/blueprint/markdown.ts`).
- Produces, in `src/setup/files.ts`:
  - `type FileAction = 'add' | 'update' | 'replace' | 'unchanged' | 'keep' | 'ask' | 'dropped' | 'forget' | 'skip'`.
  - `sortFile(path: string, recorded?: string, vault?: string, blueprint?: string, hasRecord = true): FileAction`: hashes in, the action out (code below). `replace` means "replace, backing up the vault's copy first"; `forget` "drop from the record"; `skip` "not the blueprint's".
  - `usersOf(path: string, notes: { path: string; text: string }[]): string[]`: decision 9, in the order given. The caller supplies the texts (Task 7 reads them; `openVault` lists paths only).
- Produces, in `src/setup/record.ts`:
  - `type SetupRecord = { plugin: string; blueprint: string; files: Record<string, string>; kept: Record<string, Json> }`.
  - `RECORD = '.kiln/blueprint.json'`.
  - `readRecord(vault: string): SetupRecord | undefined`: `undefined` when missing; `kept` defaults to `{}`; anything else malformed throws `` `.kiln/blueprint.json: ${problem}` ``.
  - `writeRecord(vault: string, record: SetupRecord): boolean`: writes `JSON.stringify(record, null, 2) + '\n'` (keys `plugin`, `blueprint`, `files` with its keys sorted, then `kept` only when it has entries), creating `.kiln/`; returns `false` without writing when the file already holds the same value.

- [ ] **Step 1: Write the failing tests** in `tests/setup/files.test.ts`

```ts
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
    ['present, dropped from the blueprint: dropped', R, V, undefined, 'dropped'],
  ] as const)('%s', (_name, recorded, vault, blueprint, action) => {
    expect(sortFile('_kiln/views/x.base', recorded, vault, blueprint, true)).toBe(action);
  });

  it('the cases around it', () => {
    expect(sortFile('_kiln/x.md', R, B, B, true)).toBe('unchanged');
    expect(sortFile('_kiln/x.md', R, undefined, B, true)).toBe('add');
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
    const record = { plugin: 'a1b2c3d4e5f6', blueprint: 'sha256:x', files: { 'b.md': 'sha256:2', 'a.md': 'sha256:1' }, kept: {} };
    expect(readRecord(vault)).toBeUndefined();
    expect(writeRecord(vault, record)).toBe(true);
    expect(readFileSync(join(vault, '.kiln', 'blueprint.json'), 'utf8')).toBe(
      '{\n  "plugin": "a1b2c3d4e5f6",\n  "blueprint": "sha256:x",\n  "files": {\n    "a.md": "sha256:1",\n    "b.md": "sha256:2"\n  }\n}\n',
    );
    expect(readRecord(vault)).toEqual(record);
    expect(writeRecord(vault, record)).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/setup/files.test.ts`
Expected: FAIL: the modules don't exist.

- [ ] **Step 3: Implement `sortFile`**

```ts
/**
 * The three-way sort. `recorded` is what setup installed last time (from the record), `vault` what is
 * in the vault now, `blueprint` what the blueprint has now; each is a hash, or undefined when absent.
 */
export function sortFile(path: string, recorded?: string, vault?: string, blueprint?: string, hasRecord = true): FileAction {
  if (blueprint === undefined) {
    if (recorded === undefined) return 'skip'; // never the blueprint's: the owner's own file
    return vault === undefined ? 'forget' : 'dropped';
  }
  if (vault === undefined) return 'add';
  if (vault === blueprint) return 'unchanged';
  if (recorded === undefined) {
    // No hash to compare with. A vault set up by hand (no record) only ever had the blueprint in _kiln/.
    return !hasRecord && path.startsWith('_kiln/') ? 'replace' : 'ask';
  }
  if (vault === recorded) return 'update';
  if (blueprint === recorded) return 'keep';
  return 'ask';
}
```

Then `usersOf` (the link name is the file name without `.md`, or with its extension for other files, matched as `[[<name>` case-insensitively with regex characters escaped; for `_kiln/types/<name>.md`, a type is matched with `/^type:\s*<name>\s*$/m` on `splitFrontmatter(text).frontmatter`), and `src/setup/record.ts` (`readJson` from Task 3, narrowed from `Json`: `plugin` and `blueprint` text, `files` a map of text, `kept` an object or missing).

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/setup && npm run typecheck && npm run lint`
Expected: PASS.

Run: `npm test`
Expected: N + 40 passed, 1 skipped (8 in `files.test.ts`: 5 from the `it.each` table, 3 more).

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/setup/files.ts src/setup/record.ts tests/setup/files.test.ts
git commit -m "feat(setup): the three-way sort and the version record" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The checks: plugins, the Obsidian CLI, Obsidian running

**Files:**
- Create: `src/setup/checks.ts`
- Test: `tests/setup/checks.test.ts`

**Interfaces:**
- Consumes: `Requires` (Task 2); `type Env` (#81, `src/vault/paths.ts`). `envValue` matches a key exactly, so `PATH` is looked up by hand.
- Produces, in `src/setup/checks.ts`:
  - `compareVersions(a: string, b: string): number`: numeric by dot part, missing parts as 0, anything from the first `-` ignored (`2.25.2-beta.0` is `2.25.2`).
  - `type PluginCheck = { id: string; version: string | null; minimum: string; status: 'ok' | 'old' | 'missing' }`.
  - `checkPlugins(vault: string, requires: Requires): PluginCheck[]`: in `requires.plugins` order. `missing` unless `.obsidian/plugins/<id>/manifest.json` and `main.js` both exist and the manifest has a text `version`.
  - `findObsidianCli(env: Env, platform: NodeJS.Platform): string | null`: the first folder on `PATH` (the key found case-insensitively; split on `;` on Windows, `:` elsewhere) holding `Obsidian.com` (Windows) or `obsidian`; its full path.
  - `type Exec = (command: string, args: string[]) => { status: number | null; stdout: string; error?: Error }`.
  - `isObsidianRunning(platform: NodeJS.Platform, exec: Exec): boolean | null`: decision 6; `null` when the command can't run (an `error`, or a status other than 0 or 1 for `pgrep`).

- [ ] **Step 1: Write the failing tests** in `tests/setup/checks.test.ts`

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkPlugins, compareVersions, findObsidianCli, isObsidianRunning, type Exec } from '../../src/setup/checks.js';

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
    const requires = { obsidian: '1.14.0', plugins: { iconic: '1.1.10', 'templater-obsidian': '2.26.0', quickadd: '2.32.0', homepage: '4.5.0' } };
    expect(checkPlugins(dir, requires)).toEqual([
      { id: 'iconic', version: '1.1.10', minimum: '1.1.10', status: 'ok' },
      { id: 'templater-obsidian', version: null, minimum: '2.26.0', status: 'missing' },
      { id: 'quickadd', version: '2.31.0', minimum: '2.32.0', status: 'old' },
      { id: 'homepage', version: null, minimum: '4.5.0', status: 'missing' },
    ]);
  });
});

describe('the Obsidian CLI', () => {
  it('is found on PATH as Obsidian.com on Windows, obsidian elsewhere', () => {
    const bin = join(dir, 'bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'Obsidian.com'), '');
    expect(findObsidianCli({ Path: `${join(dir, 'nothing')};${bin}` }, 'win32')).toBe(join(bin, 'Obsidian.com'));
    expect(findObsidianCli({ PATH: bin }, 'linux')).toBeNull();
    writeFileSync(join(bin, 'obsidian'), '');
    expect(findObsidianCli({ PATH: bin }, 'linux')).toBe(join(bin, 'obsidian'));
  });
});

describe('isObsidianRunning', () => {
  const calls: string[][] = [];
  const exec = (result: ReturnType<Exec>): Exec => (command, args) => {
    calls.push([command, ...args]);
    return result;
  };

  it('asks tasklist on Windows', () => {
    expect(isObsidianRunning('win32', exec({ status: 0, stdout: '"Obsidian.exe","1234","Console","1","250,000 K"\r\n' }))).toBe(true);
    expect(isObsidianRunning('win32', exec({ status: 0, stdout: 'INFO: No tasks are running which match the specified criteria.\r\n' }))).toBe(false);
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
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/setup/checks.test.ts`
Expected: FAIL: `checks.js` doesn't exist.

- [ ] **Step 3: Implement `src/setup/checks.ts`**

`checkPlugins` parses each manifest with `readJson` (Task 3) and treats a broken one as missing. `findObsidianCli` takes the value of the first key of `env` that is `PATH` when upper-cased, splits it on `;` for `win32` and `:` otherwise, skips blank entries, and returns the first `join(folder, name)` that `existsSync` finds. `isObsidianRunning` on `win32` is true when any output line, trimmed, starts with `"Obsidian.exe"` (case-insensitively), false for status 0 otherwise; elsewhere it is true for status 0 and false for 1.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/setup && npm run typecheck && npm run lint`
Expected: PASS.

Run: `npm test`
Expected: N + 46 passed, 1 skipped (6 in `checks.test.ts`).

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/setup/checks.ts tests/setup/checks.test.ts
git commit -m "feat(setup): check the plugins, the Obsidian CLI and whether Obsidian is running" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `planSetup` and `applySetup`

**Files:**
- Create: `src/setup/setup.ts`
- Modify: `tests/setup/fixture.ts`
- Test: `tests/setup/setup.test.ts`, `tests/setup/reapply.test.ts`

**Interfaces:**
- Consumes: everything above; `readDefinitions` (#83, `src/blueprint/load.ts`); `openVault` (#83, `src/check/vault.ts`); `expandHome`, `pathKey` (#81, `src/vault/paths.ts`); `readKilnConfig`, `recordVault`, `type KilnConfig` (#81, `src/vault/config.ts`).
- Produces, in `src/setup/setup.ts`:

```ts
export type FetchResponse = { ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> };
export type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<FetchResponse>;

export type SetupOptions = {
  vault: string; // absolute
  pluginRoot: string; // the folder holding blueprint/
  platform: NodeJS.Platform;
  home: string; // expands a recorded "~/…" path, as the resolver does
  obsidianRunning: boolean | null;
  confirmClosed?: boolean;
  cliPath: string | null;
  kilnConfig: string; // the kiln file to record the vault in
  take?: readonly string[];
  sample?: boolean;
  name?: string;
  makeDefault?: boolean;
  fetch: Fetch; // used only for the sample (Task 8)
  now: Date; // names the backup folder
};

export type FileStep = { path: string; action: 'add' | 'update' | 'replace' | 'keep' | 'ask' | 'dropped' | 'wait'; backup?: string; usedBy?: string[] };
export type SettingStep = { file: string; key: string; action: 'set' | 'keep' | 'ask' | 'wait'; from?: Json; to?: Json };
export type Ask = { id: string; current: Json; blueprint: Json }; // a file's are its two texts
export type SetupReport = {
  vault: string;
  mode: 'setup' | 'reapply';
  plugin: string;
  blueprint: string;
  applied: boolean;
  stop: string[];
  warnings: string[];
  plugins: PluginCheck[];
  obsidian: { running: boolean | null; minimum: string };
  cli: string | null;
  folders: { path: string; action: 'add' | 'wait' }[];
  files: FileStep[]; // every action but unchanged
  unchanged: number;
  settings: SettingStep[];
  asks: Ask[];
  vaultOnlyTypes: string[];
  sample: { source: string; files: string[]; skipped: string[] } | { notes: number } | null;
  kiln: { name: string; config: string; recorded: 'new' | 'already' | 'skipped'; default: string | null };
  permissions: { additionalDirectories: string[]; ask: string[] };
};

export function planSetup(options: SetupOptions): SetupReport;
export function applySetup(options: SetupOptions): Promise<SetupReport>;
export function permissionRules(vault: string, platform: NodeJS.Platform): SetupReport['permissions'];
export function vaultName(
  vault: string,
  config: KilnConfig | undefined,
  where: { platform: NodeJS.Platform; home: string },
  wanted?: string,
): { name: string; recorded: boolean } | { error: string };
```

**Behaviour.**

- **Mode:** `reapply` when `.kiln/blueprint.json` or `_kiln/types/` exists, else `setup`. `plugin` is `basename(resolve(pluginRoot))`; `blueprint` is `blueprintHash(<pluginRoot>/blueprint)`.
- **`stop`** (exact texts; `apply` writes nothing when any is present):
  - `` `${vault} doesn't exist` `` / `` `${vault} isn't a folder` ``.
  - `` `${vault} isn't an Obsidian vault yet: open it in Obsidian first (Getting started, section 2)` `` when `.obsidian/` is missing.
  - (Each of these three is the only entry: the report stops there, with empty steps.)
  - per missing plugin: `` `${id} isn't installed: .obsidian/plugins/${id}/ needs manifest.json and main.js. Install it and turn it on in Obsidian (Getting started, section 2)` ``.
  - any `readJson` or `readRecord` error, as thrown, followed by `; fix or remove it, then run setup again`.
  - mode `setup` with `obsidianRunning` `true`: `Obsidian is running. Setup needs it closed, because QuickAdd and Homepage read their settings only when Obsidian starts. Quit Obsidian (with Run in Background installed, use the tray's Close Vault), then run setup again.`
  - mode `setup` with `obsidianRunning` `null` and no `confirmClosed`: `Couldn't tell whether Obsidian is running. Ask the owner, and pass --confirm-closed once it is closed.`
  - `name`'s `error` from `vaultName`.
- **`warnings`:** each `old` plugin: `` `${id} ${version} is older than ${minimum}, the oldest the blueprint is written for. Update it in Obsidian.` ``; no CLI: `The Obsidian CLI isn't on PATH. kiln's other skills need it: in Obsidian, turn on Settings → General → Command line interface, then restart the terminal and Claude.`; re-apply with Obsidian running (or unknown and not confirmed): `Obsidian is running, so only _kiln/, Iconic and Templater are changed. The rest waits: close Obsidian and run setup again.`; `workspace.json` missing: `.obsidian/workspace.json doesn't exist yet, so File properties isn't opened in the right sidebar. Getting started, section 4, says how.`; each `--take` id that matched nothing: `` `--take ${id} matched nothing` ``.
- **Open:** when re-applying with Obsidian running (or unknown and not confirmed), every folder, file and setting target where `isLive` is false gets action `wait`, and isn't written.
- **Folders:** each `folder` in `readDefinitions(<pluginRoot>/blueprint)` that doesn't exist in the vault: `add`.
- **Files:** `sortFile` for every path in `installedFiles` and in the record's `files`. An `ask` becomes `replace` when its id (the path) is in `take`; otherwise `keep` (not asked) when `kept[path]` equals the blueprint's hash. `dropped` files carry `usedBy`: `usersOf(path, notes)`, where `notes` is `openVault(vault).notes` with each note's text read from the vault (`openVault` lists paths only). If `openVault` throws (the vault's `_kiln/` isn't a readable blueprint), `usedBy` is omitted. `replace` carries `backup`: `.kiln/backup/<now as YYYY-MM-DDTHH-mm-ss, UTC>/<path>`. An `ask` contributes an `Ask` of the two texts.
- **Settings:** for each `SETTINGS` entry, `mergeFragment` over the target's current value, with `kindChoices` as `extra.choices` for QuickAdd. Each `Change` is a `set` step; each override not taken is a `keep` step (and, when `asked`, an `Ask` and the step's action is `ask` in the plan). `mergeFragment` returning `undefined` skips the target.
- **`vaultOnlyTypes`:** names of `_kiln/types/*.md` in the vault that are neither in the blueprint nor in the record.
- **`kiln`:** `config` is `readKilnConfig(kilnConfig)`. `vaultName`, in order:
  1. the name of the first entry whose path, after `expandHome(path, home)`, is absolute and has the vault's `pathKey(…, platform)` (an entry that isn't absolute matches nothing, as in the resolver): `{ name, recorded: true }`;
  2. else `wanted`, which must match `^[A-Za-z0-9][A-Za-z0-9._-]*$` (else the error `` `vault names use letters, digits, ".", "-" and "_": "${wanted}"` ``, `recordVault`'s own message) and must not name another entry (else `` `vault name "${wanted}" is already ${path} in the kiln file; choose another with --name` ``, `path` as recorded);
  3. else decision 12 from `basename(vault)`, adding `-2`, `-3`… while an entry has the name.
  An `error` becomes a `stop` entry as it is. `recorded` is `already` when the folder already has that name and the default stays the same (`makeDefault` is unset, or it is already the default); `skipped` when `readKilnConfig` throws (warning `` `can't record the vault: ${kilnConfig} ${message}` ``); else `new`. `default` is what the kiln file's default is, or will be, after apply: this name when `makeDefault` is set or the file has no default (the first vault recorded becomes the default), else the file's default; `null` when `skipped`.
- **Order:** `files` is sorted by path; `settings` follows `SETTINGS`, then change order.
- **`permissions`:** `permissionRules`: `additionalDirectories: [vault]`; `ask: [Edit(/<posix>/.obsidian/**), Edit(/<posix>/_kiln/**)]`, where `<posix>` is the vault with `\` as `/` and, on Windows, `D:` as `/d` (no trailing `/`).
- **`applySetup`** recomputes the plan with the same options, returns it unwritten if `stop` has entries, else writes in this order: folders; backups, then files (creating parents); settings that changed (`obsidianJson`; created with their folders when missing); the record; then `recordVault(kilnConfig, name, vault, { makeDefault })` unless `recorded` is `already` or `skipped` (by then `_kiln/types/` exists, which `recordVault` requires). If `recordVault` throws, the report's `kiln.recorded` becomes `skipped`, `default` `null`, and the warning `` `can't record the vault: ${message}` `` is added; nothing already written is undone. The record's `files`: the blueprint hash for `add`, `update`, `replace` and unchanged files; the recorded hash for `keep`, `wait` and kept `ask` files (omitted if none); `dropped` and `forget` files are left out. `kept`: every override and file not taken, with its blueprint value (a file's is its hash). The returned report has `applied: true`, and the same steps with `ask` reported as `keep`.

- [ ] **Step 1: Extend the fixture** in `tests/setup/fixture.ts`

- `FRESH: Record<string, unknown>`: what Obsidian and the plugins leave in a just-made vault (exploratory: no trial pinned these), keyed by path under `.obsidian/`:
  - `app.json`: `{}`; `appearance.json`: `{}`;
  - `core-plugins.json`: `{ "file-explorer": true, "global-search": true, "switcher": true, "graph": true, "backlink": true, "outgoing-link": true, "tag-pane": true, "properties": true, "page-preview": true, "daily-notes": true, "templates": true, "command-palette": true, "bookmarks": true, "outline": true, "word-count": true, "file-recovery": true, "bases": true }`;
  - `community-plugins.json`: the four ids;
  - `types.json`: `{ "types": { "aliases": "aliases", "cssclasses": "multitext", "tags": "tags" } }`;
  - `plugins/templater-obsidian/data.json`: `{ "templates_folder": "", "trigger_on_file_creation": false, "folder_templates": [{ "folder": "", "template": "" }] }`;
  - `plugins/homepage/data.json`: `{ "version": 4, "homepages": { "Main Homepage": { "value": "Home", "kind": "File", "openOnStartup": true } } }`;
  - `workspace.json`: a `right` split, collapsed, with one `tabs` group holding a backlink leaf (as in Task 4's test).
- `type TestVault = { root: string; vault: string; configFile: string; options(o?: Partial<SetupOptions>): SetupOptions; write(path: string, text: string): void; read(path: string): string; json(path: string): unknown }`.
- `testVault(o?: { plugins?: Record<string, string | null>; fresh?: boolean }): TestVault`: `root` is a new temporary folder; `vault` is `<root>/Trial Vault` (a space, on purpose); each of the four plugins gets `manifest.json` (`{ id, version }`) and `main.js`, at its `requires.json` minimum unless `plugins` says another version or `null` (not installed); `fresh` (default true) writes `FRESH`. `configFile` is `<root>/kiln-home/config.json`. `options(o)` returns `{ vault, pluginRoot: PLUGIN_ROOT, platform: process.platform, home: root, obsidianRunning: false, cliPath: 'D:\\apps\\Obsidian\\Obsidian.com', kilnConfig: configFile, fetch: offline, now: new Date('2026-10-12T09:30:00Z'), ...o }`, where `offline` rejects with `no network in tests`. `write`, `read` and `json` take vault-relative `/` paths.
- `fingerprint(dir: string): string`: a hash of every file's relative path, bytes and `mtimeMs` under `dir`.

- [ ] **Step 2: Write the failing tests** in `tests/setup/setup.test.ts`

```ts
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
    expect(plan).toMatchObject({ mode: 'setup', plugin: 'claude-plugin', applied: false, stop: [], asks: [], warnings: [] });
    expect(plan.folders.map((f) => f.path)).toContain('Work');
    expect(plan.files).toContainEqual({ path: '_kiln/templates/kinds/Work bug.md', action: 'add' });
    expect(plan.files).toContainEqual({ path: 'Home.md', action: 'add' });
    expect(existsSync(join(t.vault, '_kiln'))).toBe(false);
  });

  it('applies: the blueprint, the settings, the record and the kiln file', async () => {
    const report = await applySetup(t.options());
    expect(report.applied).toBe(true);
    expect(t.read('_kiln/types/work.md')).toBe(readFileSync(join(PLUGIN_ROOT, 'blueprint', 'types', 'work.md'), 'utf8'));
    expect(existsSync(join(t.vault, 'Work'))).toBe(true);
    const app = t.read('.obsidian/app.json');
    expect(app.endsWith('}')).toBe(true);
    expect(app).not.toContain('\r');
    expect(JSON.parse(app)).toMatchObject({ alwaysUpdateLinks: true, newFileFolderPath: 'Inbox' });
    const quickadd = t.json('.obsidian/plugins/quickadd/data.json') as { choices: { id: string }[] };
    expect(quickadd.choices.map((c) => c.id)).toEqual(expect.arrayContaining(['kiln-capture', 'kiln-log', 'kiln-work-menu', 'kiln-topic']));
    const record = t.json('.kiln/blueprint.json') as { plugin: string; blueprint: string; files: Record<string, string> };
    expect(record.plugin).toBe('claude-plugin');
    expect(record.blueprint).toBe(blueprintHash(join(PLUGIN_ROOT, 'blueprint')));
    expect(record.files['Home.md']).toBe(hash(t.read('Home.md')));
    expect(JSON.parse(readFileSync(t.configFile, 'utf8'))).toEqual({ default: 'Trial-Vault', vaults: { 'Trial-Vault': t.vault } });
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
    expect(report.warnings).toContain('homepage 4.4.4 is older than 4.5.0, the oldest the blueprint is written for. Update it in Obsidian.');
  });

  it('Obsidian running, or unknown until the owner confirms', () => {
    const t = testVault();
    expect(planSetup(t.options({ obsidianRunning: true })).stop[0]).toMatch(/^Obsidian is running\. Setup needs it closed/);
    expect(planSetup(t.options({ obsidianRunning: null })).stop).toEqual([
      "Couldn't tell whether Obsidian is running. Ask the owner, and pass --confirm-closed once it is closed.",
    ]);
    expect(planSetup(t.options({ obsidianRunning: null, confirmClosed: true })).stop).toEqual([]);
  });

  it('a settings file that is not valid JSON, named', () => {
    const t = testVault();
    t.write('.obsidian/app.json', '{ "showInlineTitle": tru }');
    expect(planSetup(t.options()).stop[0]).toMatch(/app\.json: not valid JSON: .*; fix or remove it, then run setup again$/);
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
    expect(taken.files).toContainEqual({ path: 'Home.md', action: 'replace', backup: '.kiln/backup/2026-10-12T09-30-00/Home.md' });
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
    expect(permissionRules('/home/sam/notes/', 'linux').ask).toEqual(['Edit(//home/sam/notes/.obsidian/**)', 'Edit(//home/sam/notes/_kiln/**)']);
  });
});
```

(`vaultName` and `permissionRules` take `platform` so tests can pin it. `vaultName` compares folders with #81's `pathKey(path, platform)`, which resolves with the running system's `node:path` and lower-cases on Windows and macOS; `permissionRules` is string work only, so its Windows case runs on any system.)

In `tests/setup/reapply.test.ts`:

```ts
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { applySetup, planSetup } from '../../src/setup/setup.js';
import { cleanupAll, pluginCopy, testVault } from './fixture.js';

afterAll(cleanupAll);

describe('re-applying a changed blueprint', () => {
  it('sorts every case three ways', async () => {
    const t = testVault();
    await applySetup(t.options({ pluginRoot: pluginCopy('a1b2c3d4e5f6') }));
    t.write('_kiln/templates/Topic.md', 'my topic template\n');
    t.write('_kiln/views/today.base', 'my today\n');
    t.write('_kiln/types/runbook.md', '---\ntype: kiln-type\nname: runbook\nfolder: Runbooks\nnaming: title\n---\nA how-to.\n');
    // Project has no kinds, so its template has no picker to keep.
    const next = pluginCopy('0f9e8d7c6b5a', (bp) => {
      writeFileSync(join(bp, 'templates', 'Project.md'), 'new project template\n');
      writeFileSync(join(bp, 'views', 'today.base'), 'new today\n');
      writeFileSync(join(bp, 'views', 'new-view.base'), 'filters: {}\n');
      rmSync(join(bp, 'views', 'inbox.base'));
    });
    const plan = planSetup(t.options({ pluginRoot: next }));
    const action = (path: string) => plan.files.find((f) => f.path === path);
    expect(action('_kiln/templates/Project.md')).toEqual({ path: '_kiln/templates/Project.md', action: 'update' });
    expect(action('_kiln/templates/Topic.md')).toEqual({ path: '_kiln/templates/Topic.md', action: 'keep' });
    expect(action('_kiln/views/today.base')).toEqual({ path: '_kiln/views/today.base', action: 'ask' });
    expect(action('_kiln/views/new-view.base')).toEqual({ path: '_kiln/views/new-view.base', action: 'add' });
    expect(action('_kiln/views/inbox.base')).toEqual({ path: '_kiln/views/inbox.base', action: 'dropped', usedBy: ['Home.md'] });
    expect(plan.asks).toEqual([{ id: '_kiln/views/today.base', current: 'my today\n', blueprint: 'new today\n' }]);
    expect(plan.vaultOnlyTypes).toEqual(['runbook']);

    await applySetup(t.options({ pluginRoot: next }));
    expect(t.read('_kiln/views/today.base')).toBe('my today\n');
    expect(t.read('_kiln/views/inbox.base')).not.toBe('');
    expect(t.json('.kiln/blueprint.json')).toMatchObject({ plugin: '0f9e8d7c6b5a' });
    // The owner's two edits stay theirs, and nothing is asked again; the dropped view is reported once.
    expect(planSetup(t.options({ pluginRoot: next }))).toMatchObject({
      asks: [],
      files: [
        { path: '_kiln/templates/Topic.md', action: 'keep' },
        { path: '_kiln/views/today.base', action: 'keep' },
      ],
    });
  });

  it('with Obsidian open, changes only _kiln/, Iconic and Templater, and the rest waits', async () => {
    const t = testVault();
    await applySetup(t.options({ pluginRoot: pluginCopy('a1b2c3d4e5f6') }));
    const next = pluginCopy('0f9e8d7c6b5a', (bp) => {
      writeFileSync(join(bp, 'templates', 'Project.md'), 'new project template\n');
      writeFileSync(join(bp, 'root', 'Home.md'), 'new home\n');
    });
    t.write('.obsidian/app.json', '{}');
    const open = await applySetup(t.options({ pluginRoot: next, obsidianRunning: true }));
    expect(open.stop).toEqual([]);
    expect(open.files).toEqual([
      { path: 'Home.md', action: 'wait' },
      { path: '_kiln/templates/Project.md', action: 'update' },
    ]);
    const app = open.settings.filter((s) => s.file === '.obsidian/app.json');
    expect(app.length).toBeGreaterThan(0);
    expect(app.every((s) => s.action === 'wait')).toBe(true);
    expect(t.read('_kiln/templates/Project.md')).toBe('new project template\n');
    expect(t.read('Home.md')).not.toBe('new home\n');

    const closed = await applySetup(t.options({ pluginRoot: next }));
    expect(closed.files).toEqual([{ path: 'Home.md', action: 'update' }]);
    expect(t.read('Home.md')).toBe('new home\n');
  });

  it('a vault set up by hand, with no record: _kiln/ is the blueprint’s, Home.md is asked about', async () => {
    const t = testVault();
    await applySetup(t.options());
    rmSync(join(t.vault, '.kiln'), { recursive: true });
    t.write('_kiln/types/work.md', 'an older definition\n');
    t.write('Home.md', 'edited home\n');
    const plan = planSetup(t.options());
    expect(plan.files).toEqual(
      expect.arrayContaining([
        { path: '_kiln/types/work.md', action: 'replace', backup: '.kiln/backup/2026-10-12T09-30-00/_kiln/types/work.md' },
        { path: 'Home.md', action: 'ask' },
      ]),
    );
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run tests/setup/setup.test.ts tests/setup/reapply.test.ts`
Expected: FAIL: `setup.js` doesn't exist.

- [ ] **Step 4: Implement `src/setup/setup.ts`** by the behaviour above. Keep the plan pure: one `prepare(options)` builds the report and a list of pending writes; `planSetup` returns its report; `applySetup` runs the writes. The sample part (`options.sample`) is Task 8: until then, `sample` is `null`. Until Task 8 adds its `await`, `applySetup` can't be an `async` function (`typescript/require-await`): return `Promise.resolve(report)` from a plain function, and make it `async` in Task 8.

The blueprint's QuickAdd choices for `kindChoices` come from the parsed fragment: `isObject(fragment) && Array.isArray(fragment.choices) ? fragment.choices.filter(isChoice) : []`.

- [ ] **Step 5: Run them to verify they pass**

Run: `npx vitest run tests/setup && npm run typecheck && npm run lint`
Expected: PASS.

Run: `npm test`
Expected: N + 61 passed, 1 skipped (12 in `setup.test.ts`, 3 in `reapply.test.ts`).

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/setup/setup.ts tests/setup/fixture.ts tests/setup/setup.test.ts tests/setup/reapply.test.ts
git commit -m "feat(setup): plan and apply the blueprint, three-way, and record the vault" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The sample, on request

**Files:**
- Create: `src/setup/sample.ts`
- Modify: `src/setup/setup.ts`, `tests/setup/fixture.ts`
- Test: `tests/setup/sample.test.ts`

**Interfaces:**
- Consumes: `Fetch` (Task 7).
- Produces, in `src/setup/sample.ts`:
  - `REPO = 'Kieranties/kiln'`; `SAMPLE_PATH = 'tests/fixtures/layer1'`.
  - `type SampleFile = { path: string; text: string }` (`path` relative to the sample, with `/`).
  - `loadSample(pluginRoot: string, fetch: Fetch): Promise<{ source: string; files: SampleFile[] }>`, sorted by path. Decision 10:
    - `<pluginRoot>/../tests/fixtures/layer1` exists: read it; `source` is `local`.
    - else the plugin version (`basename(resolve(pluginRoot))`) must match `/^[0-9a-f]{7,40}$/`, or throw `` `can't pin the sample: the plugin version "${version}" isn't a commit` ``.
    - `GET https://api.github.com/repos/Kieranties/kiln/commits/<version>` → `sha`; `GET https://api.github.com/repos/Kieranties/kiln/git/trees/<sha>?recursive=1` → each `blob` under `tests/fixtures/layer1/` (a `truncated: true` listing throws `the sample's file list was cut short`); `GET https://raw.githubusercontent.com/Kieranties/kiln/<sha>/<path, each segment encodeURIComponent'd>`. Headers `Accept: application/vnd.github+json` and `User-Agent: kiln-setup` on the API calls. A response that isn't `ok` throws `` `can't fetch the sample: ${status} ${url}` ``. `source` is `github:Kieranties/kiln@<sha>`.
- Modifies `planSetup`/`applySetup`:
  - plan with `sample`: `sample` is `{ notes: <the vault's .md files outside dot-folders and _kiln/, other than Home.md> }`; and `stop` gains `The sample is written as plain files, which needs Obsidian closed (Templater would run on new notes). Close Obsidian, then run setup again.` when Obsidian is running or unknown and not confirmed, in either mode.
  - apply with `sample`: `loadSample` runs **before anything is written**; a throw becomes a `stop` entry (its message) and nothing is written. Then each sample file is written after the blueprint, unless a file is already at that path (`skipped`). `sample` is `{ source, files, skipped }`. Sample files are not in the record.
- Produces, in `tests/setup/fixture.ts`: `fakeGitHub(version: string, options?: { fail?: string }): Fetch & { urls: string[] }`: records every URL in `urls`, and serves the three endpoints from `tests/fixtures/layer1` for the full SHA `version.padEnd(40, '0')` (the commits endpoint answers for `version` itself); any URL containing `options.fail` answers `{ ok: false, status: 403 }`; any other URL rejects with an `Error`. Write it, and each response's `json()` and `text()`, as plain functions returning `Promise.resolve(...)` or `Promise.reject(new Error(...))`: `typescript/require-await` applies to tests, so an `async` function without `await` fails lint.
- `applySetup` becomes `async` here, since it now awaits `loadSample`.

- [ ] **Step 1: Write the failing tests** in `tests/setup/sample.test.ts`

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadSample } from '../../src/setup/sample.js';
import { applySetup, planSetup } from '../../src/setup/setup.js';
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
    expect(files.find((f) => f.path === 'People/Priya Raman.md')?.text).toBe(readFileSync(join(SAMPLE, 'People', 'Priya Raman.md'), 'utf8'));
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
    expect(Object.keys((t.json('.kiln/blueprint.json') as { files: object }).files)).not.toContain('People/Priya Raman.md');
  });

  it('writes nothing at all when the fetch fails halfway', async () => {
    const t = testVault();
    const before = fingerprint(t.root);
    const report = await applySetup(
      t.options({ sample: true, pluginRoot: pluginCopy(SHA), fetch: fakeGitHub(SHA, { fail: 'Priya%20Raman' }) }),
    );
    expect(report.applied).toBe(false);
    expect(report.stop[0]).toMatch(/^can't fetch the sample: 403 https:\/\/raw\.githubusercontent\.com\/.*Priya%20Raman\.md$/);
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/setup/sample.test.ts`
Expected: FAIL: `sample.js` doesn't exist.

- [ ] **Step 3: Implement `src/setup/sample.ts`, the fixture's `fakeGitHub`, and the sample steps in `setup.ts`**

`loadSample` narrows the API answers from `unknown`: the commit's `sha` is text; the tree's `tree` is a list of `{ path: string; type: string }`, of which it keeps `type === 'blob'` under `tests/fixtures/layer1/`. Local files are read with `readdirSync(dir, { recursive: true, withFileTypes: true })`, paths joined with `/`.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/setup && npm run typecheck && npm run lint`
Expected: PASS.

Run: `npm test`
Expected: N + 68 passed, 1 skipped (7 in `sample.test.ts`).

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/setup/sample.ts src/setup/setup.ts tests/setup/fixture.ts tests/setup/sample.test.ts
git commit -m "feat(setup): load the sample on request, pinned to the plugin's commit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `kiln-setup.mjs`

**Files:**
- Create: `src/setup/run.ts`, `src/cli/kiln-setup.ts`, `claude-plugin/scripts/kiln-setup.mjs` (generated)
- Test: `tests/setup/run.test.ts`, `tests/setup/bundle.test.ts`

**Interfaces:**
- Consumes: `planSetup`, `applySetup`, `Fetch` (Tasks 7–8); `findObsidianCli`, `isObsidianRunning` (Task 6); `type Where`, `expandHome`, `envValue` (#81, `src/vault/paths.ts`); `kilnConfigPath` (#81, `src/vault/config.ts`); `scripts/build.mjs` (#83), which picks up any new `src/cli/*.ts` with no change.
- Produces:
  - `USAGE` (exact text) and `type RunContext = Where & { pluginRoot: string; obsidianRunning: boolean | null; fetch: Fetch; now: Date }` in `src/setup/run.ts`.
  - `runSetup(argv: string[], context: RunContext): Promise<{ output: string; exitCode: 0 | 1 | 2 }>`, shaped like #81's `runVault`. `parseArgs` from `node:util` (`allowPositionals: true`, strict, inside `try`): exactly one positional, `plan` or `apply`; options `vault` (string), `take` (string, `multiple`), `name` (string), `sample`, `default`, `confirm-closed`, `help` (`-h`) (booleans). A parse error, any other positional or more than one, no `--vault`, a blank one, or `--help`: exit 2 and `USAGE`. The vault is `resolve(cwd, expandHome(value, home))`. `SetupOptions` gets `platform` and `home` from the context, `cliPath: findObsidianCli(env, platform)`, `kilnConfig: kilnConfigPath(context)`, `take: values.take ?? []`, `makeDefault: values.default`, `confirmClosed: values['confirm-closed']`. Output is `JSON.stringify(report, null, 2)`; exit 1 when `stop` has entries, else 0. Any thrown error is `JSON.stringify({ error: message }, null, 2)` with exit 1.
  - `src/cli/kiln-setup.ts`: the plugin root is `fileURLToPath(new URL('..', import.meta.url))` (the bundle lives in `<plugin>/scripts/`). `obsidianRunning` is `false` or `true` when `envValue(process.env, 'KILN_OBSIDIAN_RUNNING')` is `0` or `1` (a test hook: say so in a comment), else `isObsidianRunning(process.platform, exec)` with `exec` wrapping `spawnSync(command, args, { encoding: 'utf8', windowsHide: true })`. Passes `process.cwd()`, `process.env`, `homedir()`, `process.platform`, `fetch: (url, init) => fetch(url, init)` and `new Date()`; awaits `runSetup` at the top level (the bundle is ESM), writes `output + '\n'` and sets `process.exitCode`, as `src/cli/kiln-vault.ts` does.

`USAGE`:

```
Usage: node kiln-setup.mjs plan|apply --vault <folder> [options]
  plan                 show what setup would change, and what it would ask
  apply                make the changes
  --vault <folder>     the vault folder
  --take <id>          replace the owner's setting or file <id> with the blueprint's (repeatable)
  --sample             also load the Northwind Arena sample (a trial vault only)
  --name <name>        the vault's name in ~/.kiln/config.json
  --default            make it the default vault in ~/.kiln/config.json
  --confirm-closed     the owner says Obsidian is closed (when the check can't tell)
Prints JSON. Exit code: 0 done, 1 stopped (see "stop"), 2 bad arguments.
```

- [ ] **Step 1: Write the failing tests**

`tests/setup/run.test.ts`:

```ts
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runSetup, USAGE, type RunContext } from '../../src/setup/run.js';
import { cleanupAll, PLUGIN_ROOT, testVault } from './fixture.js';

afterAll(cleanupAll);
const t = testVault();
const context = (o: Partial<RunContext> = {}): RunContext => ({
  cwd: t.root,
  env: { KILN_HOME: join(t.root, 'kiln-home') },
  home: t.root,
  platform: process.platform,
  pluginRoot: PLUGIN_ROOT,
  obsidianRunning: false,
  fetch: () => Promise.reject(new Error('no network in tests')),
  now: new Date('2026-10-12T09:30:00Z'),
  ...o,
});

describe('runSetup', () => {
  it('plans a vault given relative to the current folder, or with ~', async () => {
    for (const vault of ['Trial Vault', 'Trial Vault/', '~/Trial Vault']) {
      const { output, exitCode } = await runSetup(['plan', '--vault', vault], context());
      expect(exitCode, vault).toBe(0);
      expect(JSON.parse(output)).toMatchObject({ vault: t.vault, mode: 'setup', applied: false });
    }
  });

  it('applies, taking the ids it is given', async () => {
    t.write('Home.md', 'mine\n');
    const { output } = await runSetup(['apply', '--vault', t.vault, '--take', 'Home.md'], context());
    expect(JSON.parse(output)).toMatchObject({ applied: true, kiln: { config: join(t.root, 'kiln-home', 'config.json') } });
    expect(t.read('.kiln/backup/2026-10-12T09-30-00/Home.md')).toBe('mine\n');
  });

  it('exits 1 with the stop reasons', async () => {
    const { output, exitCode } = await runSetup(['plan', '--vault', join(t.root, 'nowhere')], context());
    expect(exitCode).toBe(1);
    expect(JSON.parse(output)).toMatchObject({ stop: [`${join(t.root, 'nowhere')} doesn't exist`] });
  });

  it('exits 2 with usage for bad arguments', async () => {
    for (const argv of [[], ['plan'], ['check', '--vault', 'x'], ['plan', '--vault', ' '], ['apply', '--vault', 'x', '--frobnicate'], ['--help']]) {
      expect(await runSetup(argv, context()), argv.join(' ')).toEqual({ output: USAGE, exitCode: 2 });
    }
  });
});
```

`tests/setup/bundle.test.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupAll, fingerprint, testVault } from './fixture.js';

const BUNDLE = fileURLToPath(new URL('../../claude-plugin/scripts/kiln-setup.mjs', import.meta.url));
const OVERRIDDEN = ['KILN_VAULT', 'KILN_HOME', 'KILN_OBSIDIAN_RUNNING', 'HOME', 'USERPROFILE'];
afterAll(cleanupAll);

const t = testVault();
// Windows variable names ignore case, so drop the real ones by upper-cased name before adding ours.
const env: Record<string, string | undefined> = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !OVERRIDDEN.includes(k.toUpperCase()))),
  HOME: t.root,
  USERPROFILE: t.root,
  KILN_HOME: join(t.root, 'kiln-home'),
  KILN_OBSIDIAN_RUNNING: '0',
};
const run = (...args: string[]) => spawnSync(process.execPath, [BUNDLE, ...args], { encoding: 'utf8', env, cwd: t.root });

describe('kiln-setup.mjs', () => {
  it('carries the licence of yaml, which it inlines', () => {
    expect(readFileSync(BUNDLE, 'utf8')).toMatch(/^ \* Includes yaml \d/m);
  });

  it('plans, applies, and applies again without a change', () => {
    const plan = run('plan', '--vault', t.vault);
    expect(plan.stderr).toBe('');
    expect(plan.status).toBe(0);
    expect(JSON.parse(plan.stdout)).toMatchObject({ mode: 'setup', plugin: 'claude-plugin', asks: [] });
    expect(run('apply', '--vault', t.vault).status).toBe(0);
    const before = fingerprint(t.root);
    expect(run('apply', '--vault', t.vault).status).toBe(0);
    expect(fingerprint(t.root)).toBe(before);
  });

  it("loads the sample from the plugin's own clone", () => {
    const trial = testVault();
    const r = spawnSync(process.execPath, [BUNDLE, 'apply', '--vault', trial.vault, '--sample'], { encoding: 'utf8', env });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ sample: { source: 'local', skipped: [] } });
  });

  it('exits 2 on bad arguments', () => {
    expect(run('plan').status).toBe(2);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/setup/run.test.ts tests/setup/bundle.test.ts`
Expected: FAIL: `run.js` and the bundle don't exist.

- [ ] **Step 3: Implement `src/setup/run.ts` and `src/cli/kiln-setup.ts`, then build**

Run: `npm run build`
Expected: `Built kiln-check.mjs, kiln-setup.mjs, kiln-vault.mjs`. The new bundle starts with the build header and `yaml`'s licence, which `src/blueprint/load.ts` brings in.

- [ ] **Step 4: Run everything**

Run: `npm run format && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build:check`
Expected: all PASS, N + 76 passed, 1 skipped (4 in `run.test.ts`, 4 in `bundle.test.ts`), and `Bundles match src/.` Prettier ignores `claude-plugin/scripts/`, so formatting never changes a bundle.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/setup/run.ts src/cli/kiln-setup.ts claude-plugin/scripts/kiln-setup.mjs tests/setup/run.test.ts tests/setup/bundle.test.ts
git commit -m "feat(setup): bundle kiln-setup.mjs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The `/kiln:setup` skill

**Files:**
- Create: `claude-plugin/skills/setup/SKILL.md`
- Test: `tests/setup/skill.test.ts`

**Interfaces:**
- Consumes: `kiln-setup.mjs`, its `USAGE`, report keys and exit codes (Task 9); the vault rules (#82), rule 1 (the resolver, which stops at an Obsidian vault without kiln with "Set it up with /kiln:setup first"); the blueprint README's "Setting up a vault" and "Adding or changing a type".
- Produces: `/kiln:setup`. #82's `tests/plugin/skills.test.ts` picks it up automatically: `setup follows the vault rules` (the exact line ``Follow `${CLAUDE_PLUGIN_ROOT}/reference/vault-rules.md`, where `<plugin>` is `${CLAUDE_PLUGIN_ROOT}`.``) and `setup is a short verb with a description that keeps to kiln work` (name `setup` matches `^[a-z]{3,12}$`; the description below is 239 characters and says "kiln"), and its "all exist" test finds `reference/vault-rules.md`, `scripts/kiln-setup.mjs` and `blueprint/README.md`. Keep every `${CLAUDE_PLUGIN_ROOT}/...` path ending at a space, quote, backtick or `)`, since that test reads the path up to one.

- [ ] **Step 1: Write the failing test** in `tests/setup/skill.test.ts` (most of #78's `plugin.test.ts`, moved to the new layout)

```ts
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
    expect(body).toContain(`node "\${CLAUDE_PLUGIN_ROOT}/scripts/kiln-setup.mjs" plan --vault '<vault>'`);
    expect(body).toContain(`node "\${CLAUDE_PLUGIN_ROOT}/scripts/kiln-setup.mjs" apply --vault '<vault>'`);
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
    for (const key of ['stop', 'warnings', 'asks', 'obsidian', 'vaultOnlyTypes', 'sample', 'kiln', 'permissions']) {
      expect(body, key).toContain(`\`${key}\``);
      expect(Object.keys(report), key).toContain(key);
    }
  });

  it('names README sections that exist, and runs the procedure rather than restating it', () => {
    for (const name of ['Setting up a vault', 'Adding or changing a type']) {
      expect(body).toContain(`"${name}"`);
      expect(headings).toContain(name);
    }
    for (const detail of ['userIgnoreFilters', 'enabledCssSnippets', 'folder_templates', 'fileRules', 'templater-obsidian/data.json']) {
      expect(body, detail).not.toContain(detail);
    }
  });

  it('asks, closes, offers and never', () => {
    for (const part of [
      'Close Vault',
      'node --version',
      '--confirm-closed',
      'additionalDirectories',
      'Trigger Templater on new file creation',
      'only when the owner asks',
      '## Never',
    ]) {
      expect(body, part).toContain(part);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/setup/skill.test.ts`
Expected: FAIL, `ENOENT` for `SKILL.md`.

- [ ] **Step 3: Write `claude-plugin/skills/setup/SKILL.md`**

````markdown
---
name: setup
description: Set up an Obsidian vault with the kiln blueprint, re-apply the blueprint after a kiln update, or load the Northwind Arena sample into a trial vault. Use when the owner runs /kiln:setup or asks to set up, update or re-apply kiln in a vault.
---

# Set up a kiln vault

Follow `${CLAUDE_PLUGIN_ROOT}/reference/vault-rules.md`, where `<plugin>` is `${CLAUDE_PLUGIN_ROOT}`.

This skill is the only one that changes a vault's `_kiln/` and `.obsidian/`, records vaults in `~/.kiln/config.json`, and writes notes as plain files (the sample), always with Obsidian closed. A Node helper does every write in the vault; you do the asking. The procedure it runs is "Setting up a vault" in `${CLAUDE_PLUGIN_ROOT}/blueprint/README.md`.

## 1. Work out what was asked

- **The vault folder.** The one the owner named. With no folder named, find it by rule 1 of the vault rules and confirm the answer with the owner. If the resolver stops because a folder is an Obsidian vault without kiln, that folder is the one to set up. A new vault is the folder they opened in Obsidian.
- **The sample.** Load it only when the owner asks for the Northwind Arena sample, and only into a trial vault.
- **Node.** Run `node --version`. Without Node 24, follow "Setting up a vault" by hand instead, then go to step 6.

## 2. Plan

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-setup.mjs" plan --vault '<vault>'
```

Add `--sample` if the owner asked for the sample. The commands are the same in Bash and pwsh. Put every value you fill in (the vault, each `--take` id, a `--name`) in single quotes; a `'` inside one is written `'\''` in Bash and `''` in pwsh. The helper prints JSON:

- `stop`: tell the owner each reason and how to fix it, then plan again. Exit code 1 means there is at least one.
- `warnings`: pass each one on. One says the Obsidian CLI isn't registered; kiln's other skills need it.
- Summarise the plan: the folders, the files by action, the settings that change. Files with action `wait` wait for Obsidian to close.
- `vaultOnlyTypes`: types the owner added to `_kiln/types/` themselves. Setup leaves them alone and generates nothing for them.
- `sample`: with `notes` above 0, the vault already has the owner's own notes. Ask before loading the sample there.

## 3. Ask about the owner's settings and files

Each entry in `asks` is a setting or file of the owner's that the blueprint would replace: its `id`, the `current` value and the `blueprint` value. Show both (for a file, the difference) and ask: keep theirs, or take the blueprint's. Keeping is the default, and setup won't ask about it again until the blueprint changes. For each one they take, add `--take '<id>'` to the apply command. A new vault has nothing to ask, so ask nothing.

## 4. Check Obsidian is closed

Look at `obsidian` in the plan: `running` is `true`, `false` or `null`.

- **Setting up** needs Obsidian closed: QuickAdd and Homepage read their settings only when Obsidian starts. Ask the owner to quit Obsidian. With Run in Background installed, quitting only hides it, so they use the tray's Close Vault. Then plan again.
- **Re-applying** with Obsidian open is fine: the helper changes `_kiln/`, Iconic and Templater now, and everything marked `wait` waits. Offer to run setup again once Obsidian is closed.
- **`running` is `null`:** the check couldn't run. Ask the owner, and add `--confirm-closed` only when they say Obsidian is closed.

## 5. Apply

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-setup.mjs" apply --vault '<vault>'
```

With the same `--sample`, each `--take '<id>'`, and `--confirm-closed` if step 4 needed it. The first vault recorded becomes the default. If the plan's `kiln` names another vault as `default`, ask whether this one should be the default, and add `--default` if so. To use a name other than `kiln.name`, add `--name '<name>'`. The helper prints the same JSON with `applied: true`; exit code 1 means it stopped before writing anything, with the reasons in `stop`.

## 6. Offer, with the owner's consent

- **The permission settings.** A session in another folder asks before every write to the vault, and Claude Code doesn't otherwise protect files that can run code inside Obsidian. Offer to add the plan's `permissions` to the user settings file, `~/.claude/settings.json` (on Windows, in your home folder's `.claude`): append its `additionalDirectories` entries to `permissions.additionalDirectories` and its `ask` entries to `permissions.ask`, keeping everything else. Show the owner the exact JSON first, and change the file only if they say yes.
- **Templater's trigger,** as a suggestion: in Obsidian, Settings → Templater, turn on **Trigger Templater on new file creation**. It gives notes made by hand in a type's folder their template. It is kept per device, so no settings file can set it. Claude doesn't need it.

## 7. Report

Say what changed: folders, files by action, settings, backups (in `.kiln/backup/`), what was kept, what waits, dropped files with the notes that still use them (`usedBy`), the sample, and the name the vault was recorded under in `~/.kiln/config.json`. Then the next step: open Obsidian and work through section 4 of `_kiln/GETTING-STARTED.md`, or section 3 of `_kiln/TRY-THE-SAMPLE.md` for the sample.

## Never

- Write to the vault yourself. Every change goes through the helper.
- Edit `~/.kiln/config.json` yourself; the helper records the vault.
- Take the blueprint's version of the owner's setting or file without asking.
- Delete or rename anything in the vault. Dropped files stay where they are.
- Load the sample unless the owner asked for it.
- Call the Obsidian CLI during setup: it starts Obsidian, which setup needs closed. (Elsewhere, every call names the vault first, `vault="<folder name>"`, as the vault rules say.)
- Change the plugin's blueprint. That is "Adding or changing a type", in the kiln repo.
````

- [ ] **Step 4: Run everything, and validate the plugin**

Run: `npm run format && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build:check`
Expected: all PASS, N + 84 passed, 1 skipped: 6 in `tests/setup/skill.test.ts`, and 2 more from #82's `tests/plugin/skills.test.ts`, whose `it.each(SKILLS)` now runs for `setup`.

Run: `claude plugin validate .`
Expected: `✔ Validation passed with warnings`, the only warning the expected no-version one. (Validate only; never install the plugin into your own Claude Code config.)

- [ ] **Step 5: Commit**

```bash
git add claude-plugin/skills/setup/SKILL.md tests/setup/skill.test.ts
git commit -m "feat(plugin): /kiln:setup sets up, re-applies and loads the sample" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The guides need no clone

**Files:**
- Modify: `claude-plugin/blueprint/GETTING-STARTED.md`, `claude-plugin/blueprint/TRY-THE-SAMPLE.md`, `claude-plugin/blueprint/README.md` (the intro link, "Setting up a vault", "Adding or changing a type"), `docs/specs/2026-10-11-layer-1-structure-design.md` ("The blueprint" and the QuickAdd row only), `README.md` (the plugin paragraph and five rows of "What's in the repo")
- Test: `tests/kit/docs.test.ts`, `tests/plugin/layout.test.ts`

**Interfaces:**
- Consumes: `installedFiles` (Task 2); the repo README's `#install` and `#update` (#82); `REPO`, `PLUGIN`, `readdirSync`, `readFileSync`, `join` in `tests/plugin/layout.test.ts` (#105).

- [ ] **Step 1: Write the failing tests**, appended to `tests/kit/docs.test.ts` (add `import { installedFiles } from '../../src/setup/blueprint.js';`, `const sample = readFileSync(join(BLUEPRINT, 'TRY-THE-SAMPLE.md'), 'utf8');` and `const repoReadme = readFileSync(join(BLUEPRINT, '..', '..', 'README.md'), 'utf8');`). Rename the existing test "both docs say to turn on Templater's per-device trigger" to "both docs mention Templater's per-device trigger".

```ts
describe('setting up from any folder', () => {
  it('the guides need no clone of the kiln repo', () => {
    for (const doc of [guide, sample]) {
      expect(doc).not.toContain('git clone');
      expect(doc).not.toContain('Start Claude in the kiln repo');
      expect(doc).not.toMatch(/^\s*cd kiln$/m);
    }
  });

  it('getting started installs the plugin from the README, by an absolute link that works in a vault', () => {
    expect(guide).toContain('](https://github.com/Kieranties/kiln#install)');
    expect(repoReadme).toMatch(/^#+ Install$/m);
  });

  it('section 3 is one prompt, without the sample; the sample is asked for', () => {
    const apply = section(guide, '3. Apply the blueprint');
    expect(apply).toContain('/kiln:setup <vault folder>');
    expect(apply).not.toMatch(/sample/i);
    expect(sample).toContain('/kiln:setup <trial vault folder> with the Northwind Arena sample');
  });

  it('relative links in the blueprint docs stay in the blueprint, so they work in _kiln/', () => {
    const installed = installedFiles(BLUEPRINT);
    for (const doc of ['README.md', 'GETTING-STARTED.md', 'TRY-THE-SAMPLE.md']) {
      const text = readFileSync(join(BLUEPRINT, doc), 'utf8');
      for (const [, target = ''] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const file = decodeURI(target.split('#')[0] ?? '');
        expect(installed.has(`_kiln/${file}`), `${doc}: ${target}`).toBe(true);
      }
    }
  });

  it('the README is the manual fallback: the record, overrides, generated choices and minimum versions', () => {
    const steps = section(readme, 'Setting up a vault');
    for (const part of [
      '/kiln:setup',
      'requires.json',
      '.kiln/blueprint.json',
      '_kiln/templates/kinds/',
      '"kind": "apply", "mode": "doNothing"',
      'kiln-<type>-<kind>',
      '{{VALUE:title}}',
      'Close Vault',
    ]) {
      expect(steps, part).toContain(part);
    }
    expect(section(readme, 'Adding or changing a type')).toContain('/kiln:setup');
  });
});
```

Append to `tests/plugin/layout.test.ts`:

```ts
describe('the README and the skills', () => {
  it('names every skill, in the plugin section and the repo table', () => {
    const readme = readFileSync(join(REPO, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
    const skills = readdirSync(join(PLUGIN, 'skills'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    const intro = /^This repo is also a Claude Code plugin marketplace.*$/m.exec(readme)?.[0] ?? '';
    const row = /^\| `claude-plugin\/skills\/` \|(.*)$/m.exec(readme)?.[1] ?? '';
    for (const skill of skills) {
      expect(intro, skill).toContain(`/kiln:${skill}`);
      expect(row, skill).toContain(`\`${skill}\``);
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/kit/docs.test.ts tests/plugin/layout.test.ts`
Expected: FAIL: the guides still clone, the README links `../../docs/...`, and the repo README doesn't name `/kiln:setup`.

- [ ] **Step 3: Rewrite `GETTING-STARTED.md`**

- Intro: "Claude does the copying and settings" stays; drop "The commands work in both Bash and PowerShell" only if no command is left that differs.
- **1. What you need:** Obsidian 1.14 or later (unchanged); Claude Code; **Node 24** (`node --version`): setup runs a small Node script, and without Node Claude follows the steps by hand, more slowly; **the kiln plugin for Claude Code**: "Install it once, as [the README says](https://github.com/Kieranties/kiln#install). It carries the blueprint, so you need no copy of the kiln repo."
- **2. Make your vault:** steps 1–5 unchanged. Step 6 becomes optional: "**Optional:** in Settings → Templater, turn on **Trigger Templater on new file creation**. It gives notes you create by hand in a type's folder their template. Templater keeps this switch on your device, so the blueprint can't set it. Claude doesn't need it: it creates notes through QuickAdd." Step 7: "**Close Obsidian.** QuickAdd and Homepage only read their settings when Obsidian starts. If you use Run in Background, use its tray icon's **Close Vault**: quitting only hides Obsidian."
- **3. Apply the blueprint:** "Start Claude in any folder (`claude`) and give it this prompt, with your folder filled in:" then a `text` block `/kiln:setup <vault folder>`. Then: "Claude checks the four plugins, shows what it will change, and asks before changing any setting of yours (a new vault has none). It applies the blueprint, records the vault so Claude finds it from any folder, and offers to let Claude write to the vault without asking each time." No mention of the sample.
- **4. Check it:** unchanged.
- **5. Your first notes:** before "Start a project", one line: "Creating a note in a folder needs Templater's trigger (section 2, step 6). Without it, ask Claude to create the note, or run **QuickAdd: Run QuickAdd** and choose **New project**." Otherwise unchanged.
- **6. Next steps:** add first: "**Keep up with kiln:** after [updating the plugin](https://github.com/Kieranties/kiln#update), run `/kiln:setup` again. It updates what the new blueprint changed and keeps your own edits, asking when both changed." The "Add a type" bullet becomes: "**Add a type:** a new type changes the blueprint itself, so it's done in the kiln repo: [Adding or changing a type](README.md#adding-or-changing-a-type). Then run `/kiln:setup` to apply it."

- [ ] **Step 4: Rewrite `TRY-THE-SAMPLE.md` section 1 and 4**

- Step 2: "Come back here instead of going on to Getting started section 3. Start Claude in any folder and give it this prompt, with your trial folder filled in:" then `/kiln:setup <trial vault folder> with the Northwind Arena sample`. Then: "It applies the blueprint and adds the sample: the notes in `tests/fixtures/layer1` in the kiln repo, at the same version as your plugin. It fetches them from GitHub, so it needs a connection."
- Remove the old step 3; renumber.
- Section 4: "Close Obsidian and delete the trial vault folder. Setup also recorded the trial vault in `~/.kiln/config.json`; once the folder is gone, kiln says so and offers your other vaults, or you can delete its line from that file."

- [ ] **Step 5: Update the blueprint's `README.md`** (`claude-plugin/blueprint/README.md`)

- Intro: the design link becomes `https://github.com/Kieranties/kiln/blob/main/docs/specs/2026-10-11-layer-1-structure-design.md`.
- "Setting up a vault", a new opening paragraph: "`/kiln:setup` does all of this with a Node helper, from any Claude session, and re-applies the blueprint after an update. These are the steps it follows, and the steps Claude follows by hand when Node isn't installed. `<vault>` is the vault folder."
- Step 1: "**Check the plugins are installed and Obsidian is closed.** `<vault>/.obsidian/plugins/` has `iconic`, `templater-obsidian`, `quickadd` and `homepage`, each with `manifest.json` and `main.js`, at or above the versions in `requires.json`; warn about older ones. Obsidian must be closed, because QuickAdd and Homepage read their settings only at start-up; with Run in Background installed, that means the tray's Close Vault. Suggest, but don't require, **Trigger Templater on new file creation**: it is kept per device, so no settings file can set it, and it only matters for notes made by hand."
- Step 3: replace the sample sentence with "The Northwind Arena sample (`tests/fixtures/layer1` in the kiln repo) is added only when asked for, at the plugin's version (see `TRY-THE-SAMPLE.md`)."
- Step 4: before the table, "In a vault already in use, ask before changing the owner's Homepage, new-note folder, daily-note folder, format or template, Templater template folder or folder templates, and property types, and before replacing an existing `Home.md`." In the QuickAdd row: "Remove `choices` entries whose `id` starts with `kiln-`, at any depth, then add the blueprint's, then the generated ones below".
- New sub-heading after step 4, `### QuickAdd choices and templates per kind`:

  > Claude creates notes by running a QuickAdd choice, so every kind has one. They come from the definitions, so nothing in `settings/` lists them.
  >
  > - **A kind's template** is `_kiln/templates/kinds/<template name> <kind>.md`: the type's template without its first line (the kind picker), with `kind: <% kind %>` replaced by `kind: <kind>`.
  > - **A kind's choice** has the id `kiln-<type>-<kind>` and the name `New <kind>`, inside a Multi choice `kiln-<type>-menu` named `New <type>`. A type without kinds gets one choice, `kiln-<type>` named `New <type>`, with the type's own template, unless `settings/plugins/quickadd.json` already has that id.
  > - **Every choice** is a Template choice in the type's folder, not a command, and doesn't open the note. Its file name follows the type's `naming`: `{{VALUE:title}}` for `title` and `source-title`, `{{DATE:YYYY-MM-DD}} {{VALUE:title}}` for `date-title`, `{{DATE:YYYY-MM-DD}}` for `date`. "File exists" keeps the existing file, `"fileExistsBehavior": { "kind": "apply", "mode": "doNothing" }`, so a run never stops to ask.

- Step 6, **Record**: "Write `<vault>/.kiln/blueprint.json`: the plugin's version, a hash of the blueprint, and a hash of each file installed. Re-applying compares each file three ways: what was installed, what is in the vault and the new blueprint. It updates what only the blueprint changed, keeps the owner's edits, asks when both changed, adds new files, and leaves dropped ones in place. Then record the vault in `~/.kiln/config.json`. By hand, skip both: the next `/kiln:setup` treats `_kiln/` as the blueprint's." Renumber "Report" and "Open Obsidian and check".
- "Adding or changing a type", step 2: add "QuickAdd choices and kind templates need nothing: setup generates them." Step 5 becomes: "In the vault, run `/kiln:setup`. With Obsidian open it updates `_kiln/`, Iconic and Templater, and the rest waits until Obsidian is closed and setup runs again."

- [ ] **Step 6: Update the repo `README.md`**

#82 left these to #72. Change only these lines.

- In `### The Claude plugin`, the first paragraph's middle sentence, "So far there is one skill: `/kiln:check` checks a vault's notes, or today's changes, against their type definitions.", becomes: "There are two skills so far: `/kiln:setup` sets up a vault from the blueprint, re-applies the blueprint after an update and loads the sample on request, and `/kiln:check` checks a vault's notes, or today's changes, against their type definitions." Leave `#### Update` as it is: "Then run `/kiln:setup` to re-apply the blueprint to your vault" is now true.
- In "What's in the repo":
  - `claude-plugin/skills/`: "The plugin's skills, one folder each: `check`, `setup`".
  - `claude-plugin/scripts/`: "such as `kiln-check.mjs`, `kiln-setup.mjs` and `kiln-vault.mjs`" in place of "such as `kiln-check.mjs` and `kiln-vault.mjs`".
  - `src/`: "The code: `blueprint/` reads a blueprint's definitions, `check/` is the note check, `vault/` finds the vault, `setup/` sets up a vault, `cli/` holds an entry point per script".
  - A new row after `tests/vault/`: ``| `tests/setup/` | Checks setting up a vault: the generated QuickAdd choices, the settings merges, the three-way re-apply, the sample, the built `kiln-setup.mjs` and the setup skill |``.

- [ ] **Step 7: Update the layer 1 design**

In the "QuickAdd" row: "Capture to the inbox, log to daily, and one choice per kind (generated by setup) that Claude runs to create notes". In "The blueprint", step 2: "`/kiln:setup` copies the blueprint in as `_kiln/` and applies the definitions and plugin settings, from any Claude session." Change "so applying a type definition later is safe with Obsidian open" to "so re-applying later changes those with Obsidian open, and the rest waits for it to close".

- [ ] **Step 8: Run everything**

Run: `npm run format && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build:check`
Expected: all PASS, N + 90 passed, 1 skipped (5 new in `tests/kit/docs.test.ts`, 1 in `tests/plugin/layout.test.ts`), including #105's living-docs link test (the blueprint docs now link out only by `https:`) and #82's README tests (no `claude plugin` command changed).

Run: `claude plugin validate .`
Expected: `✔ Validation passed with warnings`, the only warning the expected no-version one.

- [ ] **Step 9: Commit**

```bash
git add claude-plugin/blueprint/GETTING-STARTED.md claude-plugin/blueprint/TRY-THE-SAMPLE.md claude-plugin/blueprint/README.md docs/specs/2026-10-11-layer-1-structure-design.md README.md tests/kit/docs.test.ts tests/plugin/layout.test.ts
git commit -m "docs: set up a vault with /kiln:setup, no clone needed" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Acceptance (for the PR, by the owner)

From the issue. Agents can't run these; list them in the PR as the owner's checks.

- From a Claude session outside the kiln repo, `/kiln:setup <empty vault>` (after Getting started sections 1–2) sets the vault up in one prompt, and Getting started section 4 passes.
- Getting started no longer asks for a clone (pinned by Task 11's tests).
- **Trial T3** (re-apply with Obsidian open): change a blueprint file under `_kiln/`, a Templater setting and a QuickAdd choice, re-apply with Obsidian open, and confirm Obsidian picks up each change and doesn't write its own copy back. If it passes, set QuickAdd's `live` to `true` in `SETTINGS`.

## Not in this plan

- **Generating settings for types added only in a vault:** listed as `vaultOnlyTypes`; the kiln Obsidian plugin's job later.
- **Showing the blueprint version in Obsidian.**
- **Making the folder template the default kind,** so no template has a picker: after trial T2.
- **QuickAdd re-applied with Obsidian open:** after trial T3.
- **A separate `kiln-sample` plugin** instead of fetching the sample: open in the repo layout note.

# Note Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Check any note in a kiln vault against its type definition with one function, `checkNote()`, run by `tests/kit` on the sample, by the bundled `kiln-check.mjs` script and by the `/kiln:check` skill.

**Architecture:** kiln's first code goes in `src/`. `src/blueprint/` reads type definitions and the property catalogue (moved out of `tests/kit/load.ts`, which now imports it). `src/check/` finds the vault (the folder holding `_kiln/types/`), checks notes and formats the result; `src/cli/kiln-check.ts` is a thin entry point. esbuild bundles each `src/cli/<name>.ts` into one self-contained `claude-plugin/scripts/<name>.mjs`, committed, and CI fails when a bundle is out of step with `src/`. The definitions gain `naming` and `last`, and `properties.md` gains the `shared` and `optional` property lists, so nothing about types is hard-coded in the check.

**Tech Stack:** Node 24, TypeScript 7 ESM (NodeNext), `yaml`, vitest, oxlint (type-aware), Prettier, esbuild (new devDependency).

**Spec:** [docs/specs/2026-10-11-note-check-design.md](../specs/2026-10-11-note-check-design.md). Builds on the [repo layout](../specs/2026-10-11-repo-layout-design.md) (#105). Context: [vault access](../specs/2026-10-11-vault-access-design.md), [plugin install](../specs/2026-10-11-plugin-install-design.md), [finding the vault](../specs/2026-10-11-finding-the-vault-design.md).

**Starts from:** the #105 branch. The kit is `claude-plugin/blueprint/` (`types/`, `templates/`, `properties.md`, `README.md`, ...), and `tests/kit/load.ts` reads it there. `tests/kit/load.ts` exports `BLUEPRINT`, the absolute path of `claude-plugin/blueprint/` with a trailing separator, and `tests/plugin/layout.test.ts` checks the plugin folder and the living docs' links.

## Global Constraints

- **Public repo.** Nothing committed may contain employer or client names, private links, or real local paths of any machine. Paths in code, tests and docs are examples such as `D:\notes` or `D:\tmp\kiln-sample`. Test data is the fictional Northwind Arena (`tests/fixtures/`).
- **The check never writes to notes.** No code in `src/check/` opens a note for writing.
- **What fails and what warns** (copied from the spec):

  | Result | Rule |
  |---|---|
  | Error | Wrong folder, type, kind or status |
  | Error | A section of the type is missing |
  | Error | A property the type doesn't have |
  | Error | A new note with frontmatter and no body |
  | Error | `<%` in a new note |
  | Allowed | Extra sections |
  | Warning | A link to a note that doesn't exist yet, with a near-match hint |
  | Warning | A file name used by another note |
  | Warning | `<%` in an existing note |

  This plan adds, as errors, the rules the spec moves into the definitions: the `naming` rule and linkable file names, `last` (the daily note's Log stays last), and relationships written as lists of links (the spec's "What can go wrong" table).
- **Output format** (copied from the spec): the note's vault-relative path with `/`, then one line per finding, errors first, as `  error  <message>` or `  warn   <message>` (two spaces, the level padded to five characters, two spaces). A message names the rule and the fix:

  ```
  Inbox/2026-10-06 Ask Priya about grace periods.md
    error  type is work but the note is in Inbox/; work notes live in Work/
    error  missing section: ## Outcome
    error  unknown property: attendees (work has jira, github, priority, projects, products, and the shared properties)
    warn   [[Priya Rahman]] doesn't exist yet; did you mean [[Priya Raman]]?
  ```

- **The check reads the vault's own `_kiln/types/` and `_kiln/properties.md`,** found by walking up from the note. A new type or kind needs no code change.
- **Bundles** are `claude-plugin/scripts/<name>.mjs`, built from `src/cli/<name>.ts` by `npm run build`, single-file with `yaml` inlined, committed. **No `package.json` in `claude-plugin/`.**
- Node 24, ESM. TypeScript imports use `.js` extensions (NodeNext).
- Every command in docs and the skill works in Bash and pwsh. Scripts are Node, never shell.
- Commits stage files by explicit path (never `git add -A` or `git add .`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Docs: plain British English, short sentences. The dated plans in `docs/plans/` stay as written; living docs (README, `CLAUDE.md`, the blueprint guides, the layer 1 design) change with the code.
- Code blocks in this plan aren't Prettier-formatted: run `npm run format` before each commit.
- Before pushing: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and from Task 7 `npm run build:check`.

## Decisions this plan makes

Record these in the PR description; they are exploratory, like everything else.

1. **"New note" is an explicit flag.** `checkNote(..., { isNew: true })` and `kiln-check.mjs --new`. Without it a note is existing. A flow that just created a note passes `--new`; `/kiln:check` never does. No git or mtime guessing.
2. **"Today's changes" is `--today`:** notes whose file modified time is at or after local midnight.
3. **Naming is an error,** like folder: a capture converted to work and left named `2026-10-06 ...` fails. Rules: `title` (doesn't start with a date), `date` (`YYYY-MM-DD` only), `date-title` (`YYYY-MM-DD` then a space and a title), `source-title` (any linkable name). Every name must be linkable: none of `# ^ [ ] | :`.
4. **`last: Log`** in the daily definition. An error when the last `## ` heading isn't Log. Log line formats stay prose.
5. **`properties.md` gains two lists:** `shared` (every note carries them, in template order) and `optional` (any note may carry them: `captured`, `from`, `url`). Types that already own `url`, `captured` or `from` keep them in their own `properties`.
6. **Link warnings skip** embeds (`![[...]]`), links in code, and folder-qualified links (`[[Daily/2026-10-07|tomorrow →]]`): kiln writes those only for a daily note's neighbours, which usually don't exist yet. Links resolve case-insensitively by file name, like Obsidian. The near-match hint is the closest name within edit distance 2.
7. **Which notes a folder or the whole vault includes:** every `.md` file outside dot-folders and `_kiln/`. A note with no `type` outside every type folder (such as `Home.md`) is skipped; inside a type folder it is an error. A note named explicitly is always checked.
8. **Exit codes:** 0 no errors (warnings allowed), 1 errors, 2 bad arguments.
9. **Bundle currency** is `npm run build:check`: a Node script rebuilds in memory and compares with `claude-plugin/scripts/`, so it catches missing, stale and orphaned bundles in Bash, pwsh and CI alike.
10. **Tests for `src/` live under `tests/`** (`tests/blueprint/`, `tests/check/`), so `vitest.config.ts` keeps its `tests/**/*.test.ts` include. `tsconfig.json` and oxlint gain `src/`; Prettier and oxlint ignore `claude-plugin/scripts/`.

## Review Focus

1. **Windows line endings and a byte-order mark.** A note saved by another editor has `\r\n` and a BOM; it must check exactly as the LF original does. Pinned in Task 4.
2. **Broken YAML in one note** (a duplicate key, a stray colon). That note gets one `frontmatter is not valid YAML` error, and the rest of the run carries on. Pinned in Task 4 and Task 6.
3. **Link syntax Obsidian accepts:** `[[Note|alias]]`, `[[Note#Heading]]`, embeds, links inside code spans or fences, a different letter case. None may warn falsely. Pinned in Task 5.
4. **A path that isn't a vault note:** a missing file, a folder outside any vault, a `.txt` file, a vault whose definition is malformed. Each gets a clear `error` line and exit 1, never a stack trace. Pinned in Task 6.
5. **Relative paths with spaces, run from another folder on Windows.** Output paths are vault-relative with `/`, whatever the current folder or path separator. Pinned in Task 6.

---

## File structure

| File | Responsibility |
|---|---|
| `src/blueprint/markdown.ts` | Note text helpers: `splitFrontmatter`, `sectionsOf` (moved from `tests/kit/load.ts`) |
| `src/blueprint/load.ts` | Definition and property-catalogue types; `readDefinitions`, `readPropertyCatalogue`, `readBlueprint` from a blueprint folder |
| `src/check/vault.ts` | `findVault`, `openVault`: the vault root, its blueprint, its notes and its file-name index |
| `src/check/links.ts` | `linkTargets`, `frontmatterLinkTarget`, `nearest` |
| `src/check/check-note.ts` | `checkNote` and its result types |
| `src/check/format.ts` | `formatResult`, `summarise` |
| `src/check/run.ts` | `runCheck`: arguments in, output text and exit code out |
| `src/cli/kiln-check.ts` | Entry point: calls `runCheck` with `process.argv` |
| `scripts/build.mjs` | esbuild bundling, and `--check` for bundle currency |
| `claude-plugin/scripts/kiln-check.mjs` | The committed bundle |
| `claude-plugin/skills/check/SKILL.md` | `/kiln:check` |
| `tests/blueprint/load.test.ts` | Loader tests |
| `tests/check/fixture.ts` | `makeVault()`: a temporary vault from the sample (and the broken notes) |
| `tests/check/*.test.ts` | Vault, checkNote, run, bundle and skill tests |
| `tests/fixtures/check/` | Broken notes, at their vault paths, laid over the sample |

---

### Task 1: Move definition loading into `src/blueprint`

A pure move: behaviour and every `tests/kit` test stay the same.

**Files:**
- Create: `src/blueprint/markdown.ts`, `src/blueprint/load.ts`
- Modify: `tests/kit/load.ts`, `tsconfig.json`
- Test: `tests/blueprint/load.test.ts`

**Interfaces:**
- Produces, in `src/blueprint/markdown.ts`:
  - `splitFrontmatter(text: string): { frontmatter: string; body: string }`: as today, and also strips a leading `\uFEFF`.
  - `sectionsOf(body: string): Map<string, string>`: as today; heading text is trimmed.
- Produces, in `src/blueprint/load.ts`:
  - `type PropType`, `PROP_TYPES`, `type ViewDef`, `type Definition`, `type PropertyEntry` (moved unchanged).
  - `type PropertyCatalogue = { entries: Record<string, PropertyEntry> }` (Task 2 adds fields).
  - `type Blueprint = { definitions: Definition[]; properties: PropertyCatalogue }`.
  - `readDefinitions(dir: string): Definition[]`: every `dir/types/*.md`, sorted by file name.
  - `readPropertyCatalogue(dir: string): PropertyCatalogue`: from `dir/properties.md`.
  - `readBlueprint(dir: string): Blueprint`.
  - `dir` is a blueprint folder: `claude-plugin/blueprint/` in the repo, `<vault>/_kiln/` in a vault.
- `tests/kit/load.ts` keeps its exported names (`loadDefinitions()`, `loadProperties()`, `SHARED_PROPERTIES`, `splitFrontmatter`, `sectionsOf`, `PROP_TYPES`, the types) so no other test file changes; it re-exports or wraps the `src/` versions with `BLUEPRINT`.

- [ ] **Step 1: Write the failing test** in `tests/blueprint/load.test.ts`

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readBlueprint, readDefinitions } from '../../src/blueprint/load.js';
import { sectionsOf, splitFrontmatter } from '../../src/blueprint/markdown.js';
import { BLUEPRINT } from '../kit/load.js';

const tmp = mkdtempSync(join(tmpdir(), 'kiln-blueprint-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readBlueprint', () => {
  it('reads the repo blueprint: twelve definitions and the property catalogue', () => {
    const blueprint = readBlueprint(BLUEPRINT);
    expect(blueprint.definitions.map((d) => d.name)).toEqual([
      'capture', 'daily', 'decision', 'meeting', 'organisation', 'person',
      'product', 'project', 'reference', 'research', 'topic', 'work',
    ]);
    expect(blueprint.properties.entries.attendees).toEqual({ links: 'person' });
  });

  it('names the file and field of a malformed definition', () => {
    mkdirSync(join(tmp, 'types'), { recursive: true });
    writeFileSync(join(tmp, 'types', 'bad.md'), '---\nname: bad\nfolder: Bad\nnaming: title\nstatuses: active\n---\nBad.\n');
    expect(() => readDefinitions(tmp)).toThrow(/types\/bad\.md: statuses must be a list/);
  });
});

describe('markdown', () => {
  it('splits frontmatter after a byte-order mark, with Windows line endings', () => {
    expect(splitFrontmatter('\uFEFF---\r\ntype: work\r\n---\r\n## Context\r\n')).toEqual({
      frontmatter: 'type: work',
      body: '## Context\r\n',
    });
  });

  it('trims section headings', () => {
    expect([...sectionsOf('## Log \n- 09:00 x\n').keys()]).toEqual(['Log']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/blueprint/load.test.ts`
Expected: FAIL, cannot resolve `../../src/blueprint/load.js`.

- [ ] **Step 3: Create `src/blueprint/markdown.ts` and `src/blueprint/load.ts`**

Move the code from `tests/kit/load.ts`. `src/` gets oxlint's full `no-unsafe-*` rules (the `tests/**` override doesn't apply), so `readDefinitions` validates each field from `unknown` instead of casting: `name` and `folder` are required text; `template`, `icon` and `color` default to `''`; `statuses` and `sections` to `[]`; `properties`, `kinds` and `views` to `{}`. A field of the wrong shape throws `Error('types/<file>: <field> must be <shape>')`, with `/` in the path on every OS. Same for `readPropertyCatalogue` (`properties.md: properties must be a map`).

Then make `tests/kit/load.ts` import from `src/` and keep its own exports as thin wrappers: `loadDefinitions = () => readDefinitions(BLUEPRINT)`, `loadProperties = () => readPropertyCatalogue(BLUEPRINT).entries`, and re-export `splitFrontmatter`, `sectionsOf`, `PROP_TYPES` and the types. Export `BLUEPRINT` if it isn't already. Templates, Bases and JSON loaders stay in `tests/kit/load.ts`: only tests use them.

In `tsconfig.json`, set `"include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]`.

- [ ] **Step 4: Run all tests, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS; the `tests/kit` count is unchanged from the #105 branch.

- [ ] **Step 5: Commit**

```bash
git add src/blueprint/markdown.ts src/blueprint/load.ts tests/blueprint/load.test.ts tests/kit/load.ts tsconfig.json
git commit -m "refactor: move definition loading into src/blueprint" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The definitions gain naming, last, and the shared property lists

**Files:**
- Modify: `claude-plugin/blueprint/types/*.md` (all twelve), `claude-plugin/blueprint/properties.md`, `src/blueprint/load.ts`, `tests/kit/load.ts`, `tests/kit/definitions.test.ts`, `tests/kit/templates.test.ts`, `claude-plugin/blueprint/README.md`, `docs/specs/2026-10-11-layer-1-structure-design.md`

**Interfaces:**
- Produces, in `src/blueprint/load.ts`:
  - `NAMINGS = ['title', 'date', 'date-title', 'source-title'] as const`; `type Naming = (typeof NAMINGS)[number]`.
  - `Definition` gains `naming: Naming` (required; a missing or unknown value throws `types/<file>: naming must be one of title, date, date-title, source-title`) and `last?: string`.
  - `PropertyCatalogue` becomes `{ shared: string[]; optional: string[]; entries: Record<string, PropertyEntry> }`. `shared` is required; `optional` defaults to `[]`.
- `tests/kit/load.ts`: `SHARED_PROPERTIES` is now `readPropertyCatalogue(BLUEPRINT).shared` (type `readonly string[]`), plus a new `OPTIONAL_PROPERTIES`.

- [ ] **Step 1: Write the failing tests** in `tests/kit/definitions.test.ts`

Add `OPTIONAL_PROPERTIES` to the import from `./load.js`, `NAMINGS` from `../../src/blueprint/load.js`, and in `every definition is complete` add `expect(NAMINGS, d.name).toContain(d.naming);`. Then:

```ts
  it('naming matches the spec', () => {
    expect(Object.fromEntries(TYPES.map((t) => [t, def(t).naming]))).toEqual({
      organisation: 'title',
      person: 'title',
      product: 'title',
      topic: 'title',
      project: 'title',
      work: 'title',
      research: 'date-title',
      decision: 'date-title',
      meeting: 'date-title',
      daily: 'date',
      reference: 'source-title',
      capture: 'date-title',
    });
  });

  it('only the daily note keeps a section last, and it is one of its sections', () => {
    const lasts = Object.fromEntries(TYPES.filter((t) => def(t).last).map((t) => [t, def(t).last]));
    expect(lasts).toEqual({ daily: 'Log' });
    expect(def('daily').sections.at(-1)).toBe('Log');
  });

  it('properties.md lists the shared and optional properties', () => {
    expect(SHARED_PROPERTIES).toEqual(['type', 'kind', 'status', 'created', 'summary', 'aliases', 'keywords', 'tags', 'review']);
    expect(OPTIONAL_PROPERTIES).toEqual(['captured', 'from', 'url']);
  });
```

And in `tests/kit/settings.test.ts`'s "the property list covers every property" test nothing changes: `entries` is still every property.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/kit/definitions.test.ts`
Expected: FAIL: `naming` is undefined and `OPTIONAL_PROPERTIES` doesn't exist.

- [ ] **Step 3: Add the fields to the blueprint**

- Each `claude-plugin/blueprint/types/<type>.md` gets `naming: <value>` from the table above, on the line after `template:`. `daily.md` also gets `last: Log` after `sections:`.
- `claude-plugin/blueprint/properties.md` gets, after `type: kiln-properties`:

  ```yaml
  # Every note carries these, in this order
  shared:
    - type
    - kind
    - status
    - created
    - summary
    - aliases
    - keywords
    - tags
    - review
  # Any note may carry these: a capture converted to another type keeps them
  optional:
    - captured
    - from
    - url
  ```

  and its body gains: "`shared` lists the properties every note carries, in template order. `optional` lists the ones any note may carry, so a capture converted to another type keeps `captured`, `from` and `url`."
- `src/blueprint/load.ts` reads `naming`, `last`, `shared` and `optional` as above. `tests/kit/load.ts` derives `SHARED_PROPERTIES` and `OPTIONAL_PROPERTIES` from the catalogue.
- In `tests/kit/templates.test.ts`, `expectedHeadings` stops naming the daily type:

  ```ts
  function expectedHeadings(d: Definition): string[] {
    const views = Object.keys(d.views);
    if (!d.last) return [...d.sections, ...views];
    return [...d.sections.filter((s) => s !== d.last), ...views, d.last];
  }
  ```

- [ ] **Step 4: Update the docs that describe the definition**

- `claude-plugin/blueprint/README.md`: in "What the blueprint is" (or the table row for `types/`), add "naming rule" to what a definition holds; in the `properties.md` row, say it also lists the shared and optional properties. In "Adding or changing a type", step 1, add: "Set its `naming`: `title`, `date`, `date-title` or `source-title`. `last` names a section that must stay last, as Log does for the daily note." Keep every phrase `tests/kit/docs.test.ts` looks for.
- `docs/specs/2026-10-11-layer-1-structure-design.md`, "Type definitions and how they are applied": add `naming: title` to the YAML example and one sentence on `naming` and `last`. In "Properties", say the shared list lives in `properties.md`, with `captured`, `from` and `url` optional on every type.

- [ ] **Step 5: Run all tests**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add claude-plugin/blueprint/types claude-plugin/blueprint/properties.md claude-plugin/blueprint/README.md src/blueprint/load.ts tests/kit/load.ts tests/kit/definitions.test.ts tests/kit/templates.test.ts docs/specs/2026-10-11-layer-1-structure-design.md
git commit -m "feat(blueprint): naming and last in definitions, shared properties in properties.md" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Find and open the vault

**Files:**
- Create: `src/check/vault.ts`, `tests/check/fixture.ts`
- Test: `tests/check/vault.test.ts`

**Interfaces:**
- Consumes: `readBlueprint(dir)`, `type Blueprint` (Task 1–2).
- Produces, in `src/check/vault.ts`:
  - `findVault(path: string): string | undefined`: starts at `path` if it is a folder, else its parent; walks up to the first folder holding a `_kiln/types/` folder; `undefined` at the filesystem root.
  - `type Vault = { root: string; blueprint: Blueprint; notes: string[]; names: Map<string, string[]> }`.
    - `notes`: vault-relative paths with `/`, sorted, of every `.md` file outside dot-folders and `_kiln/`.
    - `names`: lower-case link name → vault-relative paths, for every file outside dot-folders (`_kiln/` included). A `.md` file's link name is its name without `.md`; any other file keeps its extension (`board.base`).
  - `openVault(root: string, blueprintDir?: string): Vault`: `blueprintDir` defaults to `<root>/_kiln`. Throws whatever `readBlueprint` throws.
- Produces, in `tests/check/fixture.ts`:
  - `SAMPLE` (`tests/fixtures/layer1/`), `BROKEN` (`tests/fixtures/check/`).
  - `makeVault(options?: { broken?: boolean }): string`: a new folder under `os.tmpdir()` holding a copy of the sample, `_kiln/types/` and `_kiln/properties.md` copied from `BLUEPRINT`, and with `broken`, `tests/fixtures/check/` copied over it. Callers remove it in `afterAll`.

- [ ] **Step 1: Write the failing test** in `tests/check/vault.test.ts`

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { findVault, openVault } from '../../src/check/vault.js';
import { makeVault } from './fixture.js';

const vault = makeVault();
const outside = mkdtempSync(join(tmpdir(), 'kiln-outside-'));
afterAll(() => {
  rmSync(vault, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe('findVault', () => {
  it('walks up from a note to the folder holding _kiln/types', () => {
    expect(findVault(join(vault, 'Work', 'Fix renewal date rollover.md'))).toBe(vault);
  });
  it('accepts the vault folder itself', () => {
    expect(findVault(vault)).toBe(vault);
  });
  it('finds nothing outside a vault', () => {
    expect(findVault(outside)).toBeUndefined();
  });
});

describe('openVault', () => {
  it("lists the vault's notes, leaving out _kiln and dot-folders", () => {
    mkdirSync(join(vault, '.obsidian'), { recursive: true });
    writeFileSync(join(vault, '.obsidian', 'stray.md'), 'x');
    const v = openVault(vault);
    expect(v.notes).toHaveLength(16);
    expect(v.notes).toContain('People/Priya Raman.md');
    expect(v.notes.some((n) => n.startsWith('_kiln/') || n.startsWith('.obsidian/'))).toBe(false);
  });
  it('indexes file names for links, case-insensitively', () => {
    const v = openVault(vault);
    expect(v.names.get('priya raman')).toEqual(['People/Priya Raman.md']);
    expect(v.blueprint.definitions).toHaveLength(12);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/check/vault.test.ts`
Expected: FAIL, cannot resolve `../../src/check/vault.js`.

- [ ] **Step 3: Implement `src/check/vault.ts` and `tests/check/fixture.ts`**

`openVault` walks with `readdirSync(root, { recursive: true, withFileTypes: true })`, dropping any entry whose relative path has a segment starting with `.`; paths are converted to `/` with `split(sep).join('/')`. `makeVault` uses `mkdtempSync` and `cpSync(..., { recursive: true })`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/check/vault.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/check/vault.ts tests/check/fixture.ts tests/check/vault.test.ts
git commit -m "feat(check): find and open a kiln vault" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `checkNote`: the errors

**Files:**
- Create: `src/check/check-note.ts`, the broken notes in `tests/fixtures/check/` (below)
- Test: `tests/check/check-note.test.ts`

**Interfaces:**
- Consumes: `Vault` (Task 3), `splitFrontmatter`, `sectionsOf` (Task 1), `Definition`, `PropertyCatalogue` (Task 2).
- Produces, in `src/check/check-note.ts`:
  - `type Level = 'error' | 'warn'`; `type Finding = { level: Level; message: string }`.
  - `type NoteResult = { path: string; findings: Finding[]; skipped?: boolean }`. `path` is vault-relative with `/`.
  - `type CheckOptions = { isNew?: boolean; skipUntyped?: boolean }`.
  - `checkNote(vault: Vault, path: string, options?: CheckOptions): NoteResult`. `path` is vault-relative with `/`. Reads the note; never writes. Findings are errors first, then warnings, each in rule order. With `skipUntyped`, a note with no `type` outside every type folder returns `{ path, findings: [], skipped: true }`.

**The rules, in order, with their exact messages** (`<t>` the type, `<d>` its definition; lists joined with `, `; an empty value is `null`, `undefined` or `''`; no frontmatter, or empty frontmatter, counts as a map with no keys):

| # | When | Level | Message |
|---|---|---|---|
| 1 | YAML doesn't parse (stop) | error | `frontmatter is not valid YAML: <first line of the parser's message>` |
| 2 | Frontmatter parses to something other than a map (stop) | error | `frontmatter is not a set of properties` |
| 3 | No `type` (stop) | error | `no type; set type to one of: <every type name, sorted>` |
| 4 | `type` has no definition (stop) | error | `unknown type: <t> (types are <every type name, sorted>)` |
| 5 | First path segment isn't `<d>.folder` | error | `type is <t> but the note is in <folder>/; <t> notes live in <d.folder>/` (a root note says `in the vault root`) |
| 6 | `kind` set, type has kinds, not one of them | error | `unknown kind: <k> (<t> kinds are <kinds>)` |
| 7 | `kind` set, type has no kinds | error | `<t> has no kinds; leave kind empty` |
| 8 | Type has statuses, `status` not one of them | error | `status is <s or "empty">; <t> statuses are <statuses>` |
| 9 | Type has no statuses, `status` set | error | `<t> has no status; leave status empty` |
| 10 | Name breaks `naming` `date` | error | `<t> notes are named by date: YYYY-MM-DD` |
| 11 | Name breaks `naming` `date-title` | error | `<t> notes are named date first: YYYY-MM-DD title` |
| 12 | Name breaks `naming` `title` (starts with `YYYY-MM-DD` then a space or the end) | error | `<t> notes are named by title, without a date first` |
| 13 | Name contains any of `# ^ [ ] \| :` | error | `file name contains <the characters found, in order, joined with ", ">; replace # ^ [ ] \| with a space and : with -` |
| 14 | `isNew` and the body is blank | error | `new note has properties and no body; create it from its template through QuickAdd` |
| 15 | A `<d>.sections` heading is missing | error | `missing section: ## <s>` |
| 16 | `<d>.last` is set and isn't the last `## ` heading | error | `## <last> must be the last section` |
| 17 | A frontmatter key outside shared, optional and `<d>.properties` (rules 17–19 run key by key, in the note's key order) | error | `unknown property: <key> (<t> has <own keys>, and the shared properties)`, or `(<t> has only the shared properties)` |
| 18 | A `links` property is set and isn't a list of `[[...]]` text | error | `<key> must be a list of links, such as <key>: ["[[Name]]"]` |
| 19 | A `list` property is set and isn't a list | error | `<key> must be a list` |
| 20 | Text contains `<%` and `isNew` | error | `contains <%, which Templater would run; remove it` |
| 21 | Text contains `<%` and not `isNew` | warn | `contains <%; Templater only runs it in a new note, so take it out before this text is reused` |

Task 5 adds the link and file-name warnings.

- [ ] **Step 1: Add the broken notes** under `tests/fixtures/check/`, each at its vault path. Fictional data only. Each one breaks only what its test names; all other frontmatter keys are the type's template keys with sample-like values.

| File | Content |
|---|---|
| `Inbox/Decide the grace period.md` | `type: work`, `kind: feature`, `status: backlog`, the shared and work keys (`projects: ["[[Season Ticket Renewals 2027]]"]`), plus `attendees: ["[[Priya Raman]]"]`, `captured: 2026-10-07T09:12`, `from: daily log`. Body: `## Context` with "Ask [[Priya Rahman]] how long the grace period should be.", then `## Checkpoints`. No Outcome |
| `Work/Chase renewal refunds.md` | `kind: bugg`, `status: doing`, `github: https://github.example/northwind-arena/club-console/issues/97` (text, not a list), then `projects: "[[Season Ticket Renewals 2027]]"` (text, not a list). All three work sections |
| `Daily/2026-10-07.md` | A valid daily note (neighbour links `[[Daily/2026-10-06|← yesterday]] · [[Daily/2026-10-08|tomorrow →]]`), whose Scratch says "Pasted from the club wiki: <% tp.date.now() %>", and whose sections run Schedule, What changed, Scratch, Log, Reflection |
| `Meetings/Renewals retro.md` | A meeting with `status: active` and all four sections |
| `Work/Refund card retries.md` | Valid work frontmatter and nothing after the closing `---` |
| `References/NWA-150 Retry #3 fails.md` | A valid `kind: ticket` reference |
| `Topics/Priya Raman.md` | A valid topic (Task 5's duplicate name) |
| `Inbox/2026-10-07 Memo from the club.md` | `type: memo` |
| `Topics/Loose thoughts.md` | No frontmatter: "Grace periods might differ by club." |
| `Projects/Broken frontmatter.md` | `type: project` twice in its frontmatter |
| `Work/Ask about grace periods.md` | A capture converted to work, done right: valid work frontmatter plus `captured`, `from: daily log`, `url: https://wiki.northwind-arena.example/renewals`, all three sections |

Add a `## check/` section to `tests/fixtures/README.md`: "Broken notes for the note check, at their vault paths. `tests/check/` lays them over a copy of the sample. Each breaks the rules its test names."

- [ ] **Step 2: Write the failing tests** in `tests/check/check-note.test.ts`

```ts
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkNote, type CheckOptions } from '../../src/check/check-note.js';
import { openVault } from '../../src/check/vault.js';
import { makeVault } from './fixture.js';

const dir = makeVault({ broken: true });
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const vault = openVault(dir);
const TYPES = 'capture, daily, decision, meeting, organisation, person, product, project, reference, research, topic, work';

const errors = (path: string, options?: CheckOptions) =>
  checkNote(vault, path, options).findings.filter((f) => f.level === 'error').map((f) => f.message);

describe('checkNote errors', () => {
  it('a work note left in Inbox: folder, section and property', () => {
    expect(errors('Inbox/Decide the grace period.md')).toEqual([
      'type is work but the note is in Inbox/; work notes live in Work/',
      'missing section: ## Outcome',
      'unknown property: attendees (work has jira, github, priority, projects, products, and the shared properties)',
    ]);
  });

  it('kind, status and relationship shapes', () => {
    expect(errors('Work/Chase renewal refunds.md')).toEqual([
      'unknown kind: bugg (work kinds are feature, bug, chore, incident, task)',
      'status is doing; work statuses are backlog, active, blocked, review, done, abandoned',
      'github must be a list',
      'projects must be a list of links, such as projects: ["[[Name]]"]',
    ]);
  });

  it('Log must stay last; <% is an error only in a new note', () => {
    expect(checkNote(vault, 'Daily/2026-10-07.md').findings).toEqual([
      { level: 'error', message: '## Log must be the last section' },
      { level: 'warn', message: 'contains <%; Templater only runs it in a new note, so take it out before this text is reused' },
    ]);
    expect(errors('Daily/2026-10-07.md', { isNew: true })).toEqual([
      '## Log must be the last section',
      'contains <%, which Templater would run; remove it',
    ]);
  });

  it('a moment with a status and no date in its name', () => {
    expect(errors('Meetings/Renewals retro.md')).toEqual([
      'meeting has no status; leave status empty',
      'meeting notes are named date first: YYYY-MM-DD title',
    ]);
  });

  it('frontmatter and no body: missing sections, and an error of its own when new', () => {
    const missing = ['missing section: ## Context', 'missing section: ## Checkpoints', 'missing section: ## Outcome'];
    expect(errors('Work/Refund card retries.md')).toEqual(missing);
    expect(errors('Work/Refund card retries.md', { isNew: true })).toEqual([
      'new note has properties and no body; create it from its template through QuickAdd',
      ...missing,
    ]);
  });

  it('an unlinkable file name', () => {
    expect(errors('References/NWA-150 Retry #3 fails.md')).toEqual([
      'file name contains #; replace # ^ [ ] | with a space and : with -',
    ]);
  });

  it('unknown and missing types', () => {
    expect(errors('Inbox/2026-10-07 Memo from the club.md')).toEqual([`unknown type: memo (types are ${TYPES})`]);
    expect(errors('Topics/Loose thoughts.md')).toEqual([`no type; set type to one of: ${TYPES}`]);
  });

  it('broken YAML is one error', () => {
    const found = errors('Projects/Broken frontmatter.md');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^frontmatter is not valid YAML: /);
  });

  it('a converted capture keeps captured, from and url', () => {
    expect(checkNote(vault, 'Work/Ask about grace periods.md').findings).toEqual([]);
  });

  it('a note with Windows line endings and a byte-order mark checks the same', () => {
    const lf = readFileSync(join(dir, 'Work', 'Fix renewal date rollover.md'), 'utf8');
    writeFileSync(join(dir, 'Work', 'Crlf copy.md'), '\uFEFF' + lf.replace(/\n/g, '\r\n'));
    expect(checkNote(vault, 'Work/Crlf copy.md').findings).toEqual([]);
  });

  it('skips an untyped note outside the type folders only when asked', () => {
    writeFileSync(join(dir, 'Home.md'), 'Open the [[Board.base|Board]].\n');
    expect(checkNote(vault, 'Home.md', { skipUntyped: true })).toEqual({ path: 'Home.md', findings: [], skipped: true });
    expect(errors('Home.md')).toEqual([`no type; set type to one of: ${TYPES}`]);
  });
});
```

(The CRLF and Home notes are written after `openVault`; `checkNote` reads the file at call time, so it doesn't need them in `vault.notes`.)

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run tests/check/check-note.test.ts`
Expected: FAIL, cannot resolve `../../src/check/check-note.js`.

- [ ] **Step 4: Implement `checkNote`** in `src/check/check-note.ts`, rules 1–21 in table order, with `parse` from `yaml` (its default `uniqueKeys` makes a duplicate key a parse error). The "first path segment" is the text before the first `/`, so notes in subfolders of a type folder pass. Sections are the keys of `sectionsOf(body)`; extra sections are allowed. Rule 13 runs for every naming, `source-title` included. Errors then warnings: a stable sort on level.

- [ ] **Step 5: Run them to verify they pass**

Run: `npx vitest run tests/check && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/check/check-note.ts tests/check/check-note.test.ts tests/fixtures/check tests/fixtures/README.md
git commit -m "feat(check): checkNote errors from the type definitions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `checkNote`: warnings, the output format, and the sample

**Files:**
- Create: `src/check/links.ts`, `src/check/format.ts`
- Modify: `src/check/check-note.ts`, `tests/kit/examples.test.ts`
- Test: `tests/check/check-note.test.ts`, `tests/check/links.test.ts`

**Interfaces:**
- Produces, in `src/check/links.ts`:
  - `linkTargets(body: string): string[]`: wikilink targets in a note body, in order, without the `|alias` or `#heading`; skips embeds, links in fenced code or code spans, and folder-qualified targets (containing `/`).
  - `frontmatterLinkTarget(value: string): string | undefined`: the target of one `"[[...]]"` relationship value, with the same skips.
  - `nearest(name: string, candidates: Iterable<string>): string | undefined`: the candidate with the smallest case-insensitive edit distance, if it is 2 or less; ties go to the first in sorted order.
- Produces, in `src/check/format.ts`:
  - `formatResult(result: NoteResult): string`: the path, then `  ${level.padEnd(5)}  ${message}` per finding, joined with `\n`.
- `checkNote` gains, after the errors:
  - **Links** (frontmatter `links` values first, then the body; each missing target once): a target with no entry in `vault.names` (lower-cased) warns `[[<target>]] doesn't exist yet; did you mean [[<name>]]?`, where `<name>` is the near match's file name as written (without `.md`), or `[[<target>]] doesn't exist yet` with no near match.
  - **File name**: other notes in `vault.notes` with the same lower-cased name warn `file name also used by <their paths, joined with ", ">`.

- [ ] **Step 1: Write the failing tests**

`tests/check/links.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { frontmatterLinkTarget, linkTargets, nearest } from '../../src/check/links.js';

describe('links', () => {
  it('reads targets the way Obsidian links them, and skips what kiln does not check', () => {
    const body = [
      'See [[Club Console|the console]] and [[Renewal payments#Grace periods]].',
      '![[project-board.base]] `[[Not a link]]`',
      '```',
      '[[Also not a link]]',
      '```',
      '[[Daily/2026-10-07|tomorrow →]] [[#Context]]',
    ].join('\n');
    expect(linkTargets(body)).toEqual(['Club Console', 'Renewal payments']);
  });
  it('reads a relationship value', () => {
    expect(frontmatterLinkTarget('[[Season Ticket Renewals 2027|Renewals]]')).toBe('Season Ticket Renewals 2027');
  });
  it('suggests a near match within two edits', () => {
    expect(nearest('Priya Rahman', ['Club Console', 'Priya Raman'])).toBe('Priya Raman');
    expect(nearest('Someone Else', ['Club Console', 'Priya Raman'])).toBeUndefined();
  });
});
```

Append to `tests/check/check-note.test.ts` (add `import { formatResult } from '../../src/check/format.js';`):

```ts
describe('checkNote warnings and output', () => {
  it("prints the spec's example", () => {
    expect(formatResult(checkNote(vault, 'Inbox/Decide the grace period.md'))).toBe(
      [
        'Inbox/Decide the grace period.md',
        '  error  type is work but the note is in Inbox/; work notes live in Work/',
        '  error  missing section: ## Outcome',
        '  error  unknown property: attendees (work has jira, github, priority, projects, products, and the shared properties)',
        "  warn   [[Priya Rahman]] doesn't exist yet; did you mean [[Priya Raman]]?",
      ].join('\n'),
    );
  });

  it('warns about a file name another note uses', () => {
    expect(checkNote(vault, 'Topics/Priya Raman.md').findings).toEqual([
      { level: 'warn', message: 'file name also used by People/Priya Raman.md' },
    ]);
  });

  it('links in any letter case, with aliases, headings, embeds and code, raise nothing', () => {
    const note = readFileSync(join(dir, 'Topics', 'Renewal payments.md'), 'utf8');
    const extra = '\nSee [[club console|the console]], [[Club Console#Facts]], ![[missing.base]] and `[[Nowhere]]`.\n';
    writeFileSync(join(dir, 'Topics', 'Renewal payments copy.md'), note + extra);
    expect(checkNote(vault, 'Topics/Renewal payments copy.md').findings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/check`
Expected: FAIL: `links.js` and `format.js` don't exist.

- [ ] **Step 3: Implement `src/check/links.ts`, `src/check/format.ts` and the warnings**

`linkTargets` removes fenced blocks, then code spans, then matches non-embed links:

```ts
const text = body.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '');
const targets = [...text.matchAll(/(?<!!)\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)].map((m) => (m[1] ?? '').trim());
return targets.filter((t) => t !== '' && !t.includes('/'));
```

`nearest` is plain Levenshtein on lower-cased strings.

- [ ] **Step 4: Switch `tests/kit/examples.test.ts` to `checkNote`**

Replace the tests `every note matches its definition`, `relationships are lists of links that resolve`, `file names are linkable` and `moments are named date first`, and the `DATE_FIRST` constant, with:

```ts
  it('every note passes the note check', () => {
    const vault = openVault(EXAMPLES, BLUEPRINT);
    const problems = vault.notes.map((n) => checkNote(vault, n)).filter((r) => r.findings.length > 0);
    expect(problems.map(formatResult)).toEqual([]);
  });
```

Import `openVault` from `../../src/check/vault.js`, `checkNote` from `../../src/check/check-note.js`, `formatResult` from `../../src/check/format.js`, and `BLUEPRINT` from `./load.js`. Keep the other tests: they check the sample's content, not the rules. Drop any import that is now unused (oxlint fails on it). Living docs written in this plan must name no `kit/` path; #105's `tests/plugin` checks that.

- [ ] **Step 5: Run all tests**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/check/links.ts src/check/format.ts src/check/check-note.ts tests/check/links.test.ts tests/check/check-note.test.ts tests/kit/examples.test.ts
git commit -m "feat(check): link and file-name warnings; the sample uses checkNote" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `runCheck`: notes, folders, the whole vault and today's changes

**Files:**
- Create: `src/check/run.ts`, `src/cli/kiln-check.ts`
- Modify: `src/check/format.ts`
- Test: `tests/check/run.test.ts`

**Interfaces:**
- Consumes: `findVault`, `openVault` (Task 3), `checkNote` (Tasks 4–5), `formatResult` (Task 5).
- Produces:
  - `summarise(results: NoteResult[]): string` in `format.ts`: `Checked <n> note(s): no problems.` or `Checked <n> note(s): <e> error(s), <w> warning(s).` Skipped notes don't count. Singular for 1.
  - `type RunOptions = { now?: Date; cwd?: string }` and `runCheck(argv: string[], options?: RunOptions): { output: string; exitCode: 0 | 1 | 2 }` in `run.ts`.
  - `src/cli/kiln-check.ts`: `const { output, exitCode } = runCheck(process.argv.slice(2)); process.stdout.write(output + '\n'); process.exitCode = exitCode;`

**Behaviour:**
- Arguments: `parseArgs` from `node:util`, `allowPositionals: true`, boolean options `new`, `today`, `help` (`-h`). An unknown option, `--help` or no positionals gives exit 2 and this output:

  ```
  Usage: node kiln-check.mjs [--today] [--new] <note-or-folder>...
    <note-or-folder>  a note, a folder of notes, or the vault folder for the whole vault
    --today           only notes changed since midnight
    --new             the notes were just created: <% and an empty body are errors
  Exit code: 0 no errors, 1 errors, 2 bad arguments.
  ```

- Each positional resolves against `cwd` (default `process.cwd()`). Its vault is `findVault`; vaults are opened once each. A folder means every note in `vault.notes` under it, checked with `skipUntyped`; a file must end in `.md`. `--today` keeps notes whose modified time is at or after local midnight of `now` (default `new Date()`). Each note is checked once.
- A positional that can't be checked becomes a result for the path as the user typed it, with one error: `no such note or folder`; `not in a kiln vault: no _kiln/types/ folder here or above`; `not a note: kiln checks .md files`; or `can't read the vault's definitions: <the error message>`.
- Output: `formatResult` of every result with findings, separated by blank lines, then a blank line and `summarise`. With no findings, the output is only the summary. Exit 1 if any finding is an error, else 0.

- [ ] **Step 1: Write the failing tests** in `tests/check/run.test.ts`

```ts
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../../src/check/run.js';
import { makeVault } from './fixture.js';

const sample = makeVault();
const broken = makeVault({ broken: true });
const outside = mkdtempSync(join(tmpdir(), 'kiln-outside-'));
afterAll(() => {
  for (const d of [sample, broken, outside]) rmSync(d, { recursive: true, force: true });
});

function fingerprint(dir: string): string {
  const hash = createHash('sha256');
  for (const e of readdirSync(dir, { recursive: true, withFileTypes: true }).filter((x) => x.isFile())) {
    const file = join(e.parentPath, e.name);
    hash.update(file).update(readFileSync(file)).update(String(statSync(file).mtimeMs));
  }
  return hash.digest('hex');
}

describe('runCheck', () => {
  it('passes the whole sample vault', () => {
    expect(runCheck([sample])).toEqual({ output: 'Checked 16 notes: no problems.', exitCode: 0 });
  });

  it('checks only notes changed since midnight with --today', () => {
    const yesterday = new Date(2026, 9, 10, 12, 0);
    for (const e of readdirSync(sample, { recursive: true, withFileTypes: true }).filter((x) => x.isFile())) {
      utimesSync(join(e.parentPath, e.name), yesterday, yesterday);
    }
    const morning = new Date(2026, 9, 11, 8, 0);
    utimesSync(join(sample, 'Work', 'Fix renewal date rollover.md'), morning, morning);
    expect(runCheck(['--today', sample], { now: new Date(2026, 9, 11, 12, 0) }).output).toBe(
      'Checked 1 note: no problems.',
    );
  });

  it('reports errors with exit 1, and carries on past broken YAML', () => {
    const { output, exitCode } = runCheck([broken]);
    expect(exitCode).toBe(1);
    expect(output).toContain('Projects/Broken frontmatter.md\n  error  frontmatter is not valid YAML: ');
    expect(output).toContain('Inbox/Decide the grace period.md\n  error  type is work but the note is in Inbox/');
    expect(output).toMatch(/\n\nChecked 2\d notes: \d+ errors, \d+ warnings\.$/);
  });

  it('warnings alone exit 0', () => {
    expect(runCheck([join(broken, 'Topics', 'Priya Raman.md')]).exitCode).toBe(0);
  });

  it('takes a relative path with spaces and prints it vault-relative with /', () => {
    const { output } = runCheck(['Inbox/Decide the grace period.md'], { cwd: broken });
    expect(output.startsWith('Inbox/Decide the grace period.md\n  error  type is work')).toBe(true);
  });

  it('names paths it cannot check, without throwing', () => {
    writeFileSync(join(outside, 'stray.md'), 'x');
    writeFileSync(join(broken, 'Work', 'notes.txt'), 'x');
    const missing = join(broken, 'Nope.md');
    const stray = join(outside, 'stray.md');
    const txt = join(broken, 'Work', 'notes.txt');
    const { output, exitCode } = runCheck([missing, stray, txt]);
    expect(exitCode).toBe(1);
    expect(output).toContain(`${missing}\n  error  no such note or folder`);
    expect(output).toContain(`${stray}\n  error  not in a kiln vault: no _kiln/types/ folder here or above`);
    expect(output).toContain(`${txt}\n  error  not a note: kiln checks .md files`);
  });

  it("reports a malformed vault definition as an error, not a crash", () => {
    const bad = makeVault();
    writeFileSync(join(bad, '_kiln', 'types', 'work.md'), '---\nname: work\nfolder: Work\nnaming: sideways\n---\nx\n');
    const { output, exitCode } = runCheck([bad]);
    rmSync(bad, { recursive: true, force: true });
    expect(exitCode).toBe(1);
    expect(output).toContain("error  can't read the vault's definitions: types/work.md: naming must be one of");
  });

  it('exits 2 with usage for bad arguments', () => {
    expect(runCheck([]).exitCode).toBe(2);
    expect(runCheck(['--frobnicate', sample])).toMatchObject({ exitCode: 2, output: expect.stringMatching(/^Usage: /) });
  });

  it('never writes to the vault', () => {
    const before = fingerprint(broken);
    runCheck(['--new', broken]);
    expect(fingerprint(broken)).toBe(before);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/check/run.test.ts`
Expected: FAIL, cannot resolve `../../src/check/run.js`.

- [ ] **Step 3: Implement `summarise`, `runCheck` and `src/cli/kiln-check.ts`**

- [ ] **Step 4: Run all tests**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/check/run.ts src/check/format.ts src/cli/kiln-check.ts tests/check/run.test.ts
git commit -m "feat(check): runCheck for notes, folders, the whole vault and today's changes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Bundle `kiln-check.mjs`, and check bundles in CI

**Files:**
- Create: `scripts/build.mjs`, `claude-plugin/scripts/kiln-check.mjs` (generated)
- Modify: `package.json`, `package-lock.json`, `.prettierignore`, `.oxlintrc.json`, `.github/workflows/ci.yml`, `CLAUDE.md`
- Test: `tests/check/bundle.test.ts`

**Interfaces:**
- Consumes: `src/cli/kiln-check.ts` (Task 6).
- Produces: `npm run build` (writes every `claude-plugin/scripts/<name>.mjs` from `src/cli/<name>.ts`) and `npm run build:check` (exit 1 naming each missing, stale or orphaned bundle). Later tickets (#81, #72) add an entry point in `src/cli/` and nothing else.

- [ ] **Step 1: Write the failing test** in `tests/check/bundle.test.ts`

```ts
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { makeVault } from './fixture.js';

const BUNDLE = fileURLToPath(new URL('../../claude-plugin/scripts/kiln-check.mjs', import.meta.url));
const sample = makeVault();
const broken = makeVault({ broken: true });
afterAll(() => {
  for (const d of [sample, broken]) rmSync(d, { recursive: true, force: true });
});

const run = (...args: string[]) => spawnSync(process.execPath, [BUNDLE, ...args], { encoding: 'utf8' });

describe('kiln-check.mjs', () => {
  it('runs with plain node and passes the sample', () => {
    const r = run(sample);
    expect(r.stderr).toBe('');
    expect(r.stdout).toBe('Checked 16 notes: no problems.\n');
    expect(r.status).toBe(0);
  });
  it('exits 1 on errors', () => {
    expect(run(join(broken, 'Work', 'Chase renewal refunds.md')).status).toBe(1);
  });
  it('exits 2 on bad arguments', () => {
    expect(run().status).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/check/bundle.test.ts`
Expected: FAIL: the bundle doesn't exist (`Cannot find module`).

- [ ] **Step 3: Add esbuild and the build script**

Run: `npm install --save-dev --save-exact esbuild` (the repo `.npmrc` points at the public registry). An exact version keeps bundles byte-identical between machines and CI.

`scripts/build.mjs`:

```js
// Bundles each src/cli/<name>.ts into claude-plugin/scripts/<name>.mjs, one file with its dependencies inlined.
// With --check, rebuilds in memory and fails if a committed bundle is missing, stale or has no source.
import { build } from 'esbuild';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src', 'cli');
const OUT = join(ROOT, 'claude-plugin', 'scripts');
const check = process.argv.includes('--check');

const { outputFiles } = await build({
  absWorkingDir: ROOT, // keeps the path comments in bundles the same on every machine
  entryPoints: readdirSync(SRC).filter((f) => f.endsWith('.ts')).sort().map((f) => join(SRC, f)),
  outdir: OUT,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  write: false,
  logLevel: 'warning',
  banner: {
    js: [
      '// Built from src/cli by `npm run build`. Edit src/ and rebuild; do not edit this file.',
      "import { createRequire } from 'node:module';",
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
});

if (!check) {
  mkdirSync(OUT, { recursive: true });
  for (const file of outputFiles) writeFileSync(file.path, file.text);
  console.log(`Built ${outputFiles.map((f) => basename(f.path)).join(', ')}`);
} else {
  const built = new Set(outputFiles.map((f) => basename(f.path)));
  const stale = outputFiles
    .filter((f) => !existsSync(f.path) || readFileSync(f.path, 'utf8').replace(/\r\n/g, '\n') !== f.text)
    .map((f) => basename(f.path));
  const orphans = existsSync(OUT) ? readdirSync(OUT).filter((f) => f.endsWith('.mjs') && !built.has(f)) : [];
  if (stale.length || orphans.length) {
    if (stale.length) console.error(`Out of date: ${stale.join(', ')}. Run npm run build and commit claude-plugin/scripts.`);
    if (orphans.length) console.error(`No source in src/cli for: ${orphans.join(', ')}.`);
    process.exit(1);
  }
  console.log('Bundles match src/.');
}
```

(The `createRequire` banner lets bundled CommonJS code, such as `yaml`'s Node build, `require` Node's built-ins from an ES module.)

In `package.json` `scripts`, add `"build": "node scripts/build.mjs"` and `"build:check": "node scripts/build.mjs --check"`. Update its `description` to: "kiln: a personal knowledge and work process built on Obsidian. This package builds and tests kiln's scripts; the plugin is claude-plugin/."

Add `claude-plugin/scripts/` to `.prettierignore` (with a comment: "Generated by npm run build.") and `"claude-plugin/scripts/**"` to `ignorePatterns` in `.oxlintrc.json`.

- [ ] **Step 4: Build, and run the tests and the currency check**

Run: `npm run build && npx vitest run tests/check/bundle.test.ts && npm run build:check`
Expected: `Built kiln-check.mjs`; the bundle tests PASS; `Bundles match src/.`

Then confirm the check fails when it should. Run `node -e "require('fs').appendFileSync('claude-plugin/scripts/kiln-check.mjs','//x')"`, then `npm run build:check`.
Expected: exit 1 and `Out of date: kiln-check.mjs.` Run `npm run build` to restore the bundle; `git status --short claude-plugin/scripts` then shows only the new file.

- [ ] **Step 5: CI and CLAUDE.md**

In `.github/workflows/ci.yml`, job `check`, add after `- run: npm test`:

```yaml
      - run: npm run build:check
```

In `CLAUDE.md`, "Environment": change the "Before pushing" item to list `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run build:check`, and add one item: "**Code** is in `src/`. `npm run build` bundles each `src/cli/<name>.ts` into `claude-plugin/scripts/<name>.mjs`, one file with its dependencies; commit the bundle with its source. The plugin has no `package.json`."

- [ ] **Step 6: Run everything**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build:check`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/build.mjs claude-plugin/scripts/kiln-check.mjs package.json package-lock.json .prettierignore .oxlintrc.json .github/workflows/ci.yml CLAUDE.md tests/check/bundle.test.ts
git commit -m "build: bundle kiln-check.mjs with esbuild; CI checks bundles match src" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The `/kiln:check` skill

**Files:**
- Create: `claude-plugin/skills/check/SKILL.md`
- Modify: `claude-plugin/blueprint/README.md`
- Test: `tests/check/skill.test.ts`

**Interfaces:**
- Consumes: `claude-plugin/scripts/kiln-check.mjs`, its arguments and exit codes (Tasks 6–7).
- Produces: `/kiln:check`. Its "Find the vault" step is the seam #81 replaces with the resolver; nothing else in the skill depends on how the vault is found.

- [ ] **Step 1: Write the failing test** in `tests/check/skill.test.ts`

```ts
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { splitFrontmatter } from '../../src/blueprint/markdown.js';

const PLUGIN = fileURLToPath(new URL('../../claude-plugin/', import.meta.url));
const skill = readFileSync(`${PLUGIN}skills/check/SKILL.md`, 'utf8');
const { frontmatter, body } = splitFrontmatter(skill);
const meta = parse(frontmatter) as { name: string; description: string };

describe('/kiln:check', () => {
  it('is named check, with a description that keeps to kiln work', () => {
    expect(meta.name).toBe('check');
    expect(meta.description).toMatch(/kiln/);
    expect(meta.description.length).toBeLessThanOrEqual(300);
  });
  it('runs the bundled script for the whole vault and for today', () => {
    expect(body).toContain('node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" "<vault>"');
    expect(body).toContain('node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" --today "<vault>"');
    expect(existsSync(`${PLUGIN}scripts/kiln-check.mjs`)).toBe(true);
  });
  it('falls back to reading the definitions without Node, and never writes to notes unasked', () => {
    for (const part of ['node --version', '_kiln/types/', '_kiln/properties.md', 'Obsidian CLI', '<%']) {
      expect(body, part).toContain(part);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/check/skill.test.ts`
Expected: FAIL, `ENOENT` for `SKILL.md`.

- [ ] **Step 3: Write `claude-plugin/skills/check/SKILL.md`**

````markdown
---
name: check
description: Check notes in a kiln vault against their type definitions (folder, type, kind, status, properties, sections, file name). Use when the owner runs /kiln:check, or asks to check their kiln vault, kiln notes or today's kiln changes.
---

# Check kiln notes

Checks notes against the type definitions in the vault's `_kiln/types/`. The check never changes a note.

## 1. Find the vault

<!-- The vault resolver replaces this step when it lands. -->
Use the vault folder the owner named. Otherwise use the current folder, if it or a folder above it holds `_kiln/types/`. Otherwise ask the owner for the vault folder.

## 2. Run the check

The whole vault, unless the owner asks for today's changes:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" "<vault>"
```

Today's changes (notes modified since midnight):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" --today "<vault>"
```

To check particular notes or folders, pass their paths instead of `<vault>`. The commands are the same in Bash and pwsh. Exit code 0 means no errors (there may be warnings), 1 means errors, 2 means the arguments were wrong.

**Without Node:** if `node --version` fails or shows a version below 24, check by hand. For each note, read its `type`, then `_kiln/types/<type>.md` and `_kiln/properties.md`, and apply the rules below. Report in the same format as the script.

## 3. Report, then offer fixes

Show the output as it is: each note's path, then its `error` and `warn` lines. Then offer to fix the errors, and change a note only when the owner agrees. Move and rename notes through the Obsidian CLI, so links follow. Never write `<%` into a note.

## The rules

| Result | Rule |
|---|---|
| Error | Wrong folder, type, kind or status |
| Error | A section of the type is missing (extra sections are fine), or the daily note's Log isn't last |
| Error | A property that isn't shared, optional or the type's own; a relationship that isn't a list of links |
| Error | A file name that breaks the type's `naming`, or contains `#`, `^`, `[`, `]`, `\|` or `:` |
| Error | A new note with properties and no body, or with `<%` |
| Warning | A link to a note that doesn't exist yet (suggest a near match) |
| Warning | A file name another note uses |
| Warning | `<%` in an existing note |
````

- [ ] **Step 4: Point the blueprint README at it**

In `claude-plugin/blueprint/README.md`, "Conventions", add: "**Check notes** with `/kiln:check`. It checks each note against its definition and never changes a note."

- [ ] **Step 5: Run everything, and validate the plugin**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build:check`
Expected: all PASS.

Run: `claude plugin validate .`
Expected: `✔ Validation passed with warnings`, the only warning being the expected no-version one. (Validate only; never install the plugin into your own Claude Code config.)

- [ ] **Step 6: Commit**

```bash
git add claude-plugin/skills/check/SKILL.md claude-plugin/blueprint/README.md tests/check/skill.test.ts
git commit -m "feat(plugin): /kiln:check runs the note check on the vault or today's changes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Not in this plan

- The shared vault rules (`claude-plugin/reference/vault-rules.md`) saying flows run `kiln-check` at their end: #82.
- The vault resolver that replaces the skill's "Find the vault" step: #81.
- The spec's open questions: a per-type `required` list, machine-readable Log line formats, the check inside an Obsidian plugin.

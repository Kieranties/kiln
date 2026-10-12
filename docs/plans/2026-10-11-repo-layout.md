# Repo layout: the Claude plugin and the blueprint, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the kit to `claude-plugin/blueprint/` as its only copy, and make the repo a one-plugin marketplace (`kiln@kiln`) whose empty plugin installs, with `npx vitest run tests/kit` still passing.

**Architecture:** `git mv kit claude-plugin/blueprint`, and point `tests/kit/load.ts` at the new folder. A catalog at `.claude-plugin/marketplace.json` lists one plugin from `./claude-plugin`, and `claude-plugin/.claude-plugin/plugin.json` has no `version`, so Claude Code uses the commit SHA. A new `tests/plugin/layout.test.ts` pins the catalog, the manifest, the plugin folder, the release zip path and the living docs' links. No `src/` yet; #83 adds it.

**Tech Stack:** Node 24, TypeScript 7 ESM, vitest, oxlint, Prettier, `yaml` (already a devDependency), GitHub Actions, Claude Code 2.1.296 (`claude plugin validate`).

**Spec:** [Repo layout: the Claude plugin, the blueprint and later code](../specs/2026-10-11-repo-layout-design.md), for #105.

## Global Constraints

- **Public repo.** Nothing committed may contain employer or client names, private links, or real local paths. Paths in code, tests and docs are examples such as `D:\src\kiln` or `D:\tmp\kiln-claude`. Test data and examples use the fictional Northwind Arena organisation.
- **Names.** The plugin folder is `claude-plugin/`. The kit is renamed the **blueprint** and lives only in `claude-plugin/blueprint/`. The catalog is `.claude-plugin/marketplace.json` at the repo root, with source `./claude-plugin`. The plugin manifest is `claude-plugin/.claude-plugin/plugin.json`. The plugin name is `kiln` and the marketplace name is `kiln`, so the install id is `kiln@kiln`.
- **No `version`** in `plugin.json` or in the catalog entry. Claude Code then uses the commit SHA. `claude plugin validate` warns about it; that warning is expected.
- **No `package.json` or lockfile in `claude-plugin/`**, and no symlinks. Claude Code would run `npm install` on every install, and Git for Windows checks symlinks out as text.
- **Install commands,** the same in Bash and pwsh: `claude plugin marketplace add Kieranties/kiln`, then `claude plugin install kiln@kiln`. To test a branch: `claude plugin marketplace add Kieranties/kiln#some-branch`.
- **Every command in docs works in both Bash and pwsh.** Give both forms where they differ.
- **Never install the plugin into your own Claude Code config.** Validate with `claude plugin validate .`, and try installs only with `CLAUDE_CONFIG_DIR` pointing at a throwaway folder.
- **The dated plans under `docs/plans/` stay as written.** The living docs move with the rename: `README.md`, `CLAUDE.md`, the blueprint's guides, the layer 1 design, `docs/vision.md` and `tests/fixtures/README.md`. The #79 design notes are decision records and keep saying "kit". Only their two `kit/...` file paths are corrected (Task 3).
- **Release asset** is renamed from `kiln-kit-<version>.zip` to `kiln-blueprint-<version>.zip`.
- **`tests/kit/` keeps its name.** The #105 "Done when" and the #83 note-check design both cite `npx vitest run tests/kit`, and #83 moves its loading code into `src/` anyway. Only its constant `KIT` becomes `BLUEPRINT`.
- **Commits** stage explicit paths (never `git add -A` or `git add .`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Docs style:** plain British English and short sentences, as in the existing docs.

## Review Focus

1. **A living doc still links to `kit/`** after the move, so someone following Getting started finds no file. *Expect:* every relative link resolves and no `kit/` path remains. Covered by `the living docs` tests (Task 3).
2. **The catalog and manifest drift apart, or a `version` creeps in.** A name mismatch breaks `kiln@kiln`, and a version pins users to an old release. *Expect:* the names match and neither file has a `version`. Covered by `the plugin manifest` tests (Task 2).
3. **A `package.json` or lockfile lands in `claude-plugin/`** (for example when #83 adds bundling), and every install runs `npm install`, which fails behind a private registry. *Expect:* none of those files exist. Covered by `the plugin folder` tests (Task 2).
4. **A second copy of the blueprint, or a symlink to it,** comes back at the repo root. *Expect:* the blueprint exists only under `claude-plugin/`, with no symlinks. Covered by `the plugin folder` tests (Task 2).
5. **The release job still zips `kit/`.** The `check` job doesn't run it, so it would fail only after the merge to `main`. *Expect:* the zip step reads `claude-plugin/blueprint` and names `kiln-blueprint-$VERSION.zip`. Covered by `the release` test (Task 2).

## Baseline and expected counts

Measured before any change: `npx vitest run` gives **6 files, 76 passed, 1 skipped (77)**. The skipped test is the denylist check, which skips when `tests/fixtures/denylist.txt` is absent. All of this plan was trialled on a copy of the repo with the same counts.

| After | `npx vitest run` |
|---|---|
| Task 1 | 6 files, 76 passed, 1 skipped (77) |
| Task 2 | 7 files, 84 passed, 1 skipped (85) |
| Task 3 | 7 files, 86 passed, 1 skipped (87) |

---

### Task 1: Move the kit to `claude-plugin/blueprint/`

**Files:**
- Move: `kit/` → `claude-plugin/blueprint/` (all 76 tracked files, unchanged)
- Modify: `tests/kit/load.ts`, `tests/kit/docs.test.ts`, `tests/kit/examples.test.ts`, `tests/kit/settings.test.ts`, `tests/kit/views.test.ts`
- Modify: `.github/workflows/ci.yml` (release job)

**Interfaces:**
- Produces: `export const BLUEPRINT: string` in `tests/kit/load.ts`, the absolute path of `claude-plugin/blueprint/` with a trailing separator. It replaces `KIT`, and every importer uses the new name.

- [ ] **Step 1: Move the folder**

```bash
mkdir claude-plugin
git mv kit claude-plugin/blueprint
```

(`git mv` fails if `claude-plugin/` doesn't exist yet.)

- [ ] **Step 2: Run the blueprint tests and see them fail**

Run: `npx vitest run tests/kit`
Expected: FAIL. `docs.test.ts` fails on `ENOENT ... kit/README.md`, and the others fail on `kit/types is missing`.

- [ ] **Step 3: Point the loader at the blueprint**

In `tests/kit/load.ts`:
- `export const KIT = fileURLToPath(new URL('../../kit/', import.meta.url));` becomes `export const BLUEPRINT = fileURLToPath(new URL('../../claude-plugin/blueprint/', import.meta.url));`.
- Rename every use of `KIT` to `BLUEPRINT`, in `load.ts` and in the four test files that import it. In `examples.test.ts` the import goes away in Step 4.
- In `load.ts`'s comments and error messages, `kit/` becomes `blueprint/` and "the kit" becomes "the blueprint". For example: ``throw new Error(`blueprint/types is missing (${dir})`)``.
- Test titles: `settings.test.ts` `'app settings hide properties and keep the blueprint out of search'`; `views.test.ts` `'views that match on type alone leave out the blueprint templates'`.

- [ ] **Step 4: Widen the denylist check to the whole plugin folder**

In `tests/kit/examples.test.ts`, add `const PLUGIN = join(REPO, 'claude-plugin');` after `DOCS`. The scan becomes `[...filesUnder(PLUGIN), ...filesUnder(EXAMPLES), ...filesUnder(DOCS), ...TOP_LEVEL]`, and the test title becomes `"the plugin, the sample and the docs contain no real names from the owner's organisation"`. Drop the now-unused `BLUEPRINT` import, or oxlint fails on `no-unused-vars`.

- [ ] **Step 5: Zip the blueprint from its new path in the release job**

In `.github/workflows/ci.yml`:
- Header comment, lines 2–3: `...tagged v0.2.<n>, with the blueprint` / `# attached as kiln-blueprint-<version>.zip. main is squash-merge only, ...`
- The step `Zip the kit` becomes:

```yaml
      - name: Zip the blueprint
        run: |
          mkdir -p dist
          (cd claude-plugin/blueprint && zip -r "../../dist/kiln-blueprint-$VERSION.zip" .)
```

- In `Create the tag and GitHub Release`, `"dist/kiln-kit-$VERSION.zip"` becomes `"dist/kiln-blueprint-$VERSION.zip"`.

- [ ] **Step 6: Format, then run the tests and see them pass**

Run: `npx prettier --write tests/kit`. The longer import in `views.test.ts` wraps onto several lines.
Run: `npx vitest run tests/kit`
Expected: PASS, 6 files, 76 passed, 1 skipped (77).
Run: `npm run lint` and `npm run typecheck`. Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add claude-plugin/blueprint kit tests/kit/load.ts tests/kit/docs.test.ts tests/kit/examples.test.ts tests/kit/settings.test.ts tests/kit/views.test.ts .github/workflows/ci.yml
git commit -m "refactor: move the kit to claude-plugin/blueprint (#105)" -m "The kit is renamed the blueprint and claude-plugin/blueprint/ is its only copy. tests/kit reads it there, and the release attaches kiln-blueprint-<version>.zip." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git add kit` stages the deletions that `git mv` recorded. It is harmless if they are already staged.)

---

### Task 2: The catalog, the plugin manifest and their checks

**Files:**
- Create: `tests/plugin/layout.test.ts`
- Create: `.claude-plugin/marketplace.json`
- Create: `claude-plugin/.claude-plugin/plugin.json`
- Modify: `tests/kit/examples.test.ts` (`TOP_LEVEL`)

**Interfaces:**
- Consumes: the `claude-plugin/blueprint/` folder from Task 1, and the release step named `Zip the blueprint`.
- Produces: `tests/plugin/layout.test.ts` with module constants `REPO` and `PLUGIN` (absolute paths). Task 3 appends a `describe('the living docs')` block that uses them.

- [ ] **Step 1: Write the failing test**

`tests/plugin/layout.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const PLUGIN = join(REPO, 'claude-plugin');

type Entry = { name: string; source: string; version?: string };
type Catalog = { name: string; owner: { name: string }; plugins: Entry[] };
type Manifest = { name: string; version?: string };

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const catalog = readJson<Catalog>(join(REPO, '.claude-plugin', 'marketplace.json'));
const manifest = readJson<Manifest>(join(PLUGIN, '.claude-plugin', 'plugin.json'));

describe('the catalog', () => {
  it('is the kiln marketplace, listing one plugin, kiln, from ./claude-plugin', () => {
    expect(catalog.name).toBe('kiln');
    expect(catalog.owner.name).not.toBe('');
    expect(catalog.plugins.map((p) => [p.name, p.source])).toEqual([['kiln', './claude-plugin']]);
  });

  it('points at a folder with a plugin manifest', () => {
    for (const entry of catalog.plugins) {
      expect(entry.source, entry.name).toMatch(/^\.\/[^.]/);
      expect(existsSync(join(REPO, entry.source, '.claude-plugin', 'plugin.json')), entry.source).toBe(true);
    }
  });
});

describe('the plugin manifest', () => {
  it('has the same name as its catalog entry', () => {
    expect(manifest.name).toBe(catalog.plugins[0]?.name);
  });

  it('has no version, here or in the catalog, so the commit SHA is the version', () => {
    expect(manifest).not.toHaveProperty('version');
    for (const entry of catalog.plugins) expect(entry, entry.name).not.toHaveProperty('version');
  });
});

describe('the plugin folder', () => {
  it('holds the only copy of the blueprint', () => {
    expect(existsSync(join(PLUGIN, 'blueprint', 'types'))).toBe(true);
    expect(existsSync(join(REPO, 'kit'))).toBe(false);
  });

  it('has no package manifest or lockfile, so installing it never runs npm', () => {
    // Claude Code runs npm install for a plugin with a package.json and a lockfile.
    for (const file of ['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml']) {
      expect(existsSync(join(PLUGIN, file)), file).toBe(false);
    }
  });

  it('has no symlinks', () => {
    // Git for Windows checks a symlink out as a text file holding its target.
    const links = readdirSync(PLUGIN, { recursive: true, withFileTypes: true })
      .filter((e) => e.isSymbolicLink())
      .map((e) => join(e.parentPath, e.name));
    expect(links).toEqual([]);
  });
});

describe('the release', () => {
  it('zips the blueprint from where it lives', () => {
    type Step = { name?: string; run?: string };
    const ci = parse(readFileSync(join(REPO, '.github', 'workflows', 'ci.yml'), 'utf8')) as {
      jobs: { release: { steps: Step[] } };
    };
    const steps = ci.jobs.release.steps;
    const zip = steps.find((s) => s.name === 'Zip the blueprint')?.run ?? '';
    const dir = /\(cd (\S+) && zip -r "[./]*dist\/kiln-blueprint-\$VERSION\.zip" \.\)/.exec(zip)?.[1];
    expect(dir).toBe('claude-plugin/blueprint');
    expect(steps.some((s) => s.run?.includes('"dist/kiln-blueprint-$VERSION.zip"'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run tests/plugin`
Expected: FAIL with `ENOENT: no such file or directory, open '...\.claude-plugin\marketplace.json'` (no tests run).

- [ ] **Step 3: Write the catalog and the manifest**

`.claude-plugin/marketplace.json`:

```json
{
  "name": "kiln",
  "description": "kiln: a personal knowledge and work system built on Obsidian, with the Claude plugin that works in it.",
  "owner": {
    "name": "Kieranties",
    "url": "https://github.com/Kieranties"
  },
  "plugins": [
    {
      "name": "kiln",
      "source": "./claude-plugin"
    }
  ]
}
```

`claude-plugin/.claude-plugin/plugin.json`:

```json
{
  "name": "kiln",
  "description": "kiln's Claude skills and the blueprint they apply to an Obsidian vault.",
  "author": {
    "name": "Kieranties",
    "url": "https://github.com/Kieranties"
  },
  "homepage": "https://github.com/Kieranties/kiln",
  "repository": "https://github.com/Kieranties/kiln",
  "license": "MIT",
  "keywords": ["obsidian", "knowledge", "notes"]
}
```

The entry has no `description`. For a relative-path source, Claude Code shows the description from `plugin.json`, so it lives in one place. Don't add `$schema`, because the docs give no schema URL. Don't add `skills/`, `reference/` or `scripts/` folders: git doesn't track empty folders, and #82, #83 and #72 add them with content.

- [ ] **Step 4: Scan the catalog for denylisted names too**

In `tests/kit/examples.test.ts`, add `'.claude-plugin/marketplace.json'` to the end of the `TOP_LEVEL` list, then run `npx prettier --write tests/kit/examples.test.ts`. The line wraps.

- [ ] **Step 5: Run the tests and see them pass**

Run: `npx vitest run`
Expected: PASS, 7 files, 84 passed, 1 skipped (85).

- [ ] **Step 6: Validate with Claude Code**

Run: `claude plugin validate .`
Expected: the output ends with `✔ Validation passed with warnings`, and the only warning is `plugins[0] plugin.json → version: No version specified...`. It may also print advice that the README has no install line; Task 3 adds one. It must not print `Validation failed`.

- [ ] **Step 7: Commit**

```bash
git add .claude-plugin/marketplace.json claude-plugin/.claude-plugin/plugin.json tests/plugin/layout.test.ts tests/kit/examples.test.ts
git commit -m "feat(plugin): the kiln marketplace and an empty kiln plugin (#105)" -m "The repo root's .claude-plugin/marketplace.json lists one plugin, kiln, from ./claude-plugin. Its plugin.json has no version, so Claude Code uses the commit SHA. tests/plugin checks the catalog, the manifest, the plugin folder and the release zip path." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Living docs for the rename and the install

**Files:**
- Modify: `tests/plugin/layout.test.ts` (append one `describe`)
- Modify: `tests/kit/docs.test.ts`
- Modify: `README.md`, `CLAUDE.md`
- Modify: `claude-plugin/blueprint/README.md`, `claude-plugin/blueprint/GETTING-STARTED.md`, `claude-plugin/blueprint/TRY-THE-SAMPLE.md`
- Modify: `docs/specs/2026-10-11-layer-1-structure-design.md`, `docs/vision.md`, `tests/fixtures/README.md`
- Modify (one file path each): `docs/specs/2026-10-11-vault-access-design.md`, `docs/specs/2026-10-11-vault-setup-design.md`
- Modify: `package.json` (`description` only), `.gitattributes` (comment only)

**Interfaces:**
- Consumes: `REPO` and `PLUGIN` from `tests/plugin/layout.test.ts` (Task 2).

- [ ] **Step 1: Write the failing tests**

Append to `tests/plugin/layout.test.ts`:

```ts
describe('the living docs', () => {
  // The dated plans and the design notes are records, and keep the paths they were written with.
  const LIVING = [
    'README.md',
    'CLAUDE.md',
    'docs/vision.md',
    'docs/specs/2026-10-11-layer-1-structure-design.md',
    'tests/fixtures/README.md',
    ...readdirSync(join(PLUGIN, 'blueprint'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => `claude-plugin/blueprint/${f}`),
  ];
  const text = (doc: string) => readFileSync(join(REPO, doc), 'utf8');

  it('link only to files that exist', () => {
    const broken: string[] = [];
    for (const doc of LIVING) {
      for (const [, target = ''] of text(doc).matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const path = join(REPO, doc, '..', decodeURI(target.split('#')[0] ?? ''));
        if (!existsSync(path)) broken.push(`${doc}: ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('name no kit/ path, since the kit is now the blueprint', () => {
    const stale = LIVING.filter((doc) => /(?<![\w/])kit\//.test(text(doc)));
    expect(stale).toEqual([]);
  });
});
```

The look-behind lets `tests/kit/` through and catches `kit/`, `` `kit/` `` and `../../kit/`.

In `tests/kit/docs.test.ts`, rename to match the README heading changed in Step 3: `describe('blueprint docs', ...)`, `section(readme, 'What the blueprint is')` and `'setting up a vault copies all three blueprint docs'`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/plugin tests/kit/docs.test.ts`
Expected: FAIL, 3 tests. `link only to files that exist` lists 8 broken links: three each in `README.md` and `CLAUDE.md`, one in `tests/fixtures/README.md`, and `claude-plugin/blueprint/README.md: ../docs/specs/...`. `name no kit/ path` lists `README.md`, `CLAUDE.md`, the layer 1 design, `tests/fixtures/README.md`, `GETTING-STARTED.md` and `TRY-THE-SAMPLE.md`. The property-list test in `docs.test.ts` fails with `no section What the blueprint is`.

- [ ] **Step 3: Update the docs**

In every file below, "kit" meaning the artefact becomes "blueprint", and the paths change as listed. Keep `tests/kit/` and `npx vitest run tests/kit` as they are.

`README.md`:
- The three "Get started" links point at `claude-plugin/blueprint/GETTING-STARTED.md`, `.../TRY-THE-SAMPLE.md` and `.../README.md`, with "the kiln blueprint", "the whole blueprint" and "**[The kiln blueprint](claude-plugin/blueprint/README.md):** the types, conventions and how the blueprint is applied."
- `Each release on GitHub also carries the blueprint as \`kiln-blueprint-<version>.zip\`.`
- After that line, add:

  ````markdown
  ### The Claude plugin

  This repo is also a Claude Code plugin marketplace with one plugin, `kiln`. The commands are the same in Bash and PowerShell:

  ```
  claude plugin marketplace add Kieranties/kiln
  claude plugin install kiln@kiln
  ```

  For now the plugin carries only the blueprint; its skills come with later work. To try a branch, add the marketplace at that branch instead: `claude plugin marketplace add Kieranties/kiln#some-branch`.
  ````

- In "What's in the repo", replace the `kit/` and `tests/kit/` rows with:

  ```markdown
  | `.claude-plugin/marketplace.json` | The catalog: one plugin, `kiln`, from `./claude-plugin` |
  | `claude-plugin/` | The Claude plugin, and nothing else. Its manifest is `claude-plugin/.claude-plugin/plugin.json`, with no version: the plugin's version is the commit |
  | `claude-plugin/blueprint/` | The blueprint: type definitions, Templater templates, Bases views, Obsidian and plugin settings, and its guides |
  | `tests/kit/` | Checks every blueprint file against the type definitions, and the sample against both |
  | `tests/plugin/` | Checks the catalog, the plugin manifest and folder, the release zip, and the living docs' links |
  ```

- "Working on kiln": "with the kit attached" becomes "with the blueprint attached". At the end of that paragraph, add: `To check the catalog and the plugin, run \`claude plugin validate .\`; its warning that the plugin has no version is expected.`

`CLAUDE.md`:
- Replace the "**The kit**" row of "Start here" with:

  ```markdown
  | **The blueprint** (types, templates, views, settings), its guides and checks | [claude-plugin/blueprint/README.md](claude-plugin/blueprint/README.md), [Getting started](claude-plugin/blueprint/GETTING-STARTED.md), [Try the sample](claude-plugin/blueprint/TRY-THE-SAMPLE.md); tests in `tests/kit/` |
  | **The Claude plugin** and its catalog | `claude-plugin/` (manifest in `claude-plugin/.claude-plugin/plugin.json`), the catalog in `.claude-plugin/marketplace.json`, and the [repo layout](docs/specs/2026-10-11-repo-layout-design.md); tests in `tests/plugin/` |
  ```

- Between the table and the "kiln 0.1" paragraph, add: `The blueprint was called the kit, at the repo root, until #105. The dated plans and the design notes still call it the kit.` This line must not contain the path `kit/`.
- Working rules: `**The blueprint's type definitions are the source of truth.**`
- Environment, "Before pushing": "with the blueprint attached as a zip".
- Environment, a new bullet before "Machine-specific notes": `- **The plugin:** \`claude plugin validate .\` checks the catalog and the plugin; its warning that the plugin has no version is expected. To try an install, point \`CLAUDE_CONFIG_DIR\` at a throwaway folder first, so your own Claude Code config is never touched.`

`claude-plugin/blueprint/README.md`:
- `# The kiln blueprint`; "To see the whole blueprint working first"; "The blueprint is kiln's vault structure for Obsidian"; `## What the blueprint is`; "`tests/kit/` checks every blueprint file against the definitions"; "The steps for whoever applies the blueprint"; `**Copy the blueprint in.**`; in the settings table: "the blueprint's folders" (twice), "put the blueprint's rules first", "then add the blueprint's".
- The design link moves one level deeper: `(../../docs/specs/2026-10-11-layer-1-structure-design.md)`.

`claude-plugin/blueprint/GETTING-STARTED.md`:
- `# Getting started with the kiln blueprint`; "sets up your vault with the kiln blueprint"; "so the blueprint can't set it for you"; "so the blueprint must be applied while it is closed"; `## 3. Apply the blueprint`; "a `_kiln` folder holding the blueprint".
- Prompts: `Set up the kiln blueprint in <vault folder> by following "Setting up a vault" in claude-plugin/blueprint/README.md exactly.` and `Add a "runbook" type to the kiln blueprint: ...` / `Follow "Adding or changing a type" in claude-plugin/blueprint/README.md, then apply it to <vault folder>.`
- Last bullet: `- **How the blueprint works:** [The kiln blueprint](README.md) covers the types, conventions and how the blueprint is applied.`
- Leave the clone-and-prompt flow as it is. #72 rewrites Getting started around `/kiln:setup`, and the plugin has no skills yet, so the guide doesn't mention the plugin install.

`claude-plugin/blueprint/TRY-THE-SAMPLE.md`: "see the whole blueprint working"; "It applies the blueprint and adds the sample:"; the prompt reads `Set up the kiln blueprint in <trial vault folder> by following "Setting up a vault" in claude-plugin/blueprint/README.md exactly.`

`docs/specs/2026-10-11-layer-1-structure-design.md`:
- Status: `Status: **built and checked** (2026-10-11), as the blueprint in \`claude-plugin/blueprint/\` (the kit until #105). Nothing here is final.`
- `### The blueprint`. Its first paragraph becomes: `The repo holds the blueprint under \`claude-plugin/blueprint/\`, inside kiln's Claude plugin: the type definitions, templates and view files. It is structure only, with no knowledge. A vault is set up by copying the blueprint into the vault as \`_kiln/\` and having Claude apply it.`
- "Community plugins in the blueprint"; "The blueprint ships the plugins' **settings**"; "2. Claude copies the blueprint in as `_kiln/`".
- "Found in the first test vault": `Building the kit (now the blueprint) and checking it in Obsidian 1.14.4 added these decisions:`; "A blueprint CSS snippet"; "listed in the blueprint's `properties.md`"; `**Blueprint templates are notes too.**`

`docs/vision.md`: P5 "Start as a vault kit:" becomes "Start as a vault blueprint:".

`tests/fixtures/README.md`: "in the blueprint's folders"; the link becomes `[Try the sample](../../claude-plugin/blueprint/TRY-THE-SAMPLE.md)`; "against the blueprint's type definitions"; the denylist paragraph says the check fails if any term appears in `` `claude-plugin/` ``, the catalog, the sample, `docs/`, the README, `CLAUDE.md` or this file.

`docs/specs/2026-10-11-vault-access-design.md`, Trials: `(\`kit/TRY-THE-SAMPLE.md\`,` becomes `(\`claude-plugin/blueprint/TRY-THE-SAMPLE.md\`,`. `docs/specs/2026-10-11-vault-setup-design.md`: `("Setting up a vault" (\`kit/README.md\`)` becomes `(\`claude-plugin/blueprint/README.md\`)`. Change nothing else in the #79 notes.

`package.json` `description`: `"kiln: a personal knowledge and work process built on Obsidian. The blueprint is the vault structure; this package only runs its checks."`

`.gitattributes` comment: `...so the blueprint and its checks read the same everywhere.`

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run`
Expected: PASS, 7 files, 86 passed, 1 skipped (87).
Run: `git grep -n -I -E '(^|[^[:alnum:]_/])kit/' -- ':!docs/plans' ':!tests/fixtures/layer1'`
Expected: matches only in `docs/specs/2026-10-11-repo-layout-design.md`, which tells the history, and in the test in `tests/plugin/layout.test.ts` that forbids the path.

- [ ] **Step 5: Validate again**

Run: `claude plugin validate .`
Expected: `✔ Validation passed with warnings`, with the no-version warning only. The README advice is gone, because the README now has the install line.

- [ ] **Step 6: Commit**

```bash
git add tests/plugin/layout.test.ts tests/kit/docs.test.ts README.md CLAUDE.md claude-plugin/blueprint/README.md claude-plugin/blueprint/GETTING-STARTED.md claude-plugin/blueprint/TRY-THE-SAMPLE.md docs/specs/2026-10-11-layer-1-structure-design.md docs/vision.md tests/fixtures/README.md docs/specs/2026-10-11-vault-access-design.md docs/specs/2026-10-11-vault-setup-design.md package.json .gitattributes
git commit -m "docs: the blueprint, the plugin and how to install it (#105)" -m "The living docs follow the kit's rename and move, and the README gives the marketplace install, the same in Bash and pwsh. tests/plugin checks that the living docs' links resolve and name no kit/ path." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Verify the whole change and the install

No new files. This task proves the #105 "Done when" items.

- [ ] **Step 1: Run the checks CI runs**

Run: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`.
Expected: each exits 0, and `npm test` reports 7 files, 86 passed, 1 skipped (87).
Run: `npx vitest run tests/kit`. Expected: 6 files, 76 passed, 1 skipped.

- [ ] **Step 2: If you keep a local denylist, run with it**

If `tests/fixtures/denylist.txt` exists, `npx vitest run` reports 87 passed with nothing skipped. Never commit that file.

- [ ] **Step 3: Install from the working tree into a throwaway config**

Bash:

```bash
export CLAUDE_CONFIG_DIR="$(mktemp -d)"
claude plugin marketplace add ./
claude plugin install kiln@kiln
claude plugin list
unset CLAUDE_CONFIG_DIR
```

pwsh:

```powershell
$env:CLAUDE_CONFIG_DIR = (New-Item -ItemType Directory -Path 'D:\tmp\kiln-claude' -Force).FullName
claude plugin marketplace add ./
claude plugin install kiln@kiln
claude plugin list
Remove-Item Env:CLAUDE_CONFIG_DIR
```

Expected: `✔ Successfully added marketplace: kiln`, then `✔ Successfully installed plugin: kiln@kiln (scope: user)`. The list shows `kiln@kiln` with `Version:` a 12-character commit SHA (the plugin has no version) and `Status: ✔ enabled`. `claude plugin details kiln` shows zero skills, agents and hooks. Set `CLAUDE_CONFIG_DIR` in the same shell before every install command, and delete the throwaway folder afterwards.

- [ ] **Step 4: After pushing the branch, install from GitHub at the branch**

Repeat Step 3, with `claude plugin marketplace add Kieranties/kiln#<branch>` in place of `./`.
Expected: the same results. This proves the "Done when" item: an empty plugin installs from the marketplace, with the same commands in Bash and pwsh.

- [ ] **Step 5: After the merge, check the release**

The merge to `main` runs the release job. Expected: the new GitHub release carries `kiln-blueprint-<version>.zip`, holding `types/`, `templates/`, `views/`, `root/`, `settings/`, `properties.md` and the three guides at its top level.

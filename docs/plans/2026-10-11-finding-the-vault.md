# Finding the Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude finds the kiln vault from any folder: `resolveVault()` implements the spec's resolution order, `~/.kiln/config.json` can be read and written, and the bundled `kiln-vault.mjs` prints the answer as JSON for skills, starting with `/kiln:check`.

**Architecture:** A new `src/vault/` holds everything about finding a vault. The walk up to `_kiln/types/` moves there from `src/check/vault.ts`, which re-exports it, so the check and the resolver share one implementation. `resolveVault(where, explicit?)` is pure apart from reading files: the current folder, the environment, the home folder and the platform come in as a `Where` value, and only `src/cli/kiln-vault.ts` reads them from `process`. Tests build homes, vaults and Obsidian vault lists in temporary folders. The existing esbuild script bundles the new entry point; no new tooling.

**Tech Stack:** Node 24, TypeScript 7 ESM (NodeNext), vitest, oxlint (type-aware), Prettier, esbuild (from #83). No new dependencies.

**Spec:** [docs/specs/2026-10-11-finding-the-vault-design.md](../specs/2026-10-11-finding-the-vault-design.md), for #81. Context: [plugin install](../specs/2026-10-11-plugin-install-design.md), [vault setup](../specs/2026-10-11-vault-setup-design.md), [note check](../specs/2026-10-11-note-check-design.md).

**Revised against the #83 code.** This plan was drafted before #83 was built, then checked against the built branch. What changed:
- `findUp` (and so `findVault`) `resolve()`s its start first, as #83's `findVault` does; `tests/check/vault.test.ts` pins an absolute root for a relative path.
- #83's `findVault` tests the marker with `existsSync`. `findUp` tests that it is a folder, the same test `checkVault` uses for a vault root, so every step agrees on what a vault is. Nothing in #83 depends on the difference.
- Moving `findVault` leaves `existsSync`, `statSync` and `dirname` unused in `src/check/vault.ts`; Task 1 removes those imports. `openVault` doesn't call `findVault`, so nothing else there changes.
- The `/kiln:check` bullet isn't the last in the blueprint README's "Conventions" ("Archive, never delete" is); the new bullet still goes straight after it.
- Task 6 also updates the root `README.md`'s "What's in the repo" table, which names the scripts, `src/` folders and test folders.
- The resolver doesn't follow links or fix letter case the way `runCheck`'s `realpathSync.native` step does: it reports the vault as found or recorded. `kiln-check.mjs` normalises whatever path it is given, so the two still agree; the bundle test compares real paths where the child's current folder is involved.
- Test counts: the suite starts at 143 passed, 1 skipped. This plan adds 49 tests.

**Starts from:** the #83 branch, which builds on #105. In place there:
- `claude-plugin/` is the plugin; the blueprint is `claude-plugin/blueprint/`.
- `src/check/vault.ts` exports `type Vault`, `findVault(path: string): string | undefined` and `openVault(path: string, blueprintDir?: string): Vault`. `findVault` `resolve()`s `path`, starts there if it is a folder (else at its parent), and walks up to the first folder where `join(folder, '_kiln', 'types')` exists; `undefined` at the filesystem root. `openVault` `resolve()`s `path` and returns that absolute `root`. `findVault` is the only user of `existsSync`, `statSync` and `dirname` in that file.
- `src/check/run.ts` imports `findVault` and `openVault` from `./vault.js`. `runCheck(argv: string[], options?: { now?: Date; cwd?: string })` resolves each path against `options.cwd ?? process.cwd()`, puts it through `realpathSync.native` (falling back to the path as given), then calls `findVault`. It parses arguments with `parseArgs` inside a `try`, returning `{ output: USAGE, exitCode: 2 }` on any error. `tests/check/vault.test.ts` imports `findVault` and `openVault` from `../../src/check/vault.js`.
- `src/cli/kiln-check.ts` is three lines: `runCheck(process.argv.slice(2))`, write `output + '\n'`, set `process.exitCode`.
- `scripts/build.mjs` bundles every `src/cli/*.ts` (sorted) into `claude-plugin/scripts/<name>.mjs`, with a header and the licence of each inlined package (none for a bundle that inlines no package). `npm run build` writes and prints `Built <names>`; `npm run build:check` rebuilds in memory and prints `Bundles match src/.`, or fails on a stale, missing or orphaned bundle. CI runs `build:check`.
- `tests/check/fixture.ts` exports `makeVault(options?: { broken?: boolean }): string`: a new `mkdtempSync(join(tmpdir(), 'kiln-vault-'))` holding the sample, with the blueprint's `types/` and `properties.md` in `_kiln/`. Callers remove it. `tests/check/bundle.test.ts` runs a bundle with `spawnSync(process.execPath, [bundle, ...args], { encoding: 'utf8' })`; the sample checks as `Checked 16 notes: no problems.\n`.
- `claude-plugin/skills/check/SKILL.md` has `## 1. Find the vault`, then the marker `<!-- The vault resolver replaces this step when it lands. -->` and one paragraph, then `## 2. Run the check`. `tests/check/skill.test.ts` reads the skill's `body` (through `splitFrontmatter`) and has `PLUGIN` and `existsSync` in scope.
- `claude-plugin/blueprint/README.md` "Conventions" has the `/kiln:check` bullet, then "Archive, never delete". `tests/kit/docs.test.ts` has a `section(document, heading)` helper and the `readme` text in scope.

## Global Constraints

- **Public repo.** Nothing committed may contain employer or client names, private links, or real local paths of any machine. Paths in code, tests and docs are examples such as `D:\notes`, `D:\tmp\kiln-sample` or `D:\src\some-repo`. Test data is the fictional Northwind Arena.
- **The resolution order** (copied from the spec). The first answer wins:
  1. A path given explicitly ("capture this to `D:\notes`").
  2. The vault containing the current folder: walk up to the first folder holding `_kiln/types/`. In Claudian, the session always starts in the vault root, so this always finds it.
  3. `KILN_VAULT`, a vault name or a path. It is an override for one terminal or one Herdr workspace.
  4. The kiln file's `default`.
  5. Obsidian's own vault list (`obsidian.json`), only when exactly one vault in it has `_kiln/`. The format isn't documented, so this is a fallback for discovery.
  6. Ask. Claude lists the candidates, and offers to record the answer through setup, so there is one writer.
- **A vault is a folder holding `_kiln/types/`.** Any candidate without it is rejected with a reason that names the path; a plain Obsidian vault gets its own reason.
- **The kiln file** is `~/.kiln/config.json` (on Windows, in the user's home folder): `{ "default": "<name>", "vaults": { "<name>": "<absolute path>" } }`. Written as 2-space JSON, LF, with a final newline; keys the code doesn't know (such as a later `routes`) survive every write.
- **Obsidian's vault list** is `%APPDATA%\obsidian\obsidian.json` on Windows, `~/Library/Application Support/obsidian/obsidian.json` on macOS and `~/.config/obsidian/obsidian.json` on Linux. kiln only reads it.
- **The resolver never prompts and never writes.** Step 6 is `{ vault: null, candidates, reasons }`; the skill asks. Only `recordVault` writes, and only setup (#72) will call it.
- **Tests never touch the real home folder, `APPDATA` or environment.** Nothing in `src/vault/` reads `process.env`, `process.cwd()`, `process.platform` or `os.homedir()`; `src/cli/kiln-vault.ts` is the only place that does. Tests pass temporary folders; the bundle test passes a built environment.
- **Same in Bash and pwsh.** Scripts are Node. Every command in docs and skills works in both shells; give both forms where they differ (setting an environment variable).
- Node 24, ESM. TypeScript imports use `.js` extensions. `src/` gets oxlint's full `no-unsafe-*` rules: parse JSON into `unknown` and narrow, never cast.
- Code blocks in this plan aren't Prettier-formatted: run `npm run format` before each commit.
- Commits stage explicit paths (never `git add -A` or `git add .`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before pushing: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build:check`.
- Docs: plain British English, short sentences. The #79 design notes and dated plans stay as written.

## Decisions this plan makes

Record these in the PR description; they are exploratory.

1. **The walk-up moves to `src/vault/find.ts`.** `src/check/vault.ts` re-exports `findVault`, so #83's callers and tests don't change. The marker must be a folder, not just exist.
2. **A choice that fails stops resolution.** An explicit path, `KILN_VAULT`, or the kiln file's `default` that isn't a usable vault gives "no vault" with the reason, rather than falling through to a vault the owner didn't pick. Steps 2 and 5 are discovery: when they find nothing, resolution moves on. An unreadable kiln file stops at step 4.
3. **Paths someone typed walk up; recorded paths don't.** An explicit path or a `KILN_VAULT` path may be a note or subfolder inside the vault. A path in the kiln file or in Obsidian's list must be the vault root itself.
4. **`KILN_VAULT` is a name if the kiln file has a vault of that name, else a path,** resolved against the current folder. An empty `KILN_VAULT` counts as unset. A leading `~` is expanded against the home folder in every path kiln reads, because pwsh doesn't expand it in environment variables or JSON.
5. **Step 5 uses the same marker as every other step,** `_kiln/types/`, not just `_kiln/`. On Linux, `XDG_CONFIG_HOME` replaces `~/.config` when set, as it does for Obsidian itself.
6. **`KILN_HOME`** names the folder holding `config.json` (default `~/.kiln`). Tests use it; so can anyone who keeps kiln's file elsewhere.
7. **Candidates** are every usable kiln vault the kiln file records, then every other kiln vault Obsidian lists, with duplicates merged (trailing separators ignored; letter case ignored on Windows and macOS). Broken records appear in `reasons`, not in `candidates`.
8. **`kiln-vault.mjs` output** is pretty-printed JSON on stdout. Exit 0: `{ "vault", "source", "name"? }`. Exit 1: `{ "vault": null, "candidates", "reasons" }`. Exit 2: bad arguments, with usage text. `source` is one of `explicit`, `current-folder`, `KILN_VAULT`, `default`, `obsidian`. `name` is the kiln file's name for the vault, when it has one.
9. **`recordVault`** makes the first vault recorded the default, refuses a folder that isn't a kiln vault, refuses a name that could be read as a path, and never overwrites a kiln file it can't read. It writes through a temporary file and a rename.

## Review Focus

1. **A recorded vault that has moved or been deleted.** The owner gets a reason naming the record and the path, and the other recorded vaults are still offered. Pinned in Task 4.
2. **`KILN_VAULT=` set but empty in Bash** (pwsh removes an empty variable). It counts as unset, not as the current folder. Pinned in Task 4.
3. **`~` in `KILN_VAULT` or the kiln file,** written in pwsh, where nothing expands it. It means the home folder. Pinned in Tasks 1 and 4.
4. **A kiln file edited by hand** in Notepad or with pwsh 5's `Set-Content`: a byte-order mark and CRLF. It reads the same; a later `recordVault` keeps the owner's other keys. Pinned in Task 2.
5. **The same vault listed twice,** once in the kiln file and once in Obsidian's list with a trailing separator or other letter case. It is one candidate, and Obsidian's list doesn't count it as two kiln vaults. Pinned in Tasks 1 and 4.

---

## File structure

| File | Responsibility |
|---|---|
| `src/vault/paths.ts` | `Env`, `Where`, `envValue`, `expandHome`, `pathKey`, `findUp` |
| `src/vault/find.ts` | `findVault` (moved from `src/check/vault.ts`), `checkVault` |
| `src/vault/config.ts` | The kiln file: `kilnConfigPath`, `readKilnConfig`, `recordVault` |
| `src/vault/obsidian.ts` | Obsidian's vault list: `obsidianListPath`, `readObsidianVaults` |
| `src/vault/resolve.ts` | `resolveVault` and its result types |
| `src/vault/run.ts` | `runVault`: arguments in, JSON and exit code out |
| `src/cli/kiln-vault.ts` | Entry point: the only reader of `process` state |
| `claude-plugin/scripts/kiln-vault.mjs` | The committed bundle |
| `src/check/vault.ts` | Re-exports `findVault` |
| `claude-plugin/skills/check/SKILL.md` | Step 1 calls the resolver |
| `claude-plugin/blueprint/README.md` | One "Conventions" bullet |
| `README.md` | "What's in the repo" names `kiln-vault.mjs`, `src/vault/` and `tests/vault/` |
| `tests/vault/fixture.ts` | `sandbox()`: a temporary home, Obsidian folder, vaults and current folder |
| `tests/vault/*.test.ts` | Paths, find, config, Obsidian, resolve, run and bundle tests |

---

### Task 1: Paths and `checkVault`; `findVault` moves to `src/vault`

**Files:**
- Create: `src/vault/paths.ts`, `src/vault/find.ts`, `tests/vault/fixture.ts`
- Modify: `src/check/vault.ts` (remove `findVault`'s body, re-export it)
- Test: `tests/vault/find.test.ts`

**Interfaces:**
- Produces, in `src/vault/paths.ts`:
  - `type Env = Readonly<Record<string, string | undefined>>` (`process.env` fits it).
  - `type Where = { cwd: string; env: Env; home: string; platform: NodeJS.Platform }`.
  - `envValue(env: Env, key: string): string | undefined`: the value trimmed; `undefined` when unset or blank.
  - `expandHome(path: string, home: string): string`: `~` alone, or `~/` or `~\` at the start, becomes `home`; anything else is returned unchanged.
  - `pathKey(path: string, platform: NodeJS.Platform): string`: `resolve(path)` without a trailing separator (unless it is a root), lower-cased on `win32` and `darwin`. Two paths name the same folder when their keys are equal.
  - `findUp(start: string, ...marker: string[]): string | undefined`: `resolve(start)`; from there (if it is a folder, else its parent), the first folder, walking up, in which `join(folder, ...marker)` is a folder (`statSync(…, { throwIfNoEntry: false })?.isDirectory()`); `undefined` at the filesystem root.
- Produces, in `src/vault/find.ts`:
  - `findVault(path: string): string | undefined`: `findUp(path, '_kiln', 'types')`. Behaviour as #83's, except that a `_kiln/types` that is a file no longer counts. `tests/check/vault.test.ts` passes unchanged, including its relative-path test.
  - `type VaultCheck = { ok: true; root: string } | { ok: false; reason: string }`.
  - `checkVault(path: string, options: { walkUp: boolean }): VaultCheck`. `path` must be absolute. The first that applies:

    | Condition | Result |
    |---|---|
    | `path` doesn't exist | `` `${path} doesn't exist` `` |
    | `walkUp` false and `path` is a file | `` `${path} is a file, not a vault folder` `` |
    | The vault is found (`walkUp`: `findVault(path)`; else `path/_kiln/types/` is a folder) | `{ ok: true, root }`, `root` without a trailing separator (`resolve`) |
    | An Obsidian vault without kiln (`walkUp`: `findUp(path, '.obsidian')`; else `path/.obsidian/` is a folder), at `obs` | `` `${obs} is an Obsidian vault without kiln: it has no _kiln/types/ folder. Set it up with /kiln:setup first.` `` |
    | `walkUp` true | `` `${path} isn't in a kiln vault: no _kiln/types/ folder here or above` `` |
    | `walkUp` false | `` `${path} isn't a kiln vault: it has no _kiln/types/ folder` `` |
- Produces, in `tests/vault/fixture.ts`:
  - `type Sandbox = { root: string; home: string; appData: string; cwd: string; configFile: string; obsidianFile: string; env: Env; where(overrides?: Partial<Where>): Where; vault(name: string, kind?: 'kiln' | 'obsidian'): string; record(config: unknown): void; obsidian(paths: string[]): void; cleanup(): void }`.
  - `sandbox(): Sandbox`. `root` is a new `mkdtempSync(join(tmpdir(), 'kiln-vault-'))`. `home` is `root/home`, `appData` is `root/appdata`, `cwd` is `root/elsewhere` (created, in no vault). `configFile` is `home/.kiln/config.json`; `obsidianFile` is `appData/obsidian/obsidian.json`. `env` is `{ APPDATA: appData }`. `where()` returns `{ cwd, env, home, platform: 'win32', ...overrides }` (tests run the Windows layout on every OS; only `pathKey` and the Obsidian location depend on `platform`). `vault(name)` creates `home/vaults/<name>/` with `.obsidian/`, `Work/` and, for `'kiln'` (the default), `_kiln/types/`, and returns its path. `record(config)` writes `configFile` as JSON (creating `.kiln/`). `obsidian(paths)` writes `obsidianFile` as `{ "vaults": { "<16 hex chars>": { "path": "<p>", "ts": 1760000000000 } } }`, one entry per path. `cleanup()` removes `root`.

- [ ] **Step 1: Write the failing tests** in `tests/vault/find.test.ts`

```ts
import { join, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkVault, findVault } from '../../src/vault/find.js';
import { envValue, expandHome, pathKey } from '../../src/vault/paths.js';
import { findVault as checkFindVault } from '../../src/check/vault.js';
import { sandbox, type Sandbox } from './fixture.js';

let s: Sandbox;
beforeEach(() => {
  s = sandbox();
});
afterEach(() => s.cleanup());

describe('paths', () => {
  it('treats a blank variable as unset', () => {
    expect(envValue({ KILN_VAULT: '  ' }, 'KILN_VAULT')).toBeUndefined();
    expect(envValue({ KILN_VAULT: ' work ' }, 'KILN_VAULT')).toBe('work');
  });
  it('expands a leading ~ in either separator', () => {
    expect(expandHome('~', s.home)).toBe(s.home);
    expect(expandHome('~/vaults/work', s.home)).toBe(join(s.home, 'vaults/work'));
    expect(expandHome('~\\vaults\\work', s.home)).toBe(join(s.home, 'vaults\\work'));
    expect(expandHome('D:\\notes~', s.home)).toBe('D:\\notes~');
  });
  it('ignores a trailing separator, and letter case on Windows and macOS', () => {
    const v = join(s.home, 'Vault');
    expect(pathKey(v + sep, 'linux')).toBe(pathKey(v, 'linux'));
    expect(pathKey(v.toUpperCase(), 'win32')).toBe(pathKey(v, 'win32'));
    expect(pathKey(v.toUpperCase(), 'linux')).not.toBe(pathKey(v, 'linux'));
  });
});

describe('findVault', () => {
  it('is shared with the note check', () => {
    expect(checkFindVault).toBe(findVault);
  });
  it('walks up from a subfolder', () => {
    const work = s.vault('work');
    expect(findVault(join(work, 'Work'))).toBe(work);
  });
});

describe('checkVault', () => {
  it('accepts a kiln vault, or with walkUp a folder inside one', () => {
    const work = s.vault('work');
    expect(checkVault(work, { walkUp: false })).toEqual({ ok: true, root: work });
    expect(checkVault(join(work, 'Work'), { walkUp: true })).toEqual({ ok: true, root: work });
  });
  it('rejects a subfolder when the path must be the vault root', () => {
    const sub = join(s.vault('work'), 'Work');
    expect(checkVault(sub, { walkUp: false })).toEqual({
      ok: false,
      reason: `${sub} isn't a kiln vault: it has no _kiln/types/ folder`,
    });
  });
  it('rejects a plain Obsidian vault, naming its root', () => {
    const plain = s.vault('plain', 'obsidian');
    const reason = `${plain} is an Obsidian vault without kiln: it has no _kiln/types/ folder. Set it up with /kiln:setup first.`;
    expect(checkVault(plain, { walkUp: false })).toEqual({ ok: false, reason });
    expect(checkVault(join(plain, 'Work'), { walkUp: true })).toEqual({ ok: false, reason });
  });
  it('rejects a missing path and a folder in no vault', () => {
    const gone = join(s.root, 'gone');
    expect(checkVault(gone, { walkUp: true })).toEqual({ ok: false, reason: `${gone} doesn't exist` });
    expect(checkVault(s.cwd, { walkUp: true })).toEqual({
      ok: false,
      reason: `${s.cwd} isn't in a kiln vault: no _kiln/types/ folder here or above`,
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/vault/find.test.ts`
Expected: FAIL, cannot resolve `./fixture.js` / `../../src/vault/find.js`.

- [ ] **Step 3: Implement `src/vault/paths.ts`, `src/vault/find.ts` and `tests/vault/fixture.ts`; move `findVault`**

Move `findVault`'s walk into `findUp` in `paths.ts`; `find.ts` defines `findVault` with it. In `src/check/vault.ts`:
- delete the local `findVault` and its doc comment;
- add `export { findVault } from '../vault/find.js';` after the imports (`openVault` doesn't call it, so no local import);
- trim the imports to what `openVault` still uses: `import { readdirSync } from 'node:fs';` and `import { basename, join, relative, resolve, sep } from 'node:path';` (oxlint's `no-unused-vars` fails on the others).

`src/check/run.ts` (which imports `findVault` from `./vault.js`) and `tests/check/vault.test.ts` stay unchanged.

- [ ] **Step 4: Run the vault and check tests**

Run: `npx vitest run tests/vault tests/check && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/vault/paths.ts src/vault/find.ts src/check/vault.ts tests/vault/fixture.ts tests/vault/find.test.ts
git commit -m "refactor(vault): move findVault to src/vault and add checkVault" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The kiln file, `~/.kiln/config.json`

**Files:**
- Create: `src/vault/config.ts`
- Test: `tests/vault/config.test.ts`

**Interfaces:**
- Consumes: `Env`, `envValue`, `expandHome` (Task 1); `checkVault` (Task 1).
- Produces, in `src/vault/config.ts`:
  - `type KilnConfig = { default?: string; vaults: Record<string, string>; [key: string]: unknown }`.
  - `kilnConfigPath(where: { env: Env; home: string }): string`: `join(expandHome(envValue(env, 'KILN_HOME'), home), 'config.json')` when `KILN_HOME` is set, else `join(home, '.kiln', 'config.json')`.
  - `readKilnConfig(file: string): KilnConfig | undefined`: `undefined` when the file doesn't exist. Strips a leading `\uFEFF`. A missing `vaults` is `{}`. Throws `Error` with one of these messages: `not valid JSON: <the parser's message>`, `not a JSON object`, `vaults must be a map of names to folders`, `default must be a vault name`.
  - `recordVault(file: string, name: string, path: string, options?: { makeDefault?: boolean; home?: string }): KilnConfig`: records `name` → the absolute path of the vault root, and returns what it wrote.
    - `name` must match `/^[A-Za-z0-9][A-Za-z0-9._-]*$/`, else throws `` `vault names use letters, digits, ".", "-" and "_": "${name}"` ``.
    - `path` goes through `expandHome` (with `options.home`, if given) and `resolve`, then `checkVault(..., { walkUp: false })`; a failure throws its `reason`.
    - An existing file that `readKilnConfig` can't read throws `` `${file} can't be read, so it was left as it is: ${message}` `` and the file is untouched.
    - `default` becomes `name` when `makeDefault` is true or there is no default yet.
    - Written key order: `default`, `vaults`, then every other key in its existing order. Text: `JSON.stringify(config, null, 2) + '\n'`, LF. Creates the folder; writes `${file}.tmp`, then `renameSync` over `file`.

- [ ] **Step 1: Write the failing tests** in `tests/vault/config.test.ts`

```ts
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { kilnConfigPath, readKilnConfig, recordVault } from '../../src/vault/config.js';
import { sandbox, type Sandbox } from './fixture.js';

let s: Sandbox;
beforeEach(() => {
  s = sandbox();
});
afterEach(() => s.cleanup());

const text = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

describe('kilnConfigPath', () => {
  it('is ~/.kiln/config.json, or config.json in KILN_HOME', () => {
    expect(kilnConfigPath({ env: {}, home: s.home })).toBe(join(s.home, '.kiln', 'config.json'));
    expect(kilnConfigPath({ env: { KILN_HOME: join(s.root, 'k') }, home: s.home })).toBe(join(s.root, 'k', 'config.json'));
  });
});

describe('readKilnConfig', () => {
  it('is undefined when there is no file', () => {
    expect(readKilnConfig(s.configFile)).toBeUndefined();
  });
  it('reads a file edited by hand, with a byte-order mark and CRLF', () => {
    mkdirSync(dirname(s.configFile), { recursive: true });
    writeFileSync(s.configFile, '\uFEFF{\r\n  "default": "work",\r\n  "vaults": { "work": "D:\\\\notes" }\r\n}\r\n');
    expect(readKilnConfig(s.configFile)).toEqual({ default: 'work', vaults: { work: 'D:\\notes' } });
  });
  it('names what is wrong with a broken file', () => {
    mkdirSync(dirname(s.configFile), { recursive: true });
    writeFileSync(s.configFile, '{ "vaults": ');
    expect(() => readKilnConfig(s.configFile)).toThrow(/^not valid JSON: /);
    s.record({ vaults: ['D:\\notes'] });
    expect(() => readKilnConfig(s.configFile)).toThrow('vaults must be a map of names to folders');
    s.record({ default: 3, vaults: {} });
    expect(() => readKilnConfig(s.configFile)).toThrow('default must be a vault name');
  });
});

describe('recordVault', () => {
  it('creates the file, and the first vault becomes the default', () => {
    const work = s.vault('work');
    recordVault(s.configFile, 'work', work);
    expect(readFileSync(s.configFile, 'utf8')).toBe(text({ default: 'work', vaults: { work } }));
    expect(readdirSync(dirname(s.configFile))).toEqual(['config.json']);
  });
  it('adds a vault without changing the default, unless asked', () => {
    const work = s.vault('work');
    const trial = s.vault('trial');
    recordVault(s.configFile, 'work', work);
    expect(recordVault(s.configFile, 'trial', trial)).toEqual({ default: 'work', vaults: { work, trial } });
    expect(recordVault(s.configFile, 'trial', trial, { makeDefault: true }).default).toBe('trial');
  });
  it('keeps keys it does not know, after default and vaults', () => {
    const work = s.vault('work');
    const routes = [{ path: 'D:\\src\\personal\\**', vault: 'work' }];
    s.record({ routes, vaults: {} });
    recordVault(s.configFile, 'work', work);
    expect(readFileSync(s.configFile, 'utf8')).toBe(text({ default: 'work', vaults: { work }, routes }));
  });
  it('records the vault root from a ~ path', () => {
    const work = s.vault('work');
    recordVault(s.configFile, 'work', '~/vaults/work', { home: s.home });
    expect(readKilnConfig(s.configFile)?.vaults.work).toBe(work);
  });
  it('refuses a folder that is not a kiln vault, and a name that looks like a path', () => {
    const plain = s.vault('plain', 'obsidian');
    expect(() => recordVault(s.configFile, 'plain', plain)).toThrow(/is an Obsidian vault without kiln/);
    expect(() => recordVault(s.configFile, 'D:\\notes', s.vault('work'))).toThrow(/^vault names use letters/);
    expect(existsSync(s.configFile)).toBe(false);
  });
  it('never overwrites a file it cannot read', () => {
    mkdirSync(dirname(s.configFile), { recursive: true });
    writeFileSync(s.configFile, '{ "vaults": ');
    expect(() => recordVault(s.configFile, 'work', s.vault('work'))).toThrow(/can't be read, so it was left as it is/);
    expect(readFileSync(s.configFile, 'utf8')).toBe('{ "vaults": ');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/vault/config.test.ts`
Expected: FAIL, cannot resolve `../../src/vault/config.js`.

- [ ] **Step 3: Implement `src/vault/config.ts`**

`const data: unknown = JSON.parse(text)`, then narrow: an object that isn't an array; `vaults` an object whose values are all strings; `default` a string if present.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/vault && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/vault/config.ts tests/vault/config.test.ts
git commit -m "feat(vault): read and record vaults in ~/.kiln/config.json" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Obsidian's vault list

**Files:**
- Create: `src/vault/obsidian.ts`
- Test: `tests/vault/obsidian.test.ts`

**Interfaces:**
- Consumes: `Where`, `envValue` (Task 1).
- Produces, in `src/vault/obsidian.ts`:
  - `obsidianListPath(where: Pick<Where, 'env' | 'home' | 'platform'>): string`:
    - `win32`: `join(APPDATA, 'obsidian', 'obsidian.json')`, or `join(home, 'AppData', 'Roaming', 'obsidian', 'obsidian.json')` without `APPDATA`;
    - `darwin`: `join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json')`;
    - anything else: `join(XDG_CONFIG_HOME, 'obsidian', 'obsidian.json')`, or `join(home, '.config', 'obsidian', 'obsidian.json')` without it.
  - `readObsidianVaults(file: string): string[] | undefined`: `undefined` when the file doesn't exist; else the `path` of every entry of the top-level `vaults` object that has a string `path`, in file order. Strips a BOM. Throws `not valid JSON: <message>` or `no vaults list` (top level isn't an object with a `vaults` object). Read-only.

- [ ] **Step 1: Write the failing tests** in `tests/vault/obsidian.test.ts`

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { obsidianListPath, readObsidianVaults } from '../../src/vault/obsidian.js';
import { sandbox, type Sandbox } from './fixture.js';

let s: Sandbox;
beforeEach(() => {
  s = sandbox();
});
afterEach(() => s.cleanup());

describe('obsidianListPath', () => {
  it("is Obsidian's own config folder on each platform", () => {
    const home = s.home;
    expect(obsidianListPath({ platform: 'win32', env: { APPDATA: s.appData }, home })).toBe(s.obsidianFile);
    expect(obsidianListPath({ platform: 'win32', env: {}, home })).toBe(join(home, 'AppData', 'Roaming', 'obsidian', 'obsidian.json'));
    expect(obsidianListPath({ platform: 'darwin', env: {}, home })).toBe(join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json'));
    expect(obsidianListPath({ platform: 'linux', env: {}, home })).toBe(join(home, '.config', 'obsidian', 'obsidian.json'));
    expect(obsidianListPath({ platform: 'linux', env: { XDG_CONFIG_HOME: join(s.root, 'xdg') }, home })).toBe(join(s.root, 'xdg', 'obsidian', 'obsidian.json'));
  });
});

describe('readObsidianVaults', () => {
  it('is undefined when Obsidian has no list', () => {
    expect(readObsidianVaults(s.obsidianFile)).toBeUndefined();
  });
  it('reads every vault path, in order, skipping entries without one', () => {
    mkdirSync(dirname(s.obsidianFile), { recursive: true });
    writeFileSync(
      s.obsidianFile,
      JSON.stringify({ vaults: { a1: { path: 'D:\\notes', ts: 1, open: true }, b2: { ts: 2 }, c3: { path: 'D:\\tmp\\kiln-sample' } } }),
    );
    expect(readObsidianVaults(s.obsidianFile)).toEqual(['D:\\notes', 'D:\\tmp\\kiln-sample']);
  });
  it('names a broken list', () => {
    mkdirSync(dirname(s.obsidianFile), { recursive: true });
    writeFileSync(s.obsidianFile, '{ "vaults": ');
    expect(() => readObsidianVaults(s.obsidianFile)).toThrow(/^not valid JSON: /);
    writeFileSync(s.obsidianFile, '{ "frame": "native" }');
    expect(() => readObsidianVaults(s.obsidianFile)).toThrow('no vaults list');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/vault/obsidian.test.ts`
Expected: FAIL, cannot resolve `../../src/vault/obsidian.js`.

- [ ] **Step 3: Implement `src/vault/obsidian.ts`**

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/vault && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/vault/obsidian.ts tests/vault/obsidian.test.ts
git commit -m "feat(vault): read Obsidian's vault list on Windows, macOS and Linux" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `resolveVault`, the resolution order

**Files:**
- Create: `src/vault/resolve.ts`
- Test: `tests/vault/resolve.test.ts`

**Interfaces:**
- Consumes: `Where`, `envValue`, `expandHome`, `pathKey` (Task 1); `findVault`, `checkVault` (Task 1); `kilnConfigPath`, `readKilnConfig` (Task 2); `obsidianListPath`, `readObsidianVaults` (Task 3).
- Produces, in `src/vault/resolve.ts`:
  - `type Source = 'explicit' | 'current-folder' | 'KILN_VAULT' | 'default' | 'obsidian'`.
  - `type Candidate = { path: string; name?: string; from: 'kiln' | 'obsidian' }`.
  - `type Found = { vault: string; source: Source; name?: string }`.
  - `type NotFound = { vault: null; candidates: Candidate[]; reasons: string[] }`.
  - `type Resolution = Found | NotFound`.
  - `resolveVault(where: Where, explicit?: string): Resolution`. Reads files only; never writes, never reads `process`.

**The steps.** `F` is `kilnConfigPath(where)`; `O` is `obsidianListPath(where)`. Every path someone typed or recorded goes through `expandHome(…, where.home)`, then `resolve(where.cwd, …)`. A found vault's `name` is the kiln file's name for a folder with the same `pathKey`, when there is one (omit the key otherwise, and when the kiln file is missing or can't be read). The kiln file is read at most once, when first needed: for a found vault's name, or at step 3 or 4.

| Step | When | Result |
|---|---|---|
| 1 | `explicit` given | `checkVault(p, { walkUp: true })`: found, `source: 'explicit'`; else **stop** with its reason |
| 2 | always | `findVault(where.cwd)`: found, `source: 'current-folder'`; else reason `` `the current folder (${cwd}) isn't in a kiln vault` `` and go on |
| 3 | `envValue(env, 'KILN_VAULT')` is `v` | If the kiln file has a vault named `v`: `checkVault(recorded, { walkUp: false })`. Else `v` is a path: `checkVault(p, { walkUp: true })`. Found: `source: 'KILN_VAULT'`. Else **stop** with `` `KILN_VAULT is "${v}": ${reason}` ``, where a missing path with no `/` or `\` in `v` has the reason `` `no vault of that name in ${F}, and no folder of that name` ``, or `` `${F} can't be read: ${message}` `` when the kiln file can't be read |
| 3 | unset | reason `KILN_VAULT isn't set`, go on |
| 4 | the kiln file can't be read | **stop** with `` `${F} can't be read: ${message}` `` |
| 4 | no kiln file | reason `` `no kiln file at ${F}` ``, go on |
| 4 | no `default` | reason `` `${F} has no default` ``, go on |
| 4 | `default` isn't a key of `vaults` | **stop** with `` `${F}'s default is "${d}", which isn't one of its vaults` `` |
| 4 | otherwise | `checkVault(recorded, { walkUp: false })`: found, `source: 'default'`; else **stop** with `` `${F}'s default "${d}": ${reason}` `` |
| 5 | no list | reason `` `no Obsidian vault list at ${O}` ``, go on |
| 5 | list can't be read | reason `` `Obsidian's vault list can't be read: ${message}` ``, go on |
| 5 | its entries that pass `checkVault(…, { walkUp: false })`, merged by `pathKey`, number exactly 1 | found, `source: 'obsidian'` |
| 5 | 0 | reason `Obsidian lists no kiln vault`, go on |
| 5 | n > 1 | reason `` `Obsidian lists ${n} kiln vaults, so it can't choose` ``, go on |
| 6 | | `{ vault: null, candidates, reasons }` |

**Not found** (step 6, or any **stop**): `reasons` is every reason so far, in order, then `` `${F}'s vault "${name}": ${reason}` `` for each recorded vault that fails `checkVault(…, { walkUp: false })` and wasn't already named by a stop. `candidates` is each recorded vault that passes (`from: 'kiln'`, with `name`), in file order, then each Obsidian-listed kiln vault whose `pathKey` isn't already there (`from: 'obsidian'`). An unreadable kiln file or Obsidian list adds no candidates.

- [ ] **Step 1: Write the failing tests** in `tests/vault/resolve.test.ts`

```ts
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveVault } from '../../src/vault/resolve.js';
import { sandbox, type Sandbox } from './fixture.js';

let s: Sandbox;
let work: string;
let trial: string;
beforeEach(() => {
  s = sandbox();
  work = s.vault('work');
  trial = s.vault('trial');
});
afterEach(() => s.cleanup());

const withEnv = (env: Record<string, string>) => s.where({ env: { ...s.env, ...env } });

describe('resolveVault: each step, in order', () => {
  it('1. an explicit path beats the current folder and KILN_VAULT, and may be inside the vault', () => {
    s.record({ default: 'work', vaults: { work, trial } });
    const where = s.where({ cwd: work, env: { ...s.env, KILN_VAULT: 'work' } });
    expect(resolveVault(where, join(trial, 'Work'))).toEqual({ vault: trial, source: 'explicit', name: 'trial' });
  });

  it('1. resolves a relative explicit path against the current folder', () => {
    expect(resolveVault(s.where({ cwd: join(s.home, 'vaults') }), 'trial')).toEqual({ vault: trial, source: 'explicit' });
  });

  it('1. a plain Obsidian vault given explicitly stops, and does not fall back to the default', () => {
    const plain = s.vault('plain', 'obsidian');
    s.record({ default: 'work', vaults: { work } });
    const r = resolveVault(s.where(), plain);
    expect(r).toEqual({
      vault: null,
      candidates: [{ path: work, name: 'work', from: 'kiln' }],
      reasons: [`${plain} is an Obsidian vault without kiln: it has no _kiln/types/ folder. Set it up with /kiln:setup first.`],
    });
  });

  it('2. the vault holding the current folder, from a subfolder', () => {
    expect(resolveVault(s.where({ cwd: join(work, 'Work') }))).toEqual({ vault: work, source: 'current-folder' });
  });

  it('2. Claudian: the current folder beats a global KILN_VAULT and the default, even a broken one', () => {
    s.record({ default: 'trial', vaults: { work, trial } });
    for (const KILN_VAULT of ['trial', trial, 'nope']) {
      const where = s.where({ cwd: work, env: { ...s.env, KILN_VAULT } });
      expect(resolveVault(where), KILN_VAULT).toEqual({ vault: work, source: 'current-folder', name: 'work' });
    }
  });

  it('3. KILN_VAULT by name, by path and by ~ path beats the default', () => {
    s.record({ default: 'work', vaults: { work, trial } });
    expect(resolveVault(withEnv({ KILN_VAULT: 'trial' }))).toEqual({ vault: trial, source: 'KILN_VAULT', name: 'trial' });
    expect(resolveVault(withEnv({ KILN_VAULT: join(trial, 'Work') }))).toEqual({ vault: trial, source: 'KILN_VAULT', name: 'trial' });
    expect(resolveVault(withEnv({ KILN_VAULT: '~/vaults/trial' }))).toEqual({ vault: trial, source: 'KILN_VAULT', name: 'trial' });
  });

  it('3. an empty KILN_VAULT counts as unset', () => {
    s.record({ default: 'work', vaults: { work } });
    expect(resolveVault(withEnv({ KILN_VAULT: '' }))).toEqual({ vault: work, source: 'default', name: 'work' });
  });

  it('3. an unknown name or a plain vault in KILN_VAULT stops, and does not fall back to the default', () => {
    s.record({ default: 'work', vaults: { work } });
    const unknown = resolveVault(withEnv({ KILN_VAULT: 'nope' }));
    expect(unknown.vault).toBeNull();
    expect(unknown).toMatchObject({
      reasons: [
        `the current folder (${s.cwd}) isn't in a kiln vault`,
        `KILN_VAULT is "nope": no vault of that name in ${s.configFile}, and no folder of that name`,
      ],
    });
    const plain = s.vault('plain', 'obsidian');
    expect(resolveVault(withEnv({ KILN_VAULT: plain }))).toMatchObject({
      vault: null,
      reasons: [expect.any(String), expect.stringMatching(/^KILN_VAULT is ".*": .* is an Obsidian vault without kiln/)],
    });
  });

  it("4. the kiln file's default, which beats Obsidian's list", () => {
    s.record({ default: 'work', vaults: { work, trial } });
    s.obsidian([trial]);
    expect(resolveVault(s.where())).toEqual({ vault: work, source: 'default', name: 'work' });
  });

  it('4. a default that moved or was deleted stops, and offers the other recorded vaults', () => {
    s.record({ default: 'work', vaults: { work, trial } });
    rmSync(work, { recursive: true, force: true });
    expect(resolveVault(s.where())).toEqual({
      vault: null,
      candidates: [{ path: trial, name: 'trial', from: 'kiln' }],
      reasons: [
        `the current folder (${s.cwd}) isn't in a kiln vault`,
        "KILN_VAULT isn't set",
        `${s.configFile}'s default "work": ${work} doesn't exist`,
      ],
    });
  });

  it("4. a default that names no vault, and a kiln file that can't be read, stop", () => {
    s.record({ default: 'gone', vaults: { work } });
    expect(resolveVault(s.where())).toMatchObject({
      vault: null,
      reasons: expect.arrayContaining([`${s.configFile}'s default is "gone", which isn't one of its vaults`]),
    });
    s.record('x');
    s.obsidian([work]);
    const broken = resolveVault(s.where());
    expect(broken).toMatchObject({ vault: null, candidates: [{ path: work, from: 'obsidian' }] });
    expect(broken.vault === null && broken.reasons.at(-1)).toMatch(/can't be read: /);
  });

  it("5. Obsidian's list, when exactly one vault in it has kiln", () => {
    s.obsidian([s.vault('plain', 'obsidian'), trial, join(s.root, 'gone')]);
    expect(resolveVault(s.where())).toEqual({ vault: trial, source: 'obsidian' });
  });

  it('6. two kiln vaults in Obsidian and no record: no vault, both offered', () => {
    s.obsidian([work, trial]);
    expect(resolveVault(s.where())).toEqual({
      vault: null,
      candidates: [
        { path: work, from: 'obsidian' },
        { path: trial, from: 'obsidian' },
      ],
      reasons: [
        `the current folder (${s.cwd}) isn't in a kiln vault`,
        "KILN_VAULT isn't set",
        `no kiln file at ${s.configFile}`,
        "Obsidian lists 2 kiln vaults, so it can't choose",
      ],
    });
  });

  it('6. nothing at all: no candidates, and a reason for each step', () => {
    expect(resolveVault(s.where())).toEqual({
      vault: null,
      candidates: [],
      reasons: [
        `the current folder (${s.cwd}) isn't in a kiln vault`,
        "KILN_VAULT isn't set",
        `no kiln file at ${s.configFile}`,
        `no Obsidian vault list at ${s.obsidianFile}`,
      ],
    });
  });

  it('6. the same vault in the kiln file and in Obsidian is one candidate', () => {
    s.record({ vaults: { work, trial } });
    s.obsidian([work + sep, trial, trial.toUpperCase(), s.vault('third')]);
    const r = resolveVault(s.where());
    expect(r).toMatchObject({
      vault: null,
      candidates: [
        { path: work, name: 'work', from: 'kiln' },
        { path: trial, name: 'trial', from: 'kiln' },
        { path: join(s.home, 'vaults', 'third'), from: 'obsidian' },
      ],
    });
    expect(r.vault === null && r.reasons).toContain("Obsidian lists 3 kiln vaults, so it can't choose");
  });
});

describe('src/vault', () => {
  it('never reads the real environment, folder or home', () => {
    const dir = fileURLToPath(new URL('../../src/vault/', import.meta.url));
    for (const file of readdirSync(dir)) {
      expect(readFileSync(join(dir, file), 'utf8'), file).not.toMatch(/process\.|homedir\(|tmpdir\(/);
    }
  });
});
```

(`trial.toUpperCase()` names the same folder only on a case-insensitive file system. There `pathKey` merges it with `trial`; on Linux it doesn't exist and is dropped. Either way Obsidian's list holds three kiln vaults: `work`, `trial` and `third`.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/vault/resolve.test.ts`
Expected: FAIL, cannot resolve `../../src/vault/resolve.js`.

- [ ] **Step 3: Implement `resolveVault`** in `src/vault/resolve.ts`, step by step from the table. Keep each step a small function returning `Found`, a stop reason, or a go-on reason, so the order reads top to bottom in `resolveVault`. Compute candidates only when returning `NotFound`.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run tests/vault && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/vault/resolve.ts tests/vault/resolve.test.ts
git commit -m "feat(vault): resolve the vault in the spec's order" -m "Explicit path, then the current folder, KILN_VAULT, the kiln file's default and Obsidian's list. A choice that fails stops with its reason; no vault lists the candidates." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `kiln-vault.mjs`

**Files:**
- Create: `src/vault/run.ts`, `src/cli/kiln-vault.ts`, `claude-plugin/scripts/kiln-vault.mjs` (generated)
- Test: `tests/vault/run.test.ts`, `tests/vault/bundle.test.ts`

**Interfaces:**
- Consumes: `resolveVault`, `Resolution` (Task 4); `Where` (Task 1); `makeVault` from `tests/check/fixture.ts` (#83); `scripts/build.mjs` (#83).
- Produces:
  - `runVault(argv: string[], where: Where): { output: string; exitCode: 0 | 1 | 2 }` in `src/vault/run.ts`. Arguments with `parseArgs` from `node:util`, as `runCheck` in `src/check/run.ts` does (inside a `try`; any error gives the usage): `args: argv`, `allowPositionals: true`, `options: { help: { type: 'boolean', short: 'h' } }`. At most one positional, the explicit path; it must not be blank. `--help`, an unknown option, two positionals or a blank one give exit 2 and the usage text below. Otherwise `output` is `JSON.stringify(resolveVault(where, positionals[0]), null, 2)`, exit 0 when `vault` is set and 1 when it is `null`. No `process` here: `where` carries everything.
  - `src/cli/kiln-vault.ts`, in the shape of `src/cli/kiln-check.ts`:

    ```ts
    import { homedir } from 'node:os';
    import { runVault } from '../vault/run.js';

    const where = { cwd: process.cwd(), env: process.env, home: homedir(), platform: process.platform };
    const { output, exitCode } = runVault(process.argv.slice(2), where);
    process.stdout.write(output + '\n');
    process.exitCode = exitCode;
    ```
  - Usage text (exact):

    ```
    Usage: node kiln-vault.mjs [<path>]
      <path>  a vault folder, or a folder or note inside one
    Finds the kiln vault: <path>; else the vault holding the current folder; else KILN_VAULT
    (a vault name or a path); else the default in ~/.kiln/config.json; else the only kiln
    vault in Obsidian's vault list.
    Prints JSON. Exit code: 0 found, 1 no vault (with candidates and reasons), 2 bad arguments.
    ```

- [ ] **Step 1: Write the failing tests**

`tests/vault/run.test.ts`:

```ts
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runVault } from '../../src/vault/run.js';
import { sandbox, type Sandbox } from './fixture.js';

let s: Sandbox;
beforeEach(() => {
  s = sandbox();
});
afterEach(() => s.cleanup());

describe('runVault', () => {
  it('prints the vault as JSON and exits 0', () => {
    const work = s.vault('work');
    const { output, exitCode } = runVault([join(work, 'Work')], s.where());
    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toEqual({ vault: work, source: 'explicit' });
  });
  it('prints the candidates and reasons and exits 1 when there is no vault', () => {
    const { output, exitCode } = runVault([], s.where());
    expect(exitCode).toBe(1);
    expect(JSON.parse(output)).toMatchObject({ vault: null, candidates: [], reasons: expect.any(Array) });
  });
  it('exits 2 with usage for bad arguments', () => {
    for (const argv of [['--help'], ['--frobnicate'], ['a', 'b'], ['  ']]) {
      expect(runVault(argv, s.where()), argv.join(' ')).toMatchObject({ exitCode: 2, output: expect.stringMatching(/^Usage: /) });
    }
  });
});
```

`tests/vault/bundle.test.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeVault } from '../check/fixture.js';
import { sandbox, type Sandbox } from './fixture.js';

const SCRIPTS = fileURLToPath(new URL('../../claude-plugin/scripts/', import.meta.url));
const OVERRIDDEN = ['KILN_VAULT', 'KILN_HOME', 'HOME', 'USERPROFILE', 'APPDATA', 'XDG_CONFIG_HOME'];

let s: Sandbox;
let sample: string;
beforeEach(() => {
  s = sandbox();
  sample = makeVault();
});
afterEach(() => {
  s.cleanup();
  rmSync(sample, { recursive: true, force: true });
});

/** Runs a bundle with plain node, a temporary home and no KILN_VAULT, whatever the real environment holds. */
function run(script: string, args: string[], cwd: string, extra: Record<string, string> = {}) {
  // Windows variable names ignore case, so drop the real ones by upper-cased name before adding ours.
  const env: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !OVERRIDDEN.includes(k.toUpperCase())),
  );
  Object.assign(env, { HOME: s.home, USERPROFILE: s.home, APPDATA: s.appData, XDG_CONFIG_HOME: join(s.home, '.config') }, extra);
  return spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { cwd, env, encoding: 'utf8' });
}

describe('kiln-vault.mjs', () => {
  it('finds the vault from a folder inside it, and kiln-check checks it', () => {
    const r = run('kiln-vault.mjs', [], join(sample, 'Work'));
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    const found = JSON.parse(r.stdout) as { vault: string; source: string };
    // The child's current folder may be the long or real form of the temporary path (8.3 names, /private/var).
    expect(realpathSync.native(found.vault)).toBe(realpathSync.native(sample));
    expect(found.source).toBe('current-folder');
    expect(run('kiln-check.mjs', [found.vault], s.cwd).stdout).toBe('Checked 16 notes: no problems.\n');
  });

  it('finds the default from another folder, and KILN_VAULT overrides it', () => {
    const work = s.vault('work');
    s.record({ default: 'sample', vaults: { sample, work } });
    expect(JSON.parse(run('kiln-vault.mjs', [], s.cwd).stdout)).toEqual({ vault: sample, source: 'default', name: 'sample' });
    expect(JSON.parse(run('kiln-vault.mjs', [], s.cwd, { KILN_VAULT: 'work' }).stdout)).toEqual({
      vault: work,
      source: 'KILN_VAULT',
      name: 'work',
    });
  });

  it('honours KILN_HOME for the kiln file', () => {
    const elsewhere = join(s.root, 'kiln-home');
    s.record({ default: 'sample', vaults: { sample } });
    const r = run('kiln-vault.mjs', [], s.cwd, { KILN_HOME: elsewhere });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(`no kiln file at ${JSON.stringify(join(elsewhere, 'config.json')).slice(1, -1)}`);
  });

  it('exits 1 with no vault, and writes nothing', () => {
    const r = run('kiln-vault.mjs', [], s.cwd);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({ vault: null, candidates: [] });
    expect(existsSync(join(s.home, '.kiln'))).toBe(false);
  });

  it('exits 2 on bad arguments', () => {
    expect(run('kiln-vault.mjs', ['a', 'b'], s.cwd).status).toBe(2);
  });
});
```

(`s.record` writes `home/.kiln/config.json`, which the bundle finds through `HOME`/`USERPROFILE`; `os.homedir()` reads `USERPROFILE` on Windows and `HOME` elsewhere. The `JSON.stringify(...).slice(1, -1)` turns a Windows path into its escaped form in the JSON output.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/vault/run.test.ts tests/vault/bundle.test.ts`
Expected: FAIL: `../../src/vault/run.js` doesn't resolve, and the bundle doesn't exist.

- [ ] **Step 3: Implement `src/vault/run.ts` and `src/cli/kiln-vault.ts`, then build**

Run: `npm run build`
Expected: `Built kiln-check.mjs, kiln-vault.mjs`. No change to `scripts/build.mjs`: it bundles every `src/cli/*.ts`. `kiln-vault.mjs` inlines no package, so it carries the header and no licence notice; `kiln-check.mjs` comes out unchanged.

- [ ] **Step 4: Run everything**

Run: `npm run format && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build:check`
Expected: all PASS; `npm test` reports 190 passed, 1 skipped (143 before this plan, plus 47 from Tasks 1 to 5); `Bundles match src/.` (If `npm run format` changed `src/`, run `npm run build` again first.)

- [ ] **Step 5: Commit**

```bash
git add src/vault/run.ts src/cli/kiln-vault.ts claude-plugin/scripts/kiln-vault.mjs tests/vault/run.test.ts tests/vault/bundle.test.ts
git commit -m "feat(vault): bundle kiln-vault.mjs, the vault resolver for skills" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `/kiln:check` finds the vault with the resolver; the docs

**Files:**
- Modify: `claude-plugin/skills/check/SKILL.md` (step 1 only), `claude-plugin/blueprint/README.md` ("Conventions" only), `README.md` ("What's in the repo" only)
- Test: `tests/check/skill.test.ts`, `tests/kit/docs.test.ts`

**Interfaces:**
- Consumes: `kiln-vault.mjs`, its JSON and exit codes (Task 5).
- Produces: the resolver call that #82's vault rules ("Find the vault with the resolver") and #72's setup point to.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('/kiln:check', ...)` block in `tests/check/skill.test.ts`:

```ts
  it('finds the vault with the resolver, and leaves the kiln file to setup', () => {
    const step = body.slice(body.indexOf('## 1. Find the vault'), body.indexOf('## 2.'));
    expect(step).toContain('node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-vault.mjs"');
    expect(step).toContain('node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-vault.mjs" "<folder>"');
    for (const part of ['candidates', 'reasons', '/kiln:setup', '~/.kiln/config.json']) expect(step, part).toContain(part);
    expect(step).not.toContain('The vault resolver replaces this step');
    expect(existsSync(`${PLUGIN}scripts/kiln-vault.mjs`)).toBe(true);
  });
```

Append to the `describe('blueprint docs', ...)` block in `tests/kit/docs.test.ts`:

```ts
  it('the README says how Claude finds the vault, in Bash and PowerShell', () => {
    const conventions = section(readme, 'Conventions');
    for (const part of ['~/.kiln/config.json', 'KILN_VAULT', 'export KILN_VAULT=work', "$env:KILN_VAULT = 'work'"]) {
      expect(conventions, part).toContain(part);
    }
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/check/skill.test.ts tests/kit/docs.test.ts`
Expected: FAIL: the skill's step 1 has no resolver call; the README has no `KILN_VAULT`.

- [ ] **Step 3: Replace step 1 of `claude-plugin/skills/check/SKILL.md`**

Replace everything from `## 1. Find the vault` up to (not including) `## 2. Run the check`, the marker comment and its paragraph included, with:

````markdown
## 1. Find the vault

If the owner named notes or folders to check, skip this step: the check finds their vault itself.

Otherwise run the vault resolver. Pass the folder if the owner named one:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-vault.mjs"
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-vault.mjs" "<folder>"
```

It prints JSON, the same in Bash and pwsh. Exit code 0: `vault` is the vault folder to use. Exit code 1: no vault was found. Tell the owner the `reasons`, list the `candidates`, and ask which vault to use. Offer to record the answer through `/kiln:setup`, which is the only writer of `~/.kiln/config.json`; never edit that file yourself.
````

Keep the rest of the skill as it is.

- [ ] **Step 4: Add the bullet to `claude-plugin/blueprint/README.md`**

In "Conventions", straight after the `/kiln:check` bullet (before "Archive, never delete"):

```markdown
- **Claude finds the vault** from any folder. In the vault, or a folder inside it, Claude uses that vault. Elsewhere it uses `KILN_VAULT`, a vault name or folder for one terminal (`export KILN_VAULT=work` in Bash, `$env:KILN_VAULT = 'work'` in PowerShell), then the default vault in `~/.kiln/config.json`, which setup writes (on Windows, `.kiln` is in your home folder). If none of those answers, Claude asks.
```

Then, in the root `README.md`'s "What's in the repo" table, change three rows and add one, keeping the others as they are:

```markdown
| `claude-plugin/scripts/` | The scripts the skills run, such as `kiln-check.mjs` and `kiln-vault.mjs`: each one file built from `src/` by `npm run build`, committed, never edited by hand |
| `src/` | The code: `blueprint/` reads a blueprint's definitions, `check/` is the note check, `vault/` finds the vault, `cli/` holds an entry point per script |
| `tests/check/` | Checks the note check, the built `kiln-check.mjs` and the check skill |
| `tests/vault/` | Checks finding the vault: the resolution order, the kiln file, Obsidian's vault list and the built `kiln-vault.mjs` |
```

(The `tests/check/` row is unchanged; the `tests/vault/` row goes straight after it.)

- [ ] **Step 5: Run everything, and validate the plugin**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build:check`
Expected: all PASS; `npm test` reports 192 passed, 1 skipped.

Run: `claude plugin validate .`
Expected: `✔ Validation passed with warnings`, the only warning the expected no-version one. (Validate only; never install the plugin into your own Claude Code config.)

- [ ] **Step 6: Commit**

```bash
git add claude-plugin/skills/check/SKILL.md claude-plugin/blueprint/README.md README.md tests/check/skill.test.ts tests/kit/docs.test.ts
git commit -m "feat(plugin): /kiln:check finds the vault with kiln-vault.mjs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Not in this plan

- **Setup writing the kiln file** and offering the permission settings (the vault as an additional directory, "ask first" on `.obsidian/**` and `_kiln/**`): #72. It calls `recordVault` from `src/vault/config.ts`.
- **The vault rules reference** (`claude-plugin/reference/vault-rules.md`), whose first rule is "find the vault with the resolver": #82.
- **Routes** (folder-to-vault pointers between `KILN_VAULT` and the default): the Multiple bases flow. `recordVault` already keeps a `routes` key.
- **A start-up hook** that tells every session the vault: ruled out by the spec.
- **A vault identity note:** open in the spec.

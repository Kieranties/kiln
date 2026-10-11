# kiln

A personal knowledge and work system: unshaped things in, finished things out.

## What kiln v1 does

kiln v1 is a knowledge base you can reach from any Claude Code session. Through its Claude Code plugin you can:

- **capture** a Jira issue, a Slack thread, a PR, an email, a meeting or pasted text into an inbox;
- **triage** the inbox into anchors, projects, work items, decisions and references;
- **recall** what you know or decided, with `[[links]]` to the notes;
- **review** what Claude filed and flagged as unsure.

Markdown files in a folder (a *base*) are the truth. kiln keeps a rebuildable SQLite index beside them. Obsidian is the viewer; open the base folder as a vault.

**New here? Follow [Getting started](docs/getting-started.md)** for setup from scratch, a first session, updating, troubleshooting and uninstalling. The sections below are the reference.

## Install

Requires Node 24 or later (kiln uses `node:sqlite`). kiln ships as two parts that must stay in step:

- **The `kiln` command**: the `@kieranties/kiln` package on GitHub Packages, also attached as a `.tgz` to each [GitHub Release](https://github.com/Kieranties/kiln/releases).
- **The Claude Code plugin**: the `kiln` plugin in this repo's marketplace (`claude plugin marketplace add Kieranties/kiln`).

The plugin in `plugin/` registers the `kiln mcp` server, the capture, triage, recall and review skills, and two hooks: the write guard and a session orientation line. Both the hooks and the MCP server run the `kiln` command on your PATH.

[Getting started](docs/getting-started.md) has the full steps: the GitHub Packages token, both install routes, plugin auto-update, and updating.

**Update both together.** If the hooks call a `kiln` that lacks a command they expect, they fail. A mismatched command can block every Write and Edit: an older command without the `hook` command exits with code 2, which Claude Code treats as "block this tool call".

## Configure

kiln reads `~/.kiln/config.yaml`. Set `KILN_CONFIG` to use another file.

```yaml
bases:
  - name: work
    path: Z:/kb/work
  - name: personal
    path: C:/Users/me/kb/personal
rules:
  - path: Z:/clients/**
    base: work
  - path: Z:/code/**
    base: work
default_base: personal
```

- `bases`: each base's name and folder.
- `rules`: which base a working folder uses.
  - A rule's `path` is an absolute glob with forward slashes.
  - Rules are tried in order, and the first match wins.
  - Matching is case-insensitive on Windows.
- `default_base`: the base used when no rule matches.

**Base resolution order:** an explicit `base` (a tool argument or `--base`), then the first matching rule, then `default_base`. With none of them, kiln reports `no_base`.

**`kiln init` rewrites this file.** It drops comments and any keys kiln does not know. Keep notes about your setup somewhere else.

### Where the MCP server looks

The MCP server resolves the base from the session's project root: `CLAUDE_PROJECT_DIR`, or its launch directory when that is unset. In a git worktree session, this is the **main repo root**, not the worktree. For example, a session in `D:\src\kiln\.claude\worktrees\…` ran the server with `cwd` `D:\src\kiln`. So write rules for the project root, e.g. `D:/src/kiln/**`.

To check which base a folder gets: `kiln status --line --cwd <folder>`.

## Start a base

```sh
kiln init <path> --name <name>
```

This creates the folder layout (`anchors/`, `projects/`, `work/`, `decisions/`, `references/`, `notes/`, `attachments/`, `sources/<kind>/`, `views/`), the Obsidian views and the ignore entries, and registers the base in the config. The first base you register becomes `default_base`. `init` adds no rule; add one under `rules` if the base belongs to particular folders.

**Build the index straight after init**, before you start a session:

```sh
kiln reindex --base <name>
```

For an existing or large folder this can take a while (about 30 s per 100,000 notes). The session-start hook never builds the index: until you run `kiln reindex`, it prints `kiln: base=<name> · index not built: run kiln reindex`.

## Command reference

| Command | What it does |
|---|---|
| `kiln init <path> --name <name>` | Create a base at `<path>` and register it. Prints `{ name, path }`. |
| `kiln validate [--base <name>]` | Bring the index up to date, then print one line per finding (`kind`, path, message) and a count per kind. Finding kinds: `schema`, `broken_link`, `missing_enrichment` and `possible_duplicate`. Exit code 0 when there are no `schema` findings, 1 when there are any (or on an error such as an unknown base), 2 on bad usage. |
| `kiln reindex [--base <name>]` | Rebuild the index from the files and print its stats. |
| `kiln status [--line] [--cwd <dir>] [--base <name>]` | Print the base as JSON: `base`, `path`, `cwd`, and the `notes`, `inbox` and `needsReview` counts. Builds the index if it is missing. `--line` prints the one-line orientation instead. `--cwd` matches rules against `<dir>` instead of the current folder. Prints nothing when no base matches. |
| `kiln mcp` | Start the MCP server on stdio. The plugin runs it. |
| `kiln hook write-guard` / `kiln hook session-start` | The plugin's hooks. Each reads the hook's JSON on stdin. An unknown hook name exits 1, which does not block. |

The base for `validate`, `reindex` and `status` follows the resolution order above, matched from the current folder.

## Write guard

Every write to a base goes through kiln, so notes stay valid and indexed. The guard is a PreToolUse hook that blocks Claude's **Write, Edit, MultiEdit and NotebookEdit** on any file inside a base, and names the kiln tools to use instead. It follows junctions and symlinks, and reads Git Bash `/x/...` paths as drive paths.

It does **not** cover Bash. A shell command can still write into a base.

## Developing kiln

To run kiln from source instead of a release:

1. **Add a `.npmrc`** to the repo root containing:

   ```
   registry=https://registry.npmjs.org/
   ```

   Add this file by hand, because a permission rule blocks agents from writing it ([#56](https://github.com/Kieranties/kiln/issues/56)).

2. Build, link and install the plugin from your checkout:

   ```sh
   npm install
   npm run build
   npm link                                    # puts the `kiln` binary on your PATH
   claude plugin marketplace add <repo path>   # this repo's .claude-plugin/marketplace.json
   claude plugin install kiln@kiln
   ```

**Install from the main checkout, not a git worktree.** The `npm link` and the plugin point at the folder you install from. If that folder is a worktree and the worktree is cleaned up, kiln breaks in every session.

**Rebuild and relink together.** After pulling or changing kiln, run `npm run build && npm link` and update the plugin in the same step. To go back to a release, run `npm rm -g @kieranties/kiln`, remove the local marketplace (`claude plugin marketplace remove kiln`), and follow [Getting started](docs/getting-started.md).

### Versioning and releases

Versions come from [Nerdbank.GitVersioning](https://github.com/dotnet/Nerdbank.GitVersioning) (`nerdbank-gitversioning`).

- `version.json` holds the major and minor version. The patch is the git height: the number of commits since `version.json` last changed.
- `main` is the release branch. Each green commit on `main` publishes `<major>.<minor>.<height>`: the `release` job tags `v<version>`, publishes `@kieranties/kiln` to GitHub Packages, and creates a GitHub Release with the `.tgz`.
- PRs build, test and pack a prerelease (`<version>-g<sha>`, downloadable from the run's `package` artifact), but never publish.
- To start a new minor or major line, change `version` in `version.json` in a PR.
- The committed `package.json` version is a placeholder (`0.0.0-placeholder`). CI stamps the real version before packing. Stamping needs a .NET 8 or later runtime and the full git history; building and testing need neither. To see the version locally: `npx nbgv get-version`.
- The plugin has no version. Claude Code uses the commit SHA, so the plugin updates whenever `main` moves.

`main` only changes through a squash-merged PR whose `lint`, `test (ubuntu-latest)`, `test (windows-latest)` and `package` checks pass. `v*` tags cannot be moved or deleted. The rules live in `.github/rulesets/`; apply changes with `scripts/apply-repo-settings.sh`.

### Lint, format and type check

```sh
npm run lint          # oxlint with type-aware rules
npm run format        # Prettier; format:check only checks
npm run typecheck     # tsc over src, tests and scripts
```

CI runs all three, plus `claude plugin validate` on the marketplace and the plugin. Markdown and `tests/fixtures/` are not formatted: prose is hand-wrapped, and fixtures must stay byte-identical.

## Checks

### Tests and the retrieval eval

`npm test` runs the whole suite, including the retrieval regression in `tests/eval/retrieval.test.ts`. It searches the fictional fixture base with the golden questions (`tests/fixtures/golden.json`), raw and with variants, and fails if any category's recall@5 or MRR falls below the frozen thresholds in `tests/eval/thresholds.json`.

When a deliberate ranking change moves the numbers, re-record the thresholds and commit them with the change:

```sh
KILN_EVAL_RECORD=1 npx vitest run tests/eval/retrieval.test.ts
```

### Scale benchmark

```sh
npx tsx scripts/scale.ts --notes 100000 --out <dir>
```

The script copies the fixture base into `<dir>` and generates notes until the base holds N. It recombines fixture titles, frontmatter patterns and paragraphs with a seeded PRNG, so the output is deterministic and fictional. It times the cold build (`Index.open` on the fresh base), a forced rebuild, a no-change re-check, and 50 searches built from the golden questions. It prints PASS or FAIL against the targets. Exit codes: 0 every target met, 1 a target missed, 2 bad usage or an error.

`<dir>` must be missing or empty, or be the output of an earlier run (it holds a `.kiln-scale` marker). Delete it when you are done: 100k notes take about 600 MB on disk.

#### Scale (100k notes)

Measured 2026-10-10 on Windows 11, Node 24 (24.3.0), Intel Core Ultra 9 285K, Dev Drive (ReFS). The generated base held 40,118 sources, 15,073 notes, 14,983 work items, 12,079 references, 9,839 decisions, 5,873 anchors and 2,035 projects.

| Measure | Result | Target |
|---|---|---|
| Cold build (`Index.open`, fresh base) | 32.27 s | < 60 s |
| Forced rebuild (`reconcile({ force: true })`) | 32.25 s | < 60 s |
| No-change re-check (`reconcile()`) | 1.20 s | < 2 s |
| Query, raw `q` (50 searches) | p50 144.3 ms, p95 168.0 ms, max 170.6 ms | p95 < 300 ms |
| Query, `q` + variants (50 searches) | p50 173.0 ms, p95 209.3 ms, max 217.0 ms | p95 < 300 ms |

The files had just been written, so the cold build ran with a warm OS file cache.

A generated note averages about 1.25 KB, so the base holds about 125 MB of note content. The ~600 MB figure is on-disk usage, most of it the index (`kiln.sqlite`, about 440 MB). All the vocabulary is recombined from the 105 fixture notes, so a real vault with a wider vocabulary may index and search differently.

### Manual triage check

This scores the `triage` skill against one simulated day of captures (`tests/fixtures/day/`). It needs a Claude session, so it is not part of `npm test`.

**Result:** a headless `claude -p` run on 2026-10-10 with the `kiln:triage` skill scored 12/12 (1.00). It emptied the inbox, and `validate` was clean afterwards.

**Point the session at the scratch base.** The kiln tools choose a base in this order: an explicit `--base`, then the first `rules` entry matching the working directory, then `default_base`. `kiln init` adds no rule, and the triage skill names no base. Without the rule in step 2, a session in the scratch folder triages your **real** inbox if you have a default base.

1. Create a scratch base: `kiln init <tmp> --name triage-check`.
2. Add a rule for it at the **top** of `rules` in `~/.kiln/config.yaml` (or the file `$KILN_CONFIG` names). Rules are tried in order and the first match wins. Use forward slashes:

   ```yaml
   rules:
     - path: <tmp>/**
       base: triage-check
   ```

3. Check that the scratch base is the one in use. Do not start the session until this prints `base=triage-check`:

   ```sh
   kiln status --line --cwd <tmp>
   ```

4. Copy the fixture base into it, then put each capture in `sources/<kind>/`, by its `kind` field. The scorer looks for captures by file name under `sources/`:

   ```sh
   cp -r tests/fixtures/base/* <tmp>/
   for f in tests/fixtures/day/captures/*.md; do
     kind=$(sed -n 's/^kind: //p' "$f" | head -n 1 | tr -d '\r')
     cp "$f" "<tmp>/sources/$kind/"
   done
   ```

5. Build the index: `kiln reindex --base triage-check`.
6. Start a Claude session with `<tmp>` as its working directory. Run the `triage` skill until the inbox is empty.
7. Score the result:

   ```sh
   npx tsx scripts/score-triage.ts <tmp> tests/fixtures/day/answer-key.json
   ```

   The script prints the outcome accuracy and one line per mismatch. For information, it also lists every `linked_to` that does not match an expected existing note. Exit codes: 0 when accuracy is at least 0.90, 1 when it is below, 2 for bad usage or an error.

8. Clean up: remove the `triage-check` rule and the `triage-check` entry under `bases` from the config, then delete `<tmp>`. If `default_base` is `triage-check`, which happens when it was your first base, remove that too. Until the base entry is gone, a second run's `kiln init ... --name triage-check` at a new path fails with "Base "triage-check" is already registered".

## About kiln

Work arrives from trackers, conversations, meetings and ad-hoc thoughts. kiln captures it and shapes it into durable knowledge. Later stages start workspaces with the right context, and distil what was learned back into knowledge when the work closes. Claude Code is the main agent and Obsidian the cockpit for viewing and approving.

| Job | Question it answers |
|---|---|
| **Capture** | Throw anything in from anywhere and trust it lands somewhere findable |
| **Resume** | What am I working on, what state is it in, where did I stop? |
| **Start** | Kick off work with Claude already holding the relevant context |
| **Recall** | What do I know, or what did we decide, about X, with links to sources? |

Principles: knowledge is reachable from any session; one inbox has many feeders; earlier setups are prior art, not foundations; everything stays personal and local-first; external systems own their data, and writes out are explicit. See the vision for the full model.

## Docs

- [Getting started](docs/getting-started.md): from nothing to a working setup
- [Open issues](https://github.com/Kieranties/kiln/issues): decisions to verify, follow-ups and checks still to run
- [Vision](docs/vision.md): the model, architecture and flow (current direction)
- [KB core spec (lean v1)](docs/specs/2026-10-10-kb-core-design.md) and [implementation plan](docs/plans/2026-10-10-kb-core-v1.md)
- [Build and release design](docs/specs/2026-10-11-build-and-release-design.md)
- [Decision log](docs/context/2026-10-10-decision-log.md) and [research](docs/research/)

# kiln

A personal knowledge and work system: unshaped things in, finished things out.

Work arrives from trackers, conversations, meetings and ad-hoc thoughts. kiln captures it, shapes it into durable knowledge, starts workspaces with the right context, and distils what was learned back into knowledge when the work closes.

Claude Code is the main agent. Obsidian is the cockpit for viewing and approving. Herdr hosts workspaces. n8n runs intake outside Claude.

## Core jobs

| Job | Question it answers |
|---|---|
| **Capture** | Throw anything in from anywhere and trust it lands somewhere findable |
| **Resume** | What am I working on, what state is it in, where did I stop? |
| **Start** | Kick off work with Claude already holding the relevant context |
| **Recall** | What do I know, or what did we decide, about X, with links to sources? |

## Principles

1. **Reachable from any session.** Knowledge is reachable from any Claude session in any repo or worktree. Obsidian is a viewer, not the gate.
2. **One inbox, many feeders.** Watchers and manual capture land in one inbox; one triage step files them.
3. **Clean slate.** Earlier setups are prior art, not foundations.
4. **Personal, local-first.** Knowledge stays private and local. Contributions to repos are deliberate.
5. **Remote truth, selective local context.** External systems own their data. Only what you engage with is held locally, as a summary. Writes out are explicit and approved.

## Install

Requires Node 24 or later (kiln uses `node:sqlite`).

```sh
npm install
npm run build
npm link                                    # puts the `kiln` binary on your PATH
claude plugin marketplace add <repo path>   # this repo's .claude-plugin/marketplace.json
claude plugin install kiln@kiln
```

## Create a base

```sh
kiln init <path> --name <base>
```

This creates the folder layout (`anchors/`, `projects/`, `work/`, `decisions/`, `references/`, `notes/`, `attachments/`, `sources/<kind>/`, `views/`), the Obsidian views and the ignore entries, and registers the base in the kiln config. The first base you register becomes the default.

## Claude Code plugin

The plugin in `plugin/` (marketplace manifest in `.claude-plugin/`) registers the `kiln mcp` server, the capture, triage, recall and review skills, and two hooks: a write guard on Write/Edit/MultiEdit/NotebookEdit and a session orientation line. Both the hooks and the MCP server run the `kiln` binary on your PATH (installed with `npm link`).

**Rebuild and relink together.** The plugin and the linked binary must match. After pulling or changing kiln, run `npm run build && npm link` and update the plugin in the same step. If the hooks call a `kiln` that lacks a command they expect, they fail. A mismatched binary can block every Write and Edit: an older binary without the `hook` command exits with code 2, which Claude Code treats as "block this tool call".

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

The script copies the fixture base into `<dir>` and generates notes until the base holds N. It recombines fixture titles, frontmatter patterns and paragraphs with a seeded PRNG, so the output is deterministic and fictional. It times the cold build (`Index.open` on the fresh base), a forced rebuild, a no-change re-check, and 50 searches built from the golden questions. It prints PASS or FAIL against the targets and exits 1 on any FAIL.

`<dir>` must be missing or empty, or be the output of an earlier run (it holds a `.kiln-scale` marker). Delete it when you are done: 100k notes take about 600 MB.

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

### Manual triage check

This scores the `triage` skill against one simulated day of captures (`tests/fixtures/day/`). It needs a Claude session, so it is not part of `npm test`.

1. Create a scratch base: `kiln init <tmp> --name triage-check`.
2. Copy `tests/fixtures/base/*` into it.
3. Copy each `tests/fixtures/day/captures/*.md` into `<tmp>/sources/<kind>/`, using the capture's `kind` field.
4. In a Claude session in `<tmp>`, run the `triage` skill until the inbox is empty.
5. Score the result:

   ```sh
   npx tsx scripts/score-triage.ts <tmp> tests/fixtures/day/answer-key.json
   ```

   The script prints the outcome accuracy and one line per mismatch. For information, it also lists every `linked_to` that does not match an expected existing note. It exits 1 if accuracy is below 0.90.

## Docs

- [Vision](docs/vision.md): the model, architecture and flow (current direction)
- [KB core spec (lean v1)](docs/specs/2026-10-10-kb-core-design.md) and [implementation plan](docs/plans/2026-10-10-kb-core-v1.md)
- [Decision log](docs/context/2026-10-10-decision-log.md) and [research](docs/research/)

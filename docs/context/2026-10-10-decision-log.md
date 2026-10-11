# Decision log: founding session (2026-10-10)

A condensed record of the session that produced the vision, research, spec and plan. Everything here is **current direction, not final**.

## The owner's goals and preferences

- **Phase-1 focus** (restated by the owner before planning):
  1. capture knowledge from external sources;
  2. triage it into a human-readable structure that's easy to access;
  3. let Claude query it and answer questions;
  4. a triage and filing process.
- Core jobs from the vision: capture, resume, start work with context, recall. Resume and start-with-context come later.
- **Avoid over-engineering.** The full design was cut back to a lean v1 at the owner's request.
- **Nothing is concrete; we are exploring, always.** Ground claims in research, and present alternatives.
- **Prefer free, existing, local tools** (MCP, Docker or n8n friendly) over building our own, but only where they genuinely fit (see the research).
- **Scale:** plan for tens of thousands of notes, growing to 100k+ across several bases. Small-scale results are misleading.
- **No real data in tests.** If realistic data is needed, generate it first.
- **Viewer: Obsidian**, because the owner knows it well. Plugins get built as needed. kiln must never *require* Obsidian.
- **Convoy is being dropped.** Don't build on it. The old vault, its skills and convoy are prior art only.

## Decisions (current direction)

| Area | Decision | Why |
|---|---|---|
| Name | **kiln** | "Unshaped in, finished out". `forge` clashed with an existing forge plugin and with Atlassian Forge |
| Repo | Private `Kieranties/kiln` at `D:\src\kiln`, holding all the code, specs and research | |
| Work model | anchors ← project ← work item ← workspace ← worktree. Anchors hold current truth; projects hold history; things that end are projects, things that persist are anchors (e.g. the Fan App is an anchor, and its v1/v2 are projects) | Thrashed out with the owner |
| Work item vs ticket | The ticket is the team's record; the work item is the owner's notebook. Work items are created lazily, link to the ticket and never copy it | |
| Sync | Remote truth, selective local context: live (nothing stored) → pointer → snapshot. Writes back to external systems happen only when explicitly approved | Owner: don't mirror 500 tickets |
| Storage | Markdown is the truth, with our own derived SQLite index | Research and spikes: no PKM app or memory layer beat this at 100k |
| Retrieval | Look up anchor names first, then structured follow-up, then field-weighted BM25 with variants, then read the hits. Enrich (summary and aliases) at write time. Vectors only if evidence demands them | Spike B1: at 100k notes, anchor-first kept every decision and status question findable (recall@5 1.0), while raw BM25 fell to about 0.15 |
| Server | Deterministic, no LLM, no credentials. v1 runs as a **per-session MCP stdio server**, not a daemon | Lean-v1 simplification |
| Writes | Validated tools; duplicate check; revision guard; byte-preserving patches; no deletes | Basic Memory and mdbase both reformat frontmatter; parallel agents create duplicates |
| Review | `review: needed` in frontmatter, with an Obsidian Bases "Needs review" view. Claude flags anything medium or low confidence, and every supersession | Lean v1; spike B3 showed triage around 97% accurate and self-flagging |
| Index location | `<base>/.kiln/index/`, ignored by git and sync, one per machine | Owner preference: keep a base self-contained |
| Logs and git | Deferred. When added: one commit per knowledge change, hourly maintenance commits, untracked rotated log | Owner: logs could get very busy |
| External capture | v1: Claude fetches items by reference through its connectors. Later: n8n as an optional feeder | The owner accepted this for v1 |
| Expiry | Watcher captures expire after 14 days (once feeders exist); manual captures never expire | |
| Hooks | Write guard (Claude must write through kiln tools) and a session orientation line | |
| Execution | Subagent-driven development, with a review after each task | Later tasks depend on exact earlier interfaces |

## Evidence highlights (see research)

- **BM25 overtakes agentic grep at scale.** Above about 10M corpus tokens, BM25 wins ([arXiv 2607.26497](https://arxiv.org/abs/2607.26497), verified).
- **Plain BM25 beat Basic Memory on real notes.** recall@5 was 0.84 vs 0.72; on vocabulary-mismatch questions, 0.83 vs 0.38.
- **Index performance at 100k notes:** about 16 s to build, 0.5 s for a no-change re-check, under 1 ms for structured queries, ranked queries 14-300 ms.
- **Watchers:** `@parcel/watcher` caught 100% of changes; `fs.watch` lost about 40%; chokidar collapsed.
- **CPU embeddings at 100k:** 1-3 hours. Thread count matters, not batch size.
- **Distilled structure at 189 notes:** the same answers with 2.7× less reading and no stale decisions. Cost: about 5k tokens per note in bulk.
- **Weekly inbox:** triage costs about 2.7k tokens per capture; with distillation, about 5.5k.
- **Obsidian at 100k (measured by the owner):** first index about 1 min, reopen a few seconds, Bases view about 1 s, search about 10 s in the worst case. Workable as the viewer.

## Deferred and open

- Deferred: see the spec §11. That covers feeders, the HTTP server and watcher, git and logs, link repair, resume, cockpit plugins, migration, vectors, Docker/WSL, a daily scratchpad, and roadmaps.
- Open: retrieval thresholds are frozen at Task 19 from the generated golden set.

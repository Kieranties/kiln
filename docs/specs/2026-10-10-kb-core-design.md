# kiln sub-project 1: KB core design

Date: 2026-10-10 · Status: **current direction for review, still exploratory** · Related: [vision](../vision.md), [landscape research](../research/2026-10-10-knowledge-landscape.md), [spike results](../research/2026-10-10-spike-results.md)

## 1. Purpose and scope

The KB core is the foundation the rest of kiln calls. It delivers three of the four core jobs from any Claude session:

- **Capture**: manual capture into one inbox.
- **Recall**: what do I know or what did we decide, with links back to sources.
- **Resume**: what am I working on and what changed.

It also provides the storage, write and query surface the later sub-projects build on.

**In scope**
- Knowledge-base layout and note types.
- The kiln server (MCP + HTTP).
- The index and retrieval.
- Changeset writes.
- The Claude Code plugin: skills, hooks, the `kiln mcp` launcher and the `kiln` CLI.
- The test strategy, including generated fixtures.

**Out of scope** (later sub-projects, in build order):
- 2: feeders (n8n and the snapshot sweep)
- 3: workspace lifecycle (context packs, close-out, outbound actions)
- 4: the Obsidian cockpit plugins
- 5: migration of the existing vault

**Planning scale:** tens of thousands of notes per base, growing to 100k or more, across several bases.

## 2. Principles this design must honour

- **P1 Reachable from any session.** Every Claude session in any repo or worktree reaches kiln automatically.
- **P2 One inbox, many feeders.**
- **P3 Clean slate.**
- **P4 Personal and local-first.** Knowledge stays local, and real knowledge never enters the code repo or its tests.
- **P5 Remote truth, selective local context.**
- **Markdown is the truth.** The index is a rebuildable cache.
- **Obsidian is the viewer and cockpit** (current direction), but kiln never requires it.
- **Byte-preserving writes.** kiln changes only what it means to change.
- **The server is deterministic.** It holds no external credentials and never calls an LLM. All judgement (triage, enrichment, distillation) happens in Claude sessions and arrives as proposals.

## 3. Process model

- **One local daemon, `kiln serve`**, bound to `127.0.0.1`.
  - It exposes an **HTTP API** (for n8n, Obsidian plugins and the CLI; bearer token from config) and **MCP** (for Claude).
  - There is one process and so **one writer per base**.
- **`kiln mcp`** is a stdio launcher registered at user scope.
  - It starts the daemon if needed and proxies to it.
  - It passes the session's working directory so the server can choose the base.
- **Startup:** the daemon starts at Windows logon, and any `kiln` command starts it on demand.
- **Hosting:** native Node on Windows for now. Docker and WSL hosting are on the future list.
- **Config** lives in `~/.kiln/config.yaml`: port, token, `default_base`, `bases` (name → path) and `rules` (path glob → base, first match wins).
  - Base resolution order: an explicit `base=`, then the session folder matched against the rules, then `default_base`.
- **Change detection**
  - `@parcel/watcher` gives hint events.
  - A **stat-scan reconcile** runs at startup and every few minutes. It costs about 0.5 s per 100k notes and is the source of truth.
  - Node `fs.watch` and chokidar are not used. In the spike they lost events silently or collapsed.
- **Renames** arrive as delete + create and are paired by note `id`.
- **Git is optional per base.** If the base is a repo:
  - each applied **knowledge changeset** becomes one commit, so each change can be reverted on its own;
  - **routine machine changes** (snapshot refreshes, `id` insertions, link repairs) are batched into **at most one maintenance commit per hour**, e.g. `kiln: maintenance (snapshots 112, links 37)`;
  - kiln never pushes.
- **Optional background job:** embeddings are off by default (see §6).

## 4. Knowledge-base layout and note types

```
<base>/                                 one Obsidian vault per base
  anchors/{organisation,product,service,person,topic}/
  projects/
  work/<year>/
  decisions/<year>/
  references/   notes/   attachments/
  sources/{jira,github,slack,email,meeting,web,note}/   inbox + snapshots (may be hidden from Obsidian search)
  .kiln/log/events-YYYY-MM.jsonl        operational event log (ignored by git and sync; rotated monthly, ~12 months kept)
  .kiln/index/                          SQLite index (ignored by git and sync; per machine)
```

**Identity and moves**
- A note's identity is its `id` (a ULID in frontmatter). Files may be moved or renamed freely.
- kiln follows notes by `id`. It **automatically repairs** `[[links]]` broken by moves made outside Obsidian, where the `id` makes the target certain. Each repair is logged and can be undone through git.
- Folder placement is the convention kiln uses when it creates a note, not a constraint. Mass reorganisations are discouraged only because of their cost.
- Notes created without an `id` get one inserted the first time kiln sees them. This, and link repair, are the only automatic edits kiln makes to hand-written notes.

**Types**

| type | kinds | status |
|---|---|---|
| `anchor` | organisation (with `role`: client, vendor, partner, self), product, service, person, topic | active, archived |
| `project` | none | shaping, active, paused, closing, closed |
| `work` | feature, bug, chore, incident, research | active, blocked, paused, done, abandoned |
| `decision` | none | proposed, active, superseded |
| `reference` | doc, spec, code, post, thread, video, dashboard, sheet, slides | active, archived |
| `source` | jira, github, slack, email, meeting, web, note | `tier`: pointer, snapshot · `triage`: pending, linked, dismissed, expired |
| `note` | none | none |

**Common frontmatter**

```yaml
id: 01J...            # ULID
type: work
kind: bug
title: ...
status: active
created: 2026-10-10
updated: 2026-10-10
aliases: []           # names and nicknames used for lookup; key to anchor-first retrieval
summary: ""           # 1-2 plain-language sentences
keywords: []          # optional business and technical terms (low search weight)
anchors: []           # [[links]]
sources: []           # provenance; required on Claude-written notes
confidence: verbatim  # verbatim | inferred; required on Claude-written notes
```

Type-specific fields:
- **decision:** `decided_on`, `supersedes`, `superseded_by`, `project`
- **work:** `project`, `ticket`, `last_checkpoint`
- **source:** `source_id`, `dedupe_key`, `url`, `captured_at`, `captured_by` (watcher or manual), `why`, `refreshed_at`

**Body sections** are fixed headings so section-level edits are safe:
- anchor: Summary (dated current truth) · Facts · Known issues · Decisions · Open work
- project: Goal · Status · History
- work: Summary · Checkpoints · **Open items (listed verbatim)** · Outcome
- decision: Context · Decision · Consequences

## 5. API and write rules

The same operations are exposed over MCP and HTTP.

**Read**
- **`resolve(name)`** maps a name or alias to an anchor plus its brief. It is the first step for most questions.
- **`query(type, kind, status, anchors, project, dates…)`** runs structured filters.
- **`search(q, variants[])`** runs field-weighted BM25 (title > aliases > summary > keywords > body) with type and status boosts (anchors and active decisions up, superseded down). Claude supplies 2-4 query variants. It searches within notes linked to resolved anchors first, then globally.
- **`brief(id)`** returns a capped summary of an anchor or project: current truth, active decisions, open work.
- **`get(id)`** returns the full note plus its revision (sha256 of the bytes).
- **`inbox()`**, **`resume()`**, **`due_snapshots()`**.

**Write**
- **`capture(...)`** and **`put_snapshot(...)`** are the only ways to write `source` notes.
- **`propose(changeset, dry_run)`** and **`apply(changeset)`** are the only way to write knowledge notes.
- A changeset is an ordered set of operations: `create`, `update` (fields and named sections), `supersede`, `link`, `archive`, and `mark_source` (sets a source's `triage` state: linked or dismissed, so a capture's triage outcome lands in the same atomic changeset as the knowledge changes it caused). Each operation carries `if_revision` for existing notes.

**Rules**
1. **Validated.** Every changeset is checked against the schema and rejected whole on error, with field-level messages and fix hints.
2. **Duplicate-checked.** A matching `dedupe_key`, overlapping `sources` or a near-identical title of the same type returns a `conflict` naming the existing note.
3. **Revision-guarded.** A stale `if_revision` returns a `conflict`, so a hand edit is never overwritten.
4. **Atomic.** Files are written to a temp file and then renamed. A changeset applies fully or is rolled back.
5. **Byte-preserving.**
   - Frontmatter is edited as text: only the targeted keys change, in their existing style. The block is never re-serialised.
   - Body edits target named sections.
   - Line endings and untouched bytes are preserved.
6. **No hard deletes.** Notes are only archived, and sources only dismissed or expired. Real deletion is a human action in the filesystem.
7. **Logged at two levels.**
   - **Knowledge changesets and captures** are logged in full (client, tool, notes touched, diff summary) to `.kiln/log/`.
   - **Routine machine changes** (snapshot refreshes, `id` insertions, link repairs, reconciles) get one summary line per run.
   - The log is operational data: it is not tracked by git or synced, it rotates monthly and keeps about 12 months (configurable).
   - Resume's "what changed" reads only the knowledge-level entries.
   - Git commits follow §3: one per knowledge changeset, plus an hourly maintenance commit.

**Apply policy for Claude's changesets**
- Changesets where every item is rated `high` confidence are **applied automatically** and shown in Resume. They can be undone through git.
- Anything rated `medium` or `low`, and **every decision supersession**, is **held for review**.

## 6. Index and retrieval

**Index:** one SQLite database per base at `<base>/.kiln/index/`.

| Table | Holds |
|---|---|
| `files` | path, size, mtime, hash, id |
| `notes` | frontmatter columns |
| `links` | frontmatter and body links |
| `aliases` | titles and aliases |
| `fts` | contentless FTS5 (porter unicode61) over title, aliases, summary, keywords and body; snippets are read from files |

- **Build:** parallel parsing feeds a single writer.
- **Reconcile:** incremental, at startup, periodically, and on watcher hints.
- **Full rebuild into a fresh database and swap** when more than about 30% of files have changed, or when the index schema changes.
- **Reference figures** (spike, 100k notes): about 16 s cold build, about 300 MB, structured and backlink queries under 1 ms, ranked queries 14-300 ms.

**Retrieval order** (implemented by skills, using the tools)
1. Resolve names to anchors, then call `brief`.
2. Structured follow-up on those anchors: active decisions, open work, recent changes.
3. `search` with variants, scoped to the anchors first and then global.
4. Claude reads the top hits with `get`, and greps only as a fallback.
5. Live MCP reads, only for current external state.

**Write-time enrichment.**
- Claude-created notes must include `summary` and `aliases`; `keywords` are optional.
- Existing notes are backfilled during migration (sub-project 5).

**Upgrades held back until evidence calls for them**
- **Vector search** (bge-small q8, ONNX in Node, 16 threads, curated notes first; about 1 h per 100k notes, then incremental) only if the regression set shows persistent vocabulary-mismatch misses.
- **Performance work** (pre-filtering by type or anchor before ranking) if p95 exceeds about 300 ms.

**Multiple bases:** one index per base. Searches cover one base unless `base=all`.

## 7. Claude Code plugin: skills and hooks

The plugin lives in this repo and is installed at user scope. It provides the `kiln mcp` registration, the skills, the hooks and the `kiln` CLI (`capture`, `resume`, `search`, `doctor`, `reindex`, `serve`).

| Skill | Behaviour |
|---|---|
| `capture` | Saves text, a link or the current session context as a `source` with a `why`. It can triage the capture immediately. |
| `triage` | Works through the inbox in batches and decides one outcome per item: dismiss, link-to-anchor, update-work-item, new-work-item, new-decision/supersede, new-reference or duplicate-of. **It goes as deep as each item needs**: routing-only items stop there, and items that change knowledge are distilled immediately. Changesets follow the apply policy. |
| `recall` | Runs the retrieval order in §6 and answers with `[[links]]` to the notes it used. |
| `resume` | Shows open work and where each item stopped, changes since the last look, the review queue, stale snapshots and doctor findings. |
| `review` | The weekly pass: approve held changesets, merge duplicates, act on lint findings, expire old watcher items. |
| `distil` | On-demand distillation of a work item or project. Open items are carried over verbatim, with confidence and sources. |
| `doctor` | Deterministic checks: schema, broken links (auto-repaired), likely duplicates, notes missing summary or aliases, anchors not verified recently. |

**Hooks**
1. **Write guard.** Blocks Claude's direct Write/Edit to files inside any configured base, so that all writes go through `propose`/`apply`. Human edits in Obsidian are unaffected.
2. **Session orientation.** At session start, adds one short line, e.g. `kiln: base=work · inbox 14 · open work 9 · 3 held for review`.

**Inbox expiry.** Watcher-captured sources left untriaged for **14 days** become `triage: expired`: hidden from the inbox and Resume, still searchable and revivable. Manual captures never expire.

**Expected cost** (spike B3): about 2.7k tokens per routing-only capture and about 5.5k per capture that changes knowledge. That is roughly 30-65k tokens a day at about 12 captures. A budget setting can defer low-priority distillation to the weekly review if needed.

## 8. Error handling

| Situation | Behaviour |
|---|---|
| Validation failure | Whole changeset rejected with field-level errors and hints; nothing written |
| Stale revision | `conflict`; Claude re-reads and redoes the change |
| Possible duplicate | `conflict` naming the existing note |
| Crash mid-changeset | Temp file + rename per file; roll back partial work |
| File locked (Obsidian, Defender, sync) | Short retries, then a clear error; never a half-written file |
| Index corrupt or schema changed | Automatic rebuild |
| Watcher missed events | The periodic reconcile catches them |
| Hand edit breaks the schema | Reported by `doctor` and Resume, never silently fixed (except `id` insertion and link repair) |
| Server unavailable | Skills fall back to read-only grep over the vault and say so; no writes |
| Git commit fails | The write stands (the event log records it); `doctor` flags it, and the change is included in the next successful commit |

## 9. Testing

**Data policy:** **no real knowledge in the repo or tests.** Realistic material is **generated first** and then frozen as fixtures.

- **Generated fixtures** (`tests/fixtures/`):
  - a fictional organisation with clients, people, services, projects, meetings, tickets and decisions written to resemble real work;
  - a **golden question set** with answer keys across the five categories (exact-term, vocabulary-mismatch, decision/temporal, multi-hop, resume/status);
  - a **simulated inbox week** with an answer key;
  - the **100k synthetic-scale generator**, built on the generated corpus.
- **Unit tests (TDD):**
  - the byte-preserving frontmatter patcher, against tricky files (comments, flow and block lists, quoting styles, CRLF and LF), asserting that only the targeted lines change;
  - schema validation, placement, duplicate detection, the revision guard, rename pairing and link repair.
- **Integration tests:**
  - the server against a temp vault;
  - changeset apply and rollback;
  - watcher and reconcile under bulk change (10k rewrites plus renames).
- **Retrieval regression:** the golden set with per-category minimum recall@5 and MRR, plus the 100k scale test (build time, p95 query) before releases.
- **Skill evaluation:**
  - `triage` on the simulated week against its answer key, target ≥ 90% outcome accuracy;
  - `recall` end to end on the golden set.

## 10. Acceptance criteria for sub-project 1

1. A Claude session in any folder can capture, recall and resume against the right base without setup per session.
2. All writes go through changesets, and the write guard blocks direct edits.
3. Patcher tests prove that untouched bytes are preserved.
4. Rename and move round-trips keep the index and links correct.
5. On the generated golden set, recall@5 meets the agreed thresholds per category (set when the fixtures are frozen).
6. At 100k generated notes: cold build under 60 s, reconcile with no changes under 2 s, p95 ranked query under 300 ms.
7. `triage` scores ≥ 90% outcome accuracy on the simulated week.

## 11. Future list (not in this sub-project)

- Docker hosting (polling watcher, index in a volume, path mapping) and a WSL hosting spike.
- A daily scratchpad or todo page.
- Roadmaps as views over product anchors and projects.
- A vector search layer (see §6).
- Optional derived layers for a curated subset (e.g. a Graphiti-style temporal decision graph).
- Push of a base to a private git remote.
- Ideas borrowed from prior art: standing queries as regenerated views (Hindsight), rolling thread summaries (Graphiti sagas), MCP resources as instructions (Backlog.md), a ready/next query (Beads).

# kiln sub-project 1: KB core design (lean v1)

Date: 2026-10-10 · Status: **current direction for review, still exploratory** · Related: [vision](../vision.md), [landscape research](../research/2026-10-10-knowledge-landscape.md), [spike results](../research/2026-10-10-spike-results.md)

## 1. Goal and scope

v1 delivers four things, from any Claude session:

1. **Capture** knowledge from external sources and from you: Jira, Slack, GitHub, email or meetings by reference, plus text and links.
2. **Triage** captures into a **human-readable structure** you can browse in Obsidian.
3. **Query**: Claude answers questions from that structure, with links to the notes it used.
4. **Review and filing**: a lightweight process for checking what Claude filed.

**Planning scale:** tens of thousands of notes per base, growing to 100k or more, across several bases.

**Out of scope for v1.** Everything below is listed in §10 and can be added without redesign:
- automated feeders (n8n, watchers)
- snapshot refresh
- the HTTP API and an always-on server
- the file watcher
- git integration and operational logs
- automatic link repair
- the resume dashboard
- workspace lifecycle
- Obsidian cockpit plugins
- migration of the old vault
- vector search

## 2. Principles

- **Markdown is the truth.** The index is a rebuildable cache.
- **Obsidian is the viewer**, but kiln never requires it.
- **Reachable from any Claude session** in any repo or worktree.
- **Remote truth, selective local context.** Keep what you engaged with, linked back to the original.
- **Byte-preserving writes.** kiln changes only what it means to change.
- **kiln's tools are deterministic.** They hold no external credentials and never call an LLM. All judgement (triage, summaries, filing) happens in Claude sessions.
- **No real knowledge in the code repo or its tests.** Realistic test data is generated.

## 3. How it runs

- **`kiln mcp`** is an MCP stdio server.
  - It is registered at user scope by the kiln Claude Code plugin, so every Claude session starts its own instance automatically.
  - There is no long-running daemon in v1.
- **Base selection:** the server matches the session's working folder against `rules` in `~/.kiln/config.yaml`. An explicit `base=` on any call overrides the match, and `default_base` is the fallback. Config holds `bases` (name → path), `rules` (path glob → base, first match wins) and `default_base`.
- **Shared index, safe concurrency**
  - Each base has one SQLite index at `<base>/.kiln/index/kiln.sqlite`, in WAL mode.
  - Any number of sessions can read at once.
  - **All writes** go through one write lock: a SQLite `BEGIN IMMEDIATE` transaction held for the duration of the write. Writes cover note files and index updates. One writer at a time across all sessions; a busy timeout makes others wait briefly.
- **Freshness without a watcher**
  - Before answering, the server re-checks the folder (file stat scan, about 0.5 s per 100k notes) if the last check was more than **10 seconds** ago.
  - Changed files are re-parsed.
  - kiln's own writes update the index in the same transaction.
  - If more than about 30% of files changed, or the index schema changed, the index is rebuilt (about 16 s per 100k notes).
- **CLI:** the same package provides `kiln init`, `kiln validate` and `kiln reindex`.
  - `kiln init <path> --name <base>` creates the folders, ignore entries for `.kiln/` (git and Syncthing), and the Obsidian views (§4), and registers the base in config.
- **Hosting:** native Node on Windows.

## 4. Knowledge structure (human-readable)

**Layout: one Obsidian vault per base**
```
<base>/
  anchors/{organisation,product,service,person,topic}/
  projects/
  work/<year>/
  decisions/<year>/
  references/   notes/   attachments/
  sources/{jira,github,slack,email,meeting,web,note}/   captures (the inbox)
  views/   Inbox.base · Needs review.base · Active work.base · Decisions.base
  .kiln/index/                                         ignored by git and sync; per machine
```

**Identity.** Notes created by kiln carry an `id` (a ULID). Hand-written notes without an `id` are tracked by path. Files may be moved freely. `validate` reports any links broken by moves made outside Obsidian.

**Types**

| type | kinds | status |
|---|---|---|
| `anchor` | organisation (`role`: client, vendor, partner, self), product, service, person, topic | active, archived |
| `project` | none | shaping, active, paused, closing, closed |
| `work` | feature, bug, chore, incident, research | active, blocked, paused, done, abandoned |
| `decision` | none | proposed, active, superseded |
| `reference` | doc, spec, code, post, thread, video, dashboard, sheet, slides | active, archived |
| `source` | jira, github, slack, email, meeting, web, note | `triage`: pending, linked, dismissed |
| `note` | none | none |

**Common frontmatter**

```yaml
id: 01J...
type: work
kind: bug
title: ...
status: active
created: 2026-10-10
updated: 2026-10-10
aliases: []          # names and nicknames for lookup
summary: ""          # 1-2 plain-language sentences
keywords: []         # optional, low search weight
anchors: []          # [[links]]
sources: []          # provenance (required on Claude-written notes)
confidence: verbatim # verbatim | inferred (required on Claude-written notes)
review: needed       # present only while a note awaits human review
review_reason: ""
```

Type-specific fields:
- **decision:** `decided_on`, `supersedes`, `superseded_by`, `project`
- **work:** `project`, `ticket`, `last_checkpoint`
- **source:** `source_id`, `dedupe_key`, `url`, `captured_at`, `captured_by` (manual or watcher; only manual exists in v1), `why`, `linked_to`

**Body sections** are fixed headings, so edits can target a single section:
- **anchor:** Summary (dated current truth) · Facts · Known issues · Decisions · Open work
- **project:** Goal · Status · History
- **work:** Summary · Checkpoints · Open items (listed verbatim) · Outcome
- **decision:** Context · Decision · Consequences
- **source:** the captured content

**Obsidian views** are shipped by `kiln init` as Bases files:

| View | Shows |
|---|---|
| **Inbox** | sources with `triage: pending` |
| **Needs review** | notes with `review: needed` |
| **Active work** | work items by status |
| **Decisions** | active, proposed and superseded decisions by anchor |

## 5. MCP tools

**Read**

| Tool | Purpose |
|---|---|
| `resolve(name)` | Name or alias → anchor plus brief. The first step for most questions |
| `query(type?, kind?, status?, anchors?, project?, review?, updated_after?)` | Structured filters |
| `search(q, variants?[], scope_anchors?[])` | Field-weighted BM25 (title > aliases > summary > keywords > body) with type and status boosts (anchors and active decisions up, superseded down). Searches within `scope_anchors` first, then globally |
| `brief(id)` | Capped summary of an anchor or project: current truth, active decisions, open work |
| `get(id \| path)` | Full note plus `revision` (sha256 of the bytes) |
| `inbox()` | Pending sources |

**Write.** These are the only way Claude writes notes; the write guard enforces it.

| Tool | Purpose |
|---|---|
| `capture(kind, title, content, url?, source_id?, why?)` | Create a `source` note in the inbox. `dedupe_key` = `kind:source_id` when given. A repeat capture updates the existing source instead of duplicating it |
| `create_note(type, kind?, fields, sections)` | Create a knowledge note in its conventional folder |
| `update_note(id, if_revision, set?, sections?)` | Change fields and/or append to or replace named sections |
| `supersede(old_id, if_revision, new_decision)` | Create the new decision, mark the old one `superseded` (both directions), and set `review: needed` on the new one. Two files under one lock: if the second write fails, the first is reverted |
| `mark_source(id, if_revision, triage, linked_to?)` | Record the triage outcome on a capture |

**Write rules**
1. **Validated** against the schema. Errors name the field and how to fix it, and nothing is written.
2. **Duplicate check on create.** A matching `dedupe_key`, overlapping `sources`, or a near-identical title of the same type returns a `conflict` naming the existing note. Claude updates that note instead, or retries with `new_reason`.
3. **Revision guard.** A stale `if_revision` returns a `conflict`, so a hand edit is never overwritten.
4. **Byte-preserving.**
   - Frontmatter is patched as text: only the targeted keys change, in their existing style.
   - Section edits touch only that section.
   - Line endings and untouched bytes are preserved.
5. **Atomic per file.** Each write goes to a temp file and is then renamed into place. A locked file gets a short retry, then a clear error.
6. **No deletes.** Notes are archived through `status`, and sources are dismissed.
7. **Review flag policy.**
   - Claude sets `review: needed` (with a reason) on anything it writes with medium or low confidence.
   - `supersede` always sets it.
   - Everything is written immediately; the flag is how you find what to check.

**Admin:** `validate()` checks schema problems, broken links, notes missing a summary or aliases, and likely duplicates. It reports only and fixes nothing.

## 6. Retrieval

The `recall` skill follows this order, which held up at 100k notes in spike B1:
1. `resolve` names in the question to anchors, then `brief`.
2. Structured follow-up on those anchors: active decisions, open work, recent changes.
3. `search` with 2-4 rephrasings, scoped to those anchors first, then global.
4. Read the top hits with `get`, falling back to grep only if needed.
5. Live connector reads, only for current external status.

The answer cites `[[links]]` to the notes it used.

**Enrichment at write time:** notes Claude creates must include `summary` and `aliases`. This targets the remaining weakness at scale: questions that match no anchor name.

**Index tables**

| Table | Contents |
|---|---|
| `files` | path, size, mtime, hash, id |
| `notes` | frontmatter columns |
| `links` | frontmatter and body links |
| `aliases` | titles and aliases |
| `fts` | contentless FTS5 (porter unicode61) over title, aliases, summary, keywords and body; snippets are read from the files |

**Multiple bases:** one index per base. A search covers one base unless `base=all`.

## 7. Claude Code plugin

The plugin lives in this repo and is installed at user scope. It provides the `kiln mcp` registration, four skills and two hooks.

| Skill | Behaviour |
|---|---|
| `capture` | Capture text or a link, or **an external item by reference**: a Jira key, a Slack thread link, a GitHub PR, an email or a meeting. Claude fetches the content through its existing connectors and calls `capture`. It can triage immediately |
| `triage` | Works through the inbox in batches. For each item it decides: dismiss, link-to-anchor, update-work-item, new-work-item, new-decision/supersede, new-reference or duplicate-of. Then it **files it**: updates or creates notes (with summary, aliases, sources and confidence), supersedes decisions where needed, and records the outcome with `mark_source`. Uncertain items get `review: needed` |
| `recall` | The retrieval order in §6; answers with `[[links]]` |
| `review` | Walks the **Needs review** items (and suggested duplicate merges from `validate`). For each one you confirm, edit or revert, and the flag is cleared |

**Hooks**
1. **Write guard:** blocks Claude's direct Write/Edit to files inside any configured base, so all writes go through kiln tools. Your own edits in Obsidian are unaffected.
2. **Session orientation:** at session start, one line, e.g. `kiln: base=work · inbox 6 · needs review 3`.

**Expected cost** (spike B3): about 2.7k tokens per routing-only capture and about 5.5k per capture that changes knowledge.

## 8. Error handling

| Situation | Behaviour |
|---|---|
| Validation failure | Error naming the field and the fix; nothing written |
| Stale revision | `conflict`; Claude re-reads and redoes its change |
| Possible duplicate | `conflict` naming the existing note |
| Another session is writing | Wait on the write lock (busy timeout), then a clear `busy` error |
| File locked by Obsidian, Defender or sync | Short retries, then a clear error; never a half-written file |
| Crash mid-write | Temp file + rename means the file is either old or new, never partial. A reverted second write in `supersede` keeps the pair consistent |
| Index corrupt or schema changed | Automatic rebuild |
| Hand edit breaks the schema | Reported by `validate`; never auto-fixed |
| kiln MCP unavailable | Skills fall back to read-only grep over the vault and say so; no writes |

## 9. Testing

**Data policy:** no real knowledge in the repo or tests. Realistic material is **generated** and then frozen.

**Generated fixtures** (`tests/fixtures/`):
- about **100 notes** for a fictional organisation (clients, people, services, projects, meetings, tickets, decisions)
- about **20 golden questions** with answer keys, across exact-term, vocabulary mismatch, decision/temporal, multi-hop and status
- **one simulated day** of about 12 captures, with an answer key

**Unit tests (TDD)**
- the byte-preserving frontmatter patcher, against tricky files: comments, flow and block lists, quoting styles, CRLF and LF. Each test asserts that only the targeted lines change.
- section edits, schema validation, folder placement, duplicate detection, the revision guard, and `supersede` pairing with rollback

**Integration tests**
- the MCP server against a temp base
- two server processes writing concurrently: no corruption, stale writes rejected
- re-check after external edits, moves and renames

**Retrieval regression:** the golden set, with per-category minimum recall@5 and MRR set when the fixtures are frozen.

**Scale check** (manual, before releases): a generator expands the fixture corpus to 100k notes and measures index build, re-check time and query p95.

**Skill check:** `triage` on the simulated day against its answer key.

## 10. Acceptance criteria

1. From any folder, a Claude session can capture (including Jira, Slack and GitHub items by reference), triage, recall and review against the correct base, with no setup per session.
2. All Claude writes go through kiln tools; the write guard blocks direct edits.
3. Patcher tests prove untouched bytes are preserved.
4. Concurrent writes from two sessions never corrupt notes or the index, and stale writes are rejected.
5. The golden set meets its per-category thresholds.
6. At 100k generated notes: cold index build under 60 s, re-check under 2 s, p95 ranked query under 300 ms.
7. `triage` scores ≥ 90% outcome accuracy on the simulated day.
8. The Inbox, Needs review, Active work and Decisions views work in Obsidian on a fresh `kiln init` base.

## 11. Deferred (future list)

- **Feeders** (sub-project 2): n8n and watchers for automated capture, `captured_by: watcher`, inbox expiry for watcher captures after 14 days, snapshot refresh and staleness.
- **An always-on server with an HTTP API** for n8n and Obsidian plugins. When it arrives: `@parcel/watcher` hint events plus periodic reconcile, start at logon, and bearer-token auth.
- **Git integration**: one commit per knowledge change plus hourly maintenance commits; an operational event log in `.kiln/log/`, untracked and rotated monthly.
- **Automatic `id` insertion and link repair** for notes moved outside Obsidian.
- **A `resume` dashboard** and a separate `distil` skill (sub-project 3 workspace close-out).
- **Obsidian cockpit plugins** (sub-project 4) and **migration** of the old vault (sub-project 5).
- **Vector search** (bge-small q8, ONNX in Node, 16 threads), only if the golden set shows persistent vocabulary-mismatch misses.
- **Hosting:** Docker and WSL.
- **New page types:** a daily scratchpad page, and roadmap views.
- **A temporal decision layer**, e.g. Graphiti-style.
- **Ideas borrowed from prior art:** standing queries, rolling thread summaries, MCP resources as instructions, a ready/next query.

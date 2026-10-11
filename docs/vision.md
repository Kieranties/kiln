# kiln vision

Status: **current direction, still exploring** (2026-10-11). Nothing here is final.

This replaces the 2026-10-10 vision, which is in git history. The engine it led to (an MCP server, a SQLite index, a CLI and Claude Code plugin) was released as v0.1.1 and removed in 0.2; it remains in git history. See [What v1 taught us](#what-v1-taught-us).

## Problem

Work has been done ad hoc, so nothing accumulates in one place. A knowledge vault exists but Claude cannot readily reach it from where work happens, so knowledge neither goes in nor comes out. Runs, investigations and decisions leave no trace once a session ends.

## What kiln is

kiln is **my process for knowledge and work, built on Obsidian**: a vault structure that reads well, the workflows that keep it current, and Claude skills that follow the same process.

Obsidian first. Then Claude. Then everything else.

## Principles

- **P1 Written for a reader.** Every note is shaped for a person reading it in Obsidian. Fields that exist for search or tooling must not hurt readability.
- **P2 Obsidian is home.** Structure, views and workflows are designed in Obsidian. Claude follows the same structure rather than having its own.
- **P3 Plain files, reachable from anywhere.** The vault is markdown on disk, and any Claude session in any folder can reach it. Ideally without Obsidian running, but that is not yet a requirement: if an Obsidian MCP proves the right way to work with the vault, it may need Obsidian open.
- **P4 My process, not a generic one.** Reuse Obsidian's core features and community plugins where they fit the process. Build kiln's own where the process needs it.
- **P5 Configuration first, code when it earns its place.** Start as a vault kit: types and kinds, templates, Bases views, CSS snippets and a few community plugins. Grow a kiln Obsidian plugin as gaps appear. Custom views (inbox, project, board) and icon and styling rules are the expected first gaps.
- **P6 Easy to extend.** Adding a type or kind is cheap for me and for Claude, and it arrives with its template, icon, styling and views.
- **P7 One inbox.** Everything comes in one way and is triaged in one place.
- **P8 Remote truth, selective local context.** External systems own their data. Only what I engage with is held locally, as a summary. Writes out are explicit and approved.

## Layers

Built in this order. Each layer is usable on its own.

| Layer | What it is | Flows |
|---|---|---|
| 1. **Structure** | Types and kinds, folders, templates, properties, Bases views, icons and styling. Entities that are easy to find and read in Obsidian | Note shapes, Browse, Add a type or kind |
| 2. **Workflows** | How I work with those entities: inbox and capture, triage, the daily log, meetings, research | Capture, Triage, Daily rhythm, Meeting, Research |
| 3. **Claude** | Skills that teach Claude the structure and the workflows, plus existing Obsidian skills or an Obsidian MCP where they help | Ask, Start work, Work and checkpoint |
| 4. **Further** | Close-out, refresh, scheduling, Herdr workspaces, feeders | Close-out, Follow up and refresh |

The flows and the agreed story order are in [kiln user flows](specs/2026-10-11-user-flows.md).

## Entities, types and kinds

Everything in the vault is an **entity**: one note about one thing. Every entity has a **type**, and may have a **kind** within that type:

- **Type** is the top level: `work`, `organisation`, `reference`, `person`.
- **Kind** narrows a type: work is a `bug` or a `feature`, an organisation is a `client` or a `vendor`.

The type decides the template, properties, icon, styling and views. A kind can override any of them, such as a bug icon on bug work items. Views filter on either level. Types and kinds are cheap to add (P6). The starting set is settled in layer 1.

Types differ in how long their entities live:

| Lifespan | Example types |
|---|---|
| **Persists** | organisation, product, topic, person |
| **Ends** | project, work |
| **A moment** | meeting, daily, decision |

This replaces v1's "anchors": persisting is a trait of a type, not a separate tier.

## Work model

```
Persisting entities  <-  Project  <-  Work item  <-  Workspace  <-  Worktree
(product, topic,         (finite,     (the what)     (the where,    (one repo
 person, ...)             optional)                   ephemeral)     checkout)
```

- **If it ends, it is a project. If it persists, it is a persisting type.** The Fan App is a product. Fan App v1 and v2 are projects that distil onto it.
- **The ticket is the team's record; the work item is mine.**
- **Workspaces and worktrees are where work runs** (Herdr, git). They are not entities; the work item records them.
- **Work distils upward when it closes:** worktree, then workspace, then work item, then project, then onto the persisting entities.

## Search

- **Me:** Obsidian's search, the quick switcher (which matches aliases) and Bases views.
- **Claude:** reading the vault, directly or through an Obsidian MCP, guided by skills that know its structure.

Readable `summary`, `aliases` and `keywords` properties help both. Dedicated search is revisited only when real use shows misses.

## What v1 taught us

KB core v1 (2026-10-10 to 2026-10-11) built a deterministic engine before the experience: validated writes through MCP tools, a SQLite full-text index with weighted ranking, retrieval quality gates and a 100k-note scale target. Used on a real base, it showed:

- **Notes were shaped for the machine.** Heavy frontmatter, no title heading, related items visible only to Claude through `brief`.
- **Search was solving a problem not yet had.** About 900 notes in practice, not 100k, and nothing showed kiln's search beating Claude reading the files.
- **Obsidian came last** (sub-project 4 of 5), so nothing pushed back on readability.

Kept from v1: markdown as the truth, one inbox, capture by reference, triage outcomes, archive rather than delete, fictional test data (Northwind Arena), and the public-repo rule.

Reversed: "Obsidian is a viewer and never required", "Claude writes only through kiln tools", anchor-first ranked search, the 100k scale target and the retrieval stop conditions.

## Open

- **Checking Claude's writes.** v1 validated every write. The replacement is skills plus a check, either a command or inside Obsidian. Decided in layer 3.
- **How Claude reaches the vault.** Plain file reads and writes, an Obsidian MCP, or both. This decides whether Obsidian must be running. Decided in layer 3.

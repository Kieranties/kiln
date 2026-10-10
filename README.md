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

## Claude Code plugin

The plugin in `plugin/` (marketplace manifest in `.claude-plugin/`) registers the `kiln mcp` server, the capture, triage, recall and review skills, and two hooks: a write guard on Write/Edit/MultiEdit/NotebookEdit and a session orientation line. Both the hooks and the MCP server run the `kiln` binary on your PATH (installed with `npm link`).

**Rebuild and relink together.** The plugin and the linked binary must match. After pulling or changing kiln, run `npm run build && npm link` and update the plugin in the same step. If the hooks call a `kiln` that lacks a command they expect, they fail. A mismatched binary can block every Write and Edit: an older binary without the `hook` command exits with code 2, which Claude Code treats as "block this tool call".

## Docs

- [Vision](docs/vision.md): the model, architecture and flow (current direction)
- [KB core spec (lean v1)](docs/specs/2026-10-10-kb-core-design.md) and [implementation plan](docs/plans/2026-10-10-kb-core-v1.md)
- [Decision log](docs/context/2026-10-10-decision-log.md) and [research](docs/research/)

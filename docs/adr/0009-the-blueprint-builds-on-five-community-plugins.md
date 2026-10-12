---
status: accepted
---

# The blueprint builds on five community plugins

The blueprint is configuration over community plugins, not kiln code: **Iconic** for icons, **Templater** for templates, **QuickAdd** for capture and the owner's commands, **Homepage** to open on `Home.md`, and **Claudian** to reach Claude while reading. All five are required: setup stops until they are installed, and offers to install them through the Obsidian CLI. The blueprint ships their settings, not their code, and `requires.json` holds the oldest version of each it is written for. A kiln Obsidian plugin is written only for what these can't do.

## Consequences

- **Claudian is the one Obsidian staff haven't reviewed,** and it runs Claude Code with the vault as its working folder. Setup's consent names it, and its "Load user Claude Code settings" switch must stay on for the Claude plugin to load there ([ADR 0005](0005-one-user-scope-claude-plugin-with-bundled-scripts.md)).
- Raise a minimum version only when kiln depends on something newer.

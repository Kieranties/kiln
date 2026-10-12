---
status: accepted
---

# Claude reaches the vault through plain files and the Obsidian CLI, with no MCP server

Claude reads and edits notes as plain files. Anything Obsidian does better goes through the official Obsidian CLI: renames and moves (Obsidian rewrites every link), search, backlinks and Bases queries. None of the Obsidian MCP servers ran kiln's templates, and the CLI gives their other features with no plugin, API key or certificate, so there is no MCP server. A trial in a vault with the sample (T2, #80) confirmed renames and Bases queries through the CLI.

## Consequences

- The CLI needs Obsidian running. It doesn't reliably start Obsidian on Windows, so the vault rules open the vault by its `obsidian://` link and retry while it loads.
- Setup and adding a type write settings Obsidian reads only at start-up, so they run with Obsidian closed and never call the CLI while they write.
- How Claude creates a note is [ADR 0003](0003-claude-creates-notes-with-obsidian-create.md).

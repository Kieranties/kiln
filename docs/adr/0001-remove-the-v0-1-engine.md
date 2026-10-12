---
status: accepted
---

# Remove the v0.1 engine; Obsidian first

kiln 0.1 was a knowledge-base engine: validated writes through MCP tools, a SQLite full-text index and a CLI, built for 100k notes before anything was read in Obsidian. Used on a real vault of about 900 notes, it shaped notes for the machine (heavy frontmatter, no title heading, links only Claude could see), and nothing showed its search beating Claude reading the files. So 0.2 removed it and started again from Obsidian: notes are shaped for a person reading them, Obsidian's own features and community plugins come first, and kiln code is written only when the process needs it. The engine is in git history and the `v0.1.1` tag.

## Consequences

- Kept from 0.1: Markdown as the truth, one inbox, archive rather than delete, the fictional Northwind Arena test data, and the public-repo rule.
- Reversed: "Obsidian is a viewer and never required", "Claude writes only through kiln tools", ranked search and the scale target. Don't bring back a search index or an MCP server without evidence from real use that reading the files falls short.

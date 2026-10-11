# The kiln kit

The kit is kiln's vault structure for Obsidian: what kinds of notes exist, how each one looks, and how they link. It is configuration, not code. The design is in [Layer 1: structure](../docs/specs/2026-10-11-layer-1-structure-design.md).

## What the kit is

| Folder | Holds | Goes to |
|---|---|---|
| `types/` | One **definition** per type: its folder, icon, colour, statuses, properties, kinds, sections and related views. The single source of truth | `_kiln/types/` in the vault |
| `templates/` | One Templater template per type, written from its definition | `_kiln/templates/` |
| `views/` | Bases views: each type's related views, and the inbox, review, project and today views | `_kiln/views/` |
| `root/` | `Home.md` and `Board.base` | The vault root |
| `settings/` | Obsidian and plugin settings, as fragments to merge | `.obsidian/` |

`tests/kit/` checks every kit file against the definitions: `npx vitest run tests/kit`.

## Conventions

- **Every note is an entity** with a `type`, and optionally a `kind` within it.
- **No title heading.** Obsidian's inline title shows the file name.
- **File names are the title.** Things that persist or end use their name (`Fan App.md`). Moments start with the date (`2026-10-11.md`, `2026-10-11 Club Console standup.md`). References use the source's own title.
- **File names stay linkable.** Replace `#`, `^`, `[`, `]` and `|` with a space, and `/`, `\` and `:` with `-`, then collapse repeated spaces. `northwind-arena/club-console#88` becomes `northwind-arena-club-console 88`.
- **Relationships point up the chain,** and views show the reverse. A work item lists its `projects`; the project's Board view lists its work.
- **Relationships are always lists of links,** even with one entry: `projects: ["[[Season Ticket Renewals 2027]]"]`.
- **Dates** are `YYYY-MM-DD`; date-times are `YYYY-MM-DDTHH:mm`.
- **Log lines** in a daily note are `- HH:mm text`, appended to the end of the file. `## Log` is always the last section.
- **Archive, never delete.** A note is retired through its `status`.

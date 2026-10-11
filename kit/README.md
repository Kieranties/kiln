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

## Setting up a vault

The steps for whoever applies the kit, usually Claude. `<vault>` is the vault folder. For the owner's walk-through, see [Getting started](GETTING-STARTED.md).

1. **Check the plugins are installed and Obsidian is closed.** `<vault>/.obsidian/plugins/` has `iconic`, `templater-obsidian`, `quickadd` and `homepage`. Obsidian must be closed, because QuickAdd and Homepage read their settings only at start-up.
2. **Create the type folders** in `<vault>`: the `folder` of every definition in `types/`.
3. **Copy the kit in.** `types/`, `templates/` and `views/` go to `<vault>/_kiln/` under the same names, with this README and `GETTING-STARTED.md`. Everything in `root/` goes to `<vault>/`.
4. **Merge each settings fragment.** Keep every setting the vault already has unless the rule says otherwise. When a target file is missing, write the fragment as it is.

   | Fragment | Target in `<vault>/.obsidian/` | Rule |
   |---|---|---|
   | `app.json` | `app.json` | Set each key; add `_kiln/` to `userIgnoreFilters` |
   | `types.json` | `types.json` | Set each entry under `types` |
   | `daily-notes.json` | `daily-notes.json` | Set each key |
   | `core-plugins.json` | `core-plugins.json` | Set each key |
   | `community-plugins.json` | `community-plugins.json` | Add the four ids that are missing |
   | `plugins/iconic.json` | `plugins/iconic/data.json` | Remove `fileRules` entries whose `id` starts with `kiln-`, then put the kit's rules first, so they win over older rules |
   | `plugins/templater.json` | `plugins/templater-obsidian/data.json` | Set `templates_folder` and `trigger_on_file_creation_mode`; replace `folder_templates` entries for the kit's folders and keep the rest |
   | `plugins/quickadd.json` | `plugins/quickadd/data.json` | Remove `choices` entries whose `id` starts with `kiln-`, then add the kit's |
   | `plugins/homepage.json` | `plugins/homepage/data.json` | Set `homepages["Main Homepage"]` and `version` |

5. **Report** each file copied and each setting changed.
6. **Open Obsidian and check** with the list in [Getting started](GETTING-STARTED.md).

## Adding or changing a type

1. Add or edit the definition in `types/`. Its body says what the type is for and when to use it.
2. Update what is written from it: the template in `templates/`, a Base in `views/` for each view (`<type>-<view>.base`), the type's Iconic rules in `settings/plugins/iconic.json`, its folder in `settings/plugins/templater.json`, and its properties in `settings/types.json`.
3. Run `npx vitest run tests/kit` until it passes. The tests name anything that is out of step.
4. Copy the changed files into the vault and merge the changed settings, as in "Setting up a vault". Iconic and Templater pick up their settings with Obsidian open; templates and views are plain files. Only QuickAdd and Homepage changes need Obsidian closed.

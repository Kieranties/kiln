# The kiln kit

**New here? Follow [Getting started](GETTING-STARTED.md)** to set up your vault from an empty folder. To see the whole kit working first, [try the sample](TRY-THE-SAMPLE.md) in a trial vault.

The kit is kiln's vault structure for Obsidian: what kinds of notes exist, how each one looks, and how they link. It is configuration, not code. The design is in [Layer 1: structure](../docs/specs/2026-10-11-layer-1-structure-design.md).

The kit is also the **kiln plugin for Claude Code**: its skill applies the kit to a vault from any Claude session, with no clone of the repo. See [The kiln plugin](#the-kiln-plugin).

## What the kit is

| Folder | Holds | Goes to |
|---|---|---|
| `types/` | One **definition** per type: its folder, icon, colour, statuses, properties, kinds, sections and related views. The single source of truth | `_kiln/types/` in the vault |
| `properties.md` | Every property, with its icon. A relationship takes the icon and colour of the type it links to | `_kiln/properties.md` |
| `templates/` | One Templater template per type, written from its definition | `_kiln/templates/` |
| `views/` | Bases views: each type's related views, and the inbox, review, project and today views | `_kiln/views/` |
| `root/` | `Home.md` and `Board.base` | The vault root |
| `settings/` | Obsidian and plugin settings, as fragments to merge | `.obsidian/` |
| `.claude-plugin/`, `skills/` | The kiln plugin for Claude Code: its manifest and the `apply-kit` skill | Nowhere: they stay in the plugin |

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

The steps for whoever applies the kit, usually Claude through the kiln plugin's `apply-kit` skill. `<vault>` is the vault folder, and every kit path below is in the kit folder (the plugin's folder, or `kit/` in a clone). For the owner's walk-through, see [Getting started](GETTING-STARTED.md).

1. **Check the plugins are installed and Obsidian is closed.** `<vault>/.obsidian/plugins/` has `iconic`, `templater-obsidian`, `quickadd` and `homepage`. Obsidian must be closed, because QuickAdd and Homepage read their settings only at start-up. Confirm with the owner that they turned on **Trigger Templater on new file creation** in Templater's settings: Templater keeps that switch per device in Obsidian's local storage, so no settings file can set it, and without it no folder template runs.
2. **Create the type folders** in `<vault>`: the `folder` of every definition in `types/`.
3. **Copy the kit in.** `types/`, `templates/` and `views/` go to `<vault>/_kiln/` under the same names, with `properties.md`, this README, `GETTING-STARTED.md` and `TRY-THE-SAMPLE.md`. Everything in `root/` goes to `<vault>/`. Nothing else is copied: `.claude-plugin/` and `skills/` are the plugin. The sample notes in `tests/fixtures/layer1` are copied only when asked for (see `TRY-THE-SAMPLE.md`).
4. **Merge each settings fragment.** Keep every setting the vault already has unless the rule says otherwise. When a target file is missing, write the fragment as it is.

   | Fragment | Target in `<vault>/.obsidian/` | Rule |
   |---|---|---|
   | `app.json` | `app.json` | Set each key; add `_kiln/` to `userIgnoreFilters` |
   | `types.json` | `types.json` | Set each entry under `types` |
   | `daily-notes.json` | `daily-notes.json` | Set each key |
   | `core-plugins.json` | `core-plugins.json` | Set each key |
   | `community-plugins.json` | `community-plugins.json` | Add the four ids that are missing |
   | `snippets/kiln.css` | `snippets/kiln.css` | Copy the file. It shows property names, values and board columns with capitals; notes stay lowercase |
   | `appearance.json` | `appearance.json` | Add `kiln` to `enabledCssSnippets` |
   | `plugins/iconic.json` | `plugins/iconic/data.json` | Set `showAllFileIcons`, `showAllFolderIcons` and `minimalFolderIcons` (folder icons replace the folder arrows). Set the `fileIcons` entries for the kit's folders, `_kiln`, `Home.md` and `Board.base`, and the `propertyIcons` entries for the properties in `properties.md`, keeping the rest. Remove `fileRules` entries whose `id` starts with `kiln-`, then put the kit's rules first, so they win over older rules |
   | `plugins/templater.json` | `plugins/templater-obsidian/data.json` | Set `templates_folder` and `trigger_on_file_creation_mode`; replace `folder_templates` entries for the kit's folders and keep the rest |
   | `plugins/quickadd.json` | `plugins/quickadd/data.json` | Remove `choices` entries whose `id` starts with `kiln-`, then add the kit's |
   | `plugins/homepage.json` | `plugins/homepage/data.json` | Set `homepages["Main Homepage"]` and `version` |

5. **Put file properties in the right sidebar.** Notes keep properties out of the text, so the file properties view must be open. In `<vault>/.obsidian/workspace.json`:
   - If any leaf under `right` already has `state.type` `file-properties`, make it the visible tab: set its `tabs` group's `currentTab` to its index.
   - Otherwise add the leaf in `settings/workspace-file-properties.json` to the end of the first `tabs` group under `right`, and set that group's `currentTab` to its index. If `right` has no `tabs` group, add `{ "id": <16 hex digits>, "type": "tabs", "children": [<the leaf>], "currentTab": 0 }` to `right.children`.
   - If `right` has `"collapsed": true`, set it to `false`. Change nothing else; Obsidian owns the rest of this file.
   - If `workspace.json` does not exist yet, skip this step. Obsidian creates it on first start, and Getting started has the fallback.
6. **Report** each file copied and each setting changed.
7. **Open Obsidian and check** with the list in [Getting started](GETTING-STARTED.md).

## Adding or changing a type

1. Add or edit the definition in `types/`. Its body says what the type is for and when to use it.
2. Update what is written from it:
   - the template in `templates/`;
   - a Base in `views/` for each view (`<type>-<view>.base`);
   - the type's Iconic rules in `settings/plugins/iconic.json`, kind rules before the type rule;
   - its folder and template in `settings/plugins/templater.json`;
   - its properties in `settings/types.json`;
   - any new property in `properties.md` (an icon, or the type it links to) and in `propertyIcons` in `settings/plugins/iconic.json`.
3. Update the tests, which pin the starting set:
   - `tests/kit/definitions.test.ts`: the type list and the folder, status, kind, property and section tables;
   - `tests/fixtures/layer1`: add an example note of the new type in its folder, since every type needs one.
4. Run `npx vitest run tests/kit` until it passes. The tests name anything that is out of step.
5. In the vault, create the type's folder, copy the changed files in and merge the changed settings, as in "Setting up a vault". Iconic and Templater pick up their settings with Obsidian open; templates and views are plain files. Only QuickAdd and Homepage changes need Obsidian closed. The plugin's skill does this step: "Re-apply the kiln kit to `<vault folder>`", naming the kit folder in your clone if the change is not merged yet.

## The kiln plugin

The kit is a Claude Code plugin, so any Claude session can apply it without a clone of the repo. The plugin's folder is this kit folder: `.claude-plugin/plugin.json` is its manifest and `skills/apply-kit/` its one skill. The repo's `.claude-plugin/marketplace.json` lists it. Design: [The kiln plugin](../docs/specs/2026-10-11-kit-plugin-design.md).

**Install it** once per machine. The commands work in both Bash and PowerShell:

```bash
claude plugin marketplace add Kieranties/kiln --sparse .claude-plugin kit
claude plugin install kiln@kiln
```

`--sparse` checks out only the marketplace and the kit, not the whole repo. Without it, adding the marketplace can fail on Windows with `EPERM: operation not permitted, rename`.

**Keep it up to date.** The plugin has no version number, so each commit to `main` is a new version. Claude Code updates it only when auto-update is on for the marketplace, which is off by default: run `/plugin`, open **Marketplaces**, choose **kiln** and select **Enable auto-update**. To update by hand:

```bash
claude plugin marketplace update kiln
claude plugin update kiln@kiln
```

Then ask Claude to re-apply the kit to your vault.

**Use it** by asking in plain words, from any folder:

| Ask | What the skill does |
|---|---|
| "Set up the kiln kit in `D:\notes`" | "Setting up a vault" |
| "Re-apply the kiln kit to `D:\notes`" | "Adding or changing a type", step 5: copies in what changed and merges the settings again |
| "Set up the kiln kit in `D:\tmp\kiln-sample` with the Northwind Arena sample" | Sets up a trial vault and adds the sample ([Try the sample](TRY-THE-SAMPLE.md)) |

`/kiln:apply-kit` runs the skill by name.

**Try an unmerged kit** from a kiln clone or worktree, for one session, by loading its kit folder as the plugin:

```bash
claude --plugin-dir <clone>/kit
```

Or add the marketplace from a branch: remove the `kiln` marketplace, then add `Kieranties/kiln#<branch>` with the same `--sparse` paths. Add it back from `Kieranties/kiln` to return to `main`.

**Coming from kiln 0.1?** Its marketplace checked out `.claude-plugin` and `plugin`, which no longer hold the plugin. Remove it with `claude plugin marketplace remove kiln`, then install as above.

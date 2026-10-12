# The kiln blueprint

**New here? Follow [Getting started](GETTING-STARTED.md)** to set up your vault from an empty folder. To see the whole blueprint working first, [try the sample](TRY-THE-SAMPLE.md) in a trial vault.

The blueprint is kiln's vault structure for Obsidian: what kinds of notes exist, how each one looks, and how they link. It is configuration, not code. The design is in [Layer 1: structure](https://github.com/Kieranties/kiln/blob/main/docs/specs/2026-10-11-layer-1-structure-design.md).

## What the blueprint is

| Folder | Holds | Goes to |
|---|---|---|
| `types/` | One **definition** per type: its folder, naming rule, icon, colour, statuses, properties, kinds, sections and related views. The single source of truth | `_kiln/types/` in the vault |
| `properties.md` | Every property, with its icon, and the lists of shared and optional properties. A relationship takes the icon and colour of the type it links to | `_kiln/properties.md` |
| `templates/` | One Templater template per type, written from its definition | `_kiln/templates/` |
| `views/` | Bases views: each type's related views, and the inbox, review, project and today views | `_kiln/views/` |
| `root/` | `Home.md` and `Board.base` | The vault root |
| `settings/` | Obsidian and plugin settings, as fragments to merge | `.obsidian/` |
| `requires.json` | The oldest Obsidian and plugin versions the blueprint is written for. Setup warns when a plugin is older | Read by setup; not copied |

In the kiln repo, `tests/kit/` checks every blueprint file against the definitions: `npx vitest run tests/kit`.

## Conventions

- **Every note is an entity** with a `type`, and optionally a `kind` within it.
- **No title heading.** Obsidian's inline title shows the file name.
- **File names are the title.** Things that persist or end use their name (`Fan App.md`). Moments start with the date (`2026-10-11.md`, `2026-10-11 Club Console standup.md`). References use the source's own title.
- **File names stay linkable.** Replace `#`, `^`, `[`, `]` and `|` with a space, and `/`, `\` and `:` with `-`, then collapse repeated spaces. `northwind-arena/club-console#88` becomes `northwind-arena-club-console 88`.
- **Relationships point up the chain,** and views show the reverse. A work item lists its `projects`; the project's Board view lists its work.
- **Relationships are always lists of links,** even with one entry: `projects: ["[[Season Ticket Renewals 2027]]"]`.
- **Dates** are `YYYY-MM-DD`; date-times are `YYYY-MM-DDTHH:mm`.
- **Log lines** in a daily note are `- HH:mm text`, appended to the end of the file. `## Log` is always the last section.
- **Check notes** with `/kiln:check`. It checks each note against its definition and never changes a note.
- **Claude finds the vault** from any folder. In the vault, or a folder inside it, Claude uses that vault; inside an Obsidian vault that isn't set up for kiln, it stops and offers `/kiln:setup`. Elsewhere it uses `KILN_VAULT`, a vault name or folder for one terminal (`export KILN_VAULT=work` in Bash, `$env:KILN_VAULT = 'work'` in PowerShell), then the default vault in `~/.kiln/config.json`, which setup writes (on Windows, `.kiln` is in your home folder), then the only kiln vault in Obsidian's vault list. If none of those answers, Claude asks.
- **Archive, never delete.** A note is retired through its `status`.

## Setting up a vault

`/kiln:setup` does all of this with a Node helper, from any Claude session, and re-applies the blueprint after an update. These are the steps it follows, and the steps Claude follows by hand when Node isn't installed. `<vault>` is the vault folder. For the owner's walk-through, see [Getting started](GETTING-STARTED.md).

1. **Install the plugins, then check Obsidian is closed.** `<vault>/.obsidian/plugins/` must have `iconic`, `templater-obsidian`, `quickadd`, `homepage` and `realclaudian` (Claudian), each with `manifest.json` and `main.js`, at or above the versions in `requires.json`. If any is missing and the Obsidian CLI is on PATH, offer to install and switch them on through it. Ask first: it turns off restricted mode and downloads community plugin code. Say that Claudian is the one Obsidian staff haven't reviewed, and that it runs Claude Code with the vault as its working folder. The owner opens the vault in Obsidian and keeps it open: the CLI doesn't start Obsidian, and fails with "The CLI is unable to find Obsidian" when it is closed. Opening `obsidian://open?vault=<folder name>` (URI-encoded) starts it on the vault: `rundll32.exe url.dll,FileProtocolHandler '<link>'` in Git Bash, `Start-Process '<link>'` in pwsh. Then try the call again after a few seconds. Right after that launch, a call can still say "unable to find Obsidian", or that a command isn't found, while the vault loads: wait and try again. Name the vault by its folder name, and call `obsidian.com` in Git Bash, `obsidian` in pwsh:

   ```
   obsidian vault='<folder name>' plugins:restrict off
   obsidian vault='<folder name>' plugin:install id='<id>' enable
   ```

   Without the CLI, the owner installs them in Obsidian ([Getting started](GETTING-STARTED.md), section 2). The CLI can't update a plugin: warn about older ones, and ask the owner to update them in Obsidian, under Settings → Community plugins → Check for updates. Then Obsidian must be closed, because QuickAdd and Homepage read their settings only at start-up; with Run in Background installed, that means the tray's Close Vault. Suggest, but don't require, **Trigger Templater on new file creation**: it is kept per device, so no settings file can set it, and it only matters for notes made by hand.
2. **Create the type folders** in `<vault>`: the `folder` of every definition in `types/`.
3. **Copy the blueprint in.** `types/`, `templates/` and `views/` go to `<vault>/_kiln/` under the same names, with `properties.md`, this README, `GETTING-STARTED.md` and `TRY-THE-SAMPLE.md`. Everything in `root/` goes to `<vault>/`. The Northwind Arena sample (`tests/fixtures/layer1` in the kiln repo) is added only when asked for, at the plugin's version (see `TRY-THE-SAMPLE.md`).
4. **Merge each settings fragment.** Keep every setting the vault already has unless the rule says otherwise. When a target file is missing, write the fragment as it is. Before changing a file that is there, copy it to `<vault>/.kiln/backup/<date and time>/`, as for any file setup replaces; a run never reuses an earlier run's backup folder. In a vault already in use, ask before changing the owner's Homepage, new-note folder, new-link format, where properties show in a note (`propertiesInDocument`), daily-note folder, format or template, Templater template folder or folder templates, and property types, and before replacing an existing `Home.md`.

   | Fragment | Target in `<vault>/.obsidian/` | Rule |
   |---|---|---|
   | `app.json` | `app.json` | Set each key; add `_kiln/` to `userIgnoreFilters` |
   | `types.json` | `types.json` | Set each entry under `types` |
   | `daily-notes.json` | `daily-notes.json` | Set each key |
   | `core-plugins.json` | `core-plugins.json` | Set each key |
   | `community-plugins.json` | `community-plugins.json` | Add the five ids that are missing |
   | `snippets/kiln.css` | `snippets/kiln.css` | Copy the file. It shows property names, values and board columns with capitals; notes stay lowercase |
   | `appearance.json` | `appearance.json` | Add `kiln` to `enabledCssSnippets` |
   | `plugins/iconic.json` | `plugins/iconic/data.json` | Set `showAllFileIcons`, `showAllFolderIcons` and `minimalFolderIcons` (folder icons replace the folder arrows). Set the `fileIcons` entries for the blueprint's folders, `_kiln`, `Home.md` and `Board.base`, and the `propertyIcons` entries for the properties in `properties.md`, keeping the rest. Remove `fileRules` entries whose `id` starts with `kiln-`, except those of a type defined only in the vault (`kiln-<type>` or `kiln-<type>-<kind>`) whose id the blueprint doesn't have, then put the blueprint's rules first, so they win over older rules. Name any removed rule the blueprint no longer has |
   | `plugins/templater.json` | `plugins/templater-obsidian/data.json` | Set `templates_folder` and `trigger_on_file_creation_mode`; replace `folder_templates` entries for the blueprint's folders and keep the rest |
   | `plugins/quickadd.json` | `plugins/quickadd/data.json` | Remove `choices` entries whose `id` starts with `kiln-`, at any depth, except those of a type defined only in the vault whose id the blueprint doesn't have. Move the owner's own choices inside a removed one to the top level, never drop them. Then add the blueprint's, then the generated ones below. Name any removed choice the blueprint no longer makes |
   | `plugins/homepage.json` | `plugins/homepage/data.json` | Set `homepages["Main Homepage"]`. When it already opens the same `value` and `kind`, add only the keys it lacks and keep the rest. Set `version` only when it is missing or lower |

### QuickAdd choices and templates per kind

Claude creates notes by running a QuickAdd choice, so every kind has one. They come from the definitions, so nothing in `settings/` lists them.

- **A kind's template** is `_kiln/templates/kinds/<template name> <kind>.md`: the type's template without its first line (the kind picker), with `kind: <% kind %>` replaced by `kind: <kind>`.
- **A kind's choice** has the id `kiln-<type>-<kind>` and the name `New <kind>`, inside a Multi choice `kiln-<type>-menu` named `New <type>`. A type without kinds gets one choice, `kiln-<type>` named `New <type>`, with the type's own template, unless `settings/plugins/quickadd.json` already has that id.
- **Every choice** is a Template choice in the type's folder, not a command, and doesn't open the note. Its file name follows the type's `naming`: `{{VALUE:title}}` for `title` and `source-title`, `{{DATE:YYYY-MM-DD}} {{VALUE:title}}` for `date-title`, `{{DATE:YYYY-MM-DD}}` for `date`. "File exists" keeps the existing file, `"fileExistsBehavior": { "kind": "apply", "mode": "doNothing" }`, so a run never stops to ask.

5. **Put file properties in the right sidebar.** Notes keep properties out of the text, so the file properties view must be open. In `<vault>/.obsidian/workspace.json`:
   - If any leaf under `right` already has `state.type` `file-properties`, make it the visible tab: set its `tabs` group's `currentTab` to its index.
   - Otherwise add the leaf in `settings/workspace-file-properties.json` to the end of the first `tabs` group under `right`, and set that group's `currentTab` to its index. If `right` has no `tabs` group, add `{ "id": <16 hex digits>, "type": "tabs", "children": [<the leaf>], "currentTab": 0 }` to `right.children`.
   - If `right` has `"collapsed": true`, set it to `false`. Change nothing else; Obsidian owns the rest of this file.
   - On a re-apply, only add the leaf when no leaf has `file-properties`. Leave `currentTab` and `collapsed` as the owner left them.
   - If `workspace.json` does not exist yet, skip this step. Obsidian creates it on first start, and Getting started has the fallback.
6. **Record.** Write `<vault>/.kiln/blueprint.json`: the plugin's version, a hash of the blueprint, and a hash of each file installed. Re-applying compares each file three ways: what was installed, what is in the vault and the new blueprint. It updates what only the blueprint changed, keeps the owner's edits, asks when both changed, adds new files, and leaves dropped ones in place. A file it installed that the owner has since deleted stays deleted, and is reported; the owner can ask for it back. Then record the vault in `~/.kiln/config.json`. By hand, skip both: the next `/kiln:setup` treats `_kiln/` as the blueprint's.
7. **Report** each file copied and each setting changed.
8. **Open Obsidian and check** with the list in [Getting started](GETTING-STARTED.md).

## Adding or changing a type

1. Add or edit the definition in `types/`. Its body says what the type is for and when to use it. Set its `naming`: `title`, `date`, `date-title` or `source-title`. `last` names a section that must stay last, as Log does for the daily note.
2. Update what is written from it. QuickAdd choices and kind templates need nothing: setup generates them.
   - the template in `templates/`;
   - a Base in `views/` for each view (`<type>-<view>.base`);
   - the type's Iconic rules in `settings/plugins/iconic.json`, kind rules before the type rule;
   - its folder and template in `settings/plugins/templater.json`;
   - its properties in `settings/types.json`;
   - any new property in `properties.md` (an icon, or the type it links to) and in `propertyIcons` in `settings/plugins/iconic.json`.
3. Update the tests, which pin the starting set:
   - `tests/kit/definitions.test.ts`: the type list; the folder, naming, status, kind, property and section tables; which type keeps a section `last`; and the shared and optional properties in `properties.md`;
   - `tests/fixtures/layer1`: add an example note of the new type in its folder, since every type needs one.
4. Run `npx vitest run tests/kit` until it passes. The tests name anything that is out of step.
5. In the vault, run `/kiln:setup`. An installed plugin carries the blueprint from its own commit, so a local edit reaches the vault only when Claude runs with the plugin loaded from your checkout (`claude --plugin-dir D:/src/kiln/claude-plugin`); otherwise it applies once the change is released and installed with `claude plugin update kiln@kiln`. With Obsidian open it updates `_kiln/`, Iconic and Templater, and the rest waits until Obsidian is closed and setup runs again.

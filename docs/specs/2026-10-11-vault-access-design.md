# Vault access: plain files, the Obsidian CLI and QuickAdd

Status: **decided, exploring** (2026-10-11), waiting on two trials. Nothing here is final.

Part of [Foundation: Claude in the vault](https://github.com/Kieranties/kiln/issues/79), for [#80](https://github.com/Kieranties/kiln/issues/80). It answers the vision's open question of how Claude reaches the vault, and whether Obsidian must be running.

## Decided

### Plain files by default, Obsidian on demand

Claude reads and edits notes as plain files. Anything Obsidian does better goes through the official [Obsidian CLI](https://obsidian.md/help/cli) (app 1.12.7 or later):

| Through the CLI | Why |
|---|---|
| Rename and move | Obsidian rewrites every link to the note, when "Automatically update internal links" is on. A rename on disk while Obsidian is open is seen as a delete plus a create, and links break |
| Search, backlinks, unresolved links | Obsidian's own index |
| Bases queries (`base:query`) | The kit's views, without re-implementing their filters |
| Creating a note | Through QuickAdd (below) |

The CLI needs the app running. If Obsidian is closed, the first command launches it, and that is acceptable for now. (2026-10-12: on Windows, with Obsidian 1.14.4, it doesn't. The call fails with "The CLI is unable to find Obsidian", and skills then ask the owner to open the vault in Obsidian and try again.) Two steps need Obsidian **closed**, so they never call the CLI while they write: setting up a vault and adding a type ([vault setup](2026-10-11-vault-setup-design.md)). Setup calls it only before that, to install the plugins.

In Git Bash, call `obsidian.com`. Bare `obsidian` resolves to `Obsidian.exe`, the app itself, not the command-line wrapper. In pwsh, `obsidian` works.

### No MCP server, for now

None of the current Obsidian MCP servers runs the kit's Templater templates; the one that did is archived. Their other features (search, link-safe moves) are what the CLI now gives directly, with no plugin, API key or certificate. [Obsidian Headless](https://obsidian.md/help/headless) is a standalone client for Sync and Publish only. It doesn't load plugins and has no link index, so it doesn't help here.

### Claude creates notes through QuickAdd

Claude never creates a note by writing a new file. It runs a QuickAdd choice headless:

```
obsidian quickadd:run choice="New bug" vars='{"title":"Renewal email shows the wrong season"}'
```

- **One choice and one template per kind,** generated from the type definitions: New feature, New bug, New client, and so on, grouped in a QuickAdd menu per type. A type without kinds has one choice. No template contains a picker, because a picker opens a modal that a headless run can't answer.
- **Look before you create.** Claude checks the target file doesn't exist before running a choice, and runs `obsidian quickadd:check` first. The kit's choices never use `fileExistsBehavior: prompt`, so an existing file can't leave a run hanging.
- **The same templates serve people.** A type's folder template is its default kind, so a note made by hand in that folder still gets its template, when the owner turns Templater's trigger on.

The previous vault already works this way, which is the main evidence for it.

### Templater stays, and its trigger is optional

The kit keeps Templater for its templates. "Trigger Templater on new file creation" (a per-device switch, off by default) becomes **suggested, not required**:

- With it on, a note made by hand in a type's folder gets that folder's template.
- With it off, nothing changes for Claude, because Claude creates notes through QuickAdd.

What the trigger does to files written from outside, from Templater's source (2.26.0): it handles every new `.md` file while Obsidian has the vault open, whatever wrote it. A note with only frontmatter gets the folder template merged in, and the template's values win. Any other new note is reparsed for `<% %>`, so captured text containing `<%* … %>` runs as code. That is why Claude never writes a new note as a raw file, and why the [note check](2026-10-11-note-check-design.md) treats `<%` in a new note as an error.

Considered and set aside: turning the trigger off for good and moving every template to QuickAdd. It is safer, but folder templates are lost until the kiln Obsidian plugin can fill new notes from their type definitions. Revisit if the trials below go badly.

### Optional per device: Run in Background

The [Run in Background](https://github.com/gabrielbacha/Obsidian-Run-in-background) community plugin keeps Obsidian hidden in the tray, can start it at login, and turns closing or quitting into hiding. CLI calls then reach a running app without a window appearing. It is a recommendation, not one of the kit's required plugins. With it installed, quitting doesn't close Obsidian, so steps that need Obsidian closed say to use the tray's Close Vault.

If it doesn't work on Windows, keeping Obsidian running in the background becomes an early feature of the kiln Obsidian plugin.

### Companion skills

kepano's [Obsidian skills](https://github.com/kepano/obsidian-skills) (`obsidian-cli`, `obsidian-markdown`) are documented as a companion install. kiln's own skills hold kiln's conventions, such as no title heading and relationships as lists of links.

## Trials

To finish #80, run these in a trial vault with the Northwind Arena sample (`claude-plugin/blueprint/TRY-THE-SAMPLE.md`, for example in `D:\tmp\kiln-sample`), with Obsidian 1.12.7 or later.

**T2, QuickAdd and Templater:**

1. With the CLI registered, run a "New bug" choice headless. The note lands in the work folder, with `kind: bug`, the template's sections, and no modal.
2. Run the same choice again. It must not hang.
3. With Templater's trigger on, write a complete new note as a file (frontmatter and body) into a type folder. Confirm Templater leaves it unchanged.
4. Do the same with a frontmatter-only note, and confirm the template is merged in. This is why Claude never does it.
5. Rename a note through the CLI, and confirm every link to it, including links in frontmatter, is updated.
6. Run `base:query` on a kit view and compare the result with the view in Obsidian.

**T4, Run in Background on Windows:**

1. Closing the window and quitting both hide Obsidian to the tray.
2. A CLI call reaches the hidden app, and no window appears.
3. "Start hidden at login" works.
4. Close Vault really closes the vault, and a process check then sees Obsidian closed.

The recommendation moves into the vision once both pass.

## Open

- What earns a log line from Claude in the daily note. This belongs to the Daily rhythm flow.
- Whether QuickAdd's own CLI (`obsidian quickadd:run`) gets an agent skill in kiln, or kepano's `obsidian-cli` skill is enough.

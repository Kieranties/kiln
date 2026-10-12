# Claude in the vault

How Claude reads and changes notes, and how its changes are checked. Every kiln skill follows the same [vault rules](../reference/vault-rules.md). Current direction.

## Plain files, and Obsidian for what it does better

Claude reads and edits notes as plain files. Anything Obsidian does better goes through the official Obsidian CLI, with no MCP server ([ADR 0002](../adr/0002-claude-reaches-the-vault-through-files-and-the-obsidian-cli.md)):

| Through the CLI | Why |
|---|---|
| Rename and move | Obsidian rewrites every link to the note. A rename on disk while Obsidian is open is seen as a delete and a create, and links break |
| Search, backlinks, unresolved links | Obsidian's own index |
| Bases queries | The blueprint's views, without re-implementing their filters |
| Creating a note | So Templater never runs captured text (below) |

The CLI needs Obsidian running, and on Windows it doesn't start it, so the vault rules open the vault by its link and retry while it loads. Setting up a vault and adding a type need Obsidian **closed**, so they never call the CLI while they write. In Git Bash the CLI is `obsidian.com`, because a bare `obsidian` starts the app; in pwsh it is `obsidian`.

## Never a new note as a file

Templater's "Trigger Templater on new file creation" handles every new note while Obsidian has the vault open, whatever wrote it. A note with only properties gets its folder's template merged in, and the template's values win. Any other new note is read for `<% %>`, so captured text containing `<%* … %>` would run as code. So Claude never creates a note by writing a new file, and never writes `<%` anywhere. The trigger is a per-device switch, suggested rather than required: it gives notes made by hand in a type's folder their template, and Claude doesn't need it. [ADR 0003](../adr/0003-claude-creates-notes-with-obsidian-create.md) has how Claude creates notes instead.

## Checking a note after it changes

Notes start in the right shape from their templates, and the blueprint tests check every template against its definition. So the check asks whether **a note is still valid after it changes**, whoever changed it ([ADR 0008](../adr/0008-one-note-check-that-never-writes.md)):

| What changes a note | What can go wrong |
|---|---|
| Claude filling in or editing the body | A section heading removed or renamed; Log lines added without Log staying last |
| Claude editing properties | A status the type doesn't allow; a relationship written as `project: Foo` rather than a list of links |
| Triage converting a capture | The type changes, so the old type's properties are left behind, the new type's are missing, and the note sits in the wrong folder or has the wrong name |
| Captured text | It contains `<%`, which Templater would run |
| Me, or anything that isn't Claude | Hand edits; the board's `+` button making a properties-only note; edited templates in a vault already in use |

Converting a capture is the riskiest change, and it happens through CLI moves, renames and property changes, which a hook after Claude's file writes would never see. So kiln's skills run `kiln-check.mjs` on the notes a flow touched, at the end of the flow, and fix or report what fails; `/kiln:check` covers the whole vault and hand edits. The check reads the vault's own type definitions, so a new type needs no change to it, and it never changes a note.

## Run in Background

The [Run in Background](https://github.com/gabrielbacha/Obsidian-Run-in-background) community plugin keeps Obsidian hidden in the tray, can start it at login, and turns closing into hiding, so CLI calls reach a running app without a window appearing. It is a suggestion, not one of the blueprint's plugins, and it is still being tried on Windows ([#131](https://github.com/Kieranties/kiln/issues/131)). With it installed, quitting doesn't close Obsidian, so steps that need Obsidian closed say to use its tray's Close Vault.

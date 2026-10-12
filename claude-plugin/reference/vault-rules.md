# kiln vault rules

Every kiln skill follows these rules whenever it reads or changes notes in a kiln vault. Nobody runs this file; skills point at it. Commands are the same in Bash and pwsh unless a rule, or the section on calling the Obsidian CLI, says otherwise. `<vault>` is the vault folder from rule 1.

Rules 3 and 4 use the Obsidian CLI and QuickAdd, which wait on trial T2 (https://github.com/Kieranties/kiln/issues/80), so their commands may change. Call every `obsidian` command as "Calling the Obsidian CLI", at the end of this file, says: it differs by shell, and in Git Bash a bare `obsidian` starts the app. If one fails, stop and tell the owner what failed. Never fall back to writing a new note as a file or renaming on disk.

## 1. Find the vault with the resolver

Run it the first time the flow needs the vault. Pass a folder only if the owner named one:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-vault.mjs"
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-vault.mjs" "<folder>"
```

It prints JSON. Exit code 0: `vault` is the vault folder, and `source` says how it was found. Exit code 1: no vault was found. Tell the owner the `reasons`, which may include that the vault they have open isn't set up for kiln. List the `candidates` (each a `path`, with a `name` if the owner recorded one), and ask which vault to use. Offer to record the answer, or to set up the open vault, with `/kiln:setup`, the only writer of `~/.kiln/config.json`; never edit that file yourself. Exit code 2: the arguments were wrong; run it again with only the path (or none).

Without Node 24 (`node --version`), use the current folder if it or a folder above it holds `_kiln/types/`. Otherwise ask the owner.

## 2. Read the type definition before changing a note

Before you write to a note, read `<vault>/_kiln/types/<type>.md` for its `type`, and `<vault>/_kiln/properties.md` before you add a property. They give the folder, naming, kinds, statuses, properties and sections. Use the vault's copies, not the plugin's blueprint: the vault may have types of its own.

Keep to the conventions in `<vault>/_kiln/README.md`, "Conventions". The ones most often missed:

- No title heading. The file name is the title.
- Relationships are always lists of links, even with one entry: `projects: ["[[Season Ticket Renewals 2027]]"]`.
- Change only the properties and sections you mean to.
- Archive, never delete: retire a note through its `status`.
- Leave `_kiln/` and `.obsidian/` alone. Only `/kiln:setup` changes them.

## 3. Create notes through QuickAdd, after checking the file doesn't exist

Never create a note by writing a new file. With Templater's trigger on, Obsidian runs any `<%` in a new file, and merges the template over a file with only properties. (`/kiln:setup` is the one exception: it writes with Obsidian closed.)

1. Work out the note's path from its definition (`folder` and `naming`) and check the file doesn't exist. If it does, use that note, or ask the owner.
2. Run `obsidian quickadd:check`.
3. Find the choice for the type and kind: kiln's choices have ids starting `kiln-` in `<vault>/.obsidian/plugins/quickadd/data.json`. Read that file; don't change it. Pass each `{{VALUE:<name>}}` the choice uses, in its file name format, its template or its format, as a var:

   ```
   obsidian quickadd:run choice="<choice name>" vars='{"<name>":"<value>"}'
   ```

4. Fill in the new note's properties and body as edits to its file, by rule 2.

## 4. Rename and move through the Obsidian CLI

Obsidian then rewrites every link to the note. A rename on disk breaks them. Paths are relative to the vault, with `/`:

```
obsidian rename path="<note path>" name="<new name>"
obsidian move path="<note path>" to="<folder>/"
```

## 5. Never write `<%`

Not in a new note, an existing note or captured text: Templater runs it as code. If text you are saving contains `<%`, leave that part out and tell the owner.

## 6. Run kiln-check on the notes the flow touched

At the end of the flow, check every note it changed. Check the notes it created in a separate run with `--new`. Pass each note's full path, `<vault>/<note path>`: the check reads a shorter path from the current folder.

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" "<note>" "<note>"
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" --new "<new note>"
```

A flow that touched much of the day's work may check `--today "<vault>"` instead. Exit code 0: no errors; report any warnings. Exit code 1: fix each error by these rules (move a note by rule 4), run the check again, and report what you couldn't fix. Without Node 24, check each note against its definition, as `/kiln:check` describes.

## Calling the Obsidian CLI

- In Git Bash, call `obsidian.com`: bare `obsidian` there starts the app. In pwsh, and on macOS and Linux, call `obsidian`.
- Unless rule 1's `source` was `current-folder`, name the vault first: the current folder may not be inside it. Use its folder name, the last part of `vault` (not the `name` in the kiln file): for `D:\notes`, `obsidian vault="notes" quickadd:check`.
- The CLI needs Obsidian running. The first command starts it.

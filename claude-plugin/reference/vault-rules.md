# kiln vault rules

Every kiln skill follows these rules whenever it reads or changes notes in a kiln vault. Nobody runs this file; skills point at it. Commands are the same in Bash and pwsh unless a rule, or the section on calling the Obsidian CLI, says otherwise. `<plugin>` is the Claude plugin's folder, which the skill named in its Follow line, and `<vault>` is the vault folder from rule 1.

Rules 3 and 4 use the Obsidian CLI and QuickAdd, which wait on trial T2 (https://github.com/Kieranties/kiln/issues/80), so their commands may change. Call every `obsidian` command as "Calling the Obsidian CLI", at the end of this file, says: it differs by shell, and in Git Bash a bare `obsidian` starts the app. If one fails, stop and tell the owner what failed, unless Obsidian is closed or still loading: that section says how to open it and try again. Never fall back to writing a new note as a file or renaming on disk.

## 1. Find the vault with the resolver

Run it the first time the flow needs the vault. Pass a folder only if the owner named one:

```
node '<plugin>/scripts/kiln-vault.mjs'
node '<plugin>/scripts/kiln-vault.mjs' '<folder>'
```

It prints JSON. Exit code 0: `vault` is the vault folder, and `source` says how it was found. Exit code 1: no vault was found. Tell the owner the `reasons`, which may include that the vault they have open isn't set up for kiln. List the `candidates` (each a `path`, with a `name` if the owner recorded one), and ask which vault to use. Offer to record the answer, or to set up the open vault, with `/kiln:setup`, the only writer of `~/.kiln/config.json`; never edit that file yourself. Exit code 2: the arguments were wrong; run it again with only the path (or none).

kiln's scripts need Node 24 or later (`node --version`). Without it, stop and tell the owner: `/kiln:setup` offers to install it.

## 2. Read the type definition before changing a note

Before you write to a note, read `<vault>/_kiln/types/<type>.md` for its `type`, and `<vault>/_kiln/properties.md` before you add a property. They give the folder, naming, kinds, statuses, properties and sections. Use the vault's copies, not the Claude plugin's blueprint: the vault may have types of its own.

Keep to the conventions in `<vault>/_kiln/README.md`, "Conventions". The ones most often missed:

- No title heading. The file name is the title.
- Relationships are always lists of links, even with one entry: `projects: ["[[Season Ticket Renewals 2027]]"]`.
- Change only the properties and sections you mean to.
- Archive, never delete: retire a note through its `status`.
- Leave `_kiln/`, `.obsidian/`, `.claude/` and `.claudian/` alone. Only `/kiln:setup` changes `_kiln/` and `.obsidian/`; kiln never writes to `.claude/` or to Claudian's `.claudian/`.

## 3. Create notes through QuickAdd, after checking the file doesn't exist

Never create a note by writing a new file. With Templater's trigger on, Obsidian runs any `<%` in a new file, and merges the template over a file with only properties. (`/kiln:setup` is the one exception: it writes with Obsidian closed.)

1. Name the note by its definition's `naming`, and keep the whole name, date included, linkable by the convention "File names stay linkable": `/`, `\` and `:` become `-`; `#`, `^`, `[`, `]`, `|`, `*`, `?`, `"`, `<`, `>` and control characters become a space; repeated spaces collapse to one; leading dots, and trailing dots and spaces, are stripped; a name longer than 120 characters is cut at the last space that keeps it within them. If nothing is left, or the name is one Windows reserves (`CON`, `NUL` and the rest), ask the owner for another name. Work out its path from the definition's `folder` and that name, directly in the folder, and check the file doesn't exist. If it does, use that note, or ask the owner.
2. Run `obsidian vault='<folder name>' quickadd:check`.
3. Find the choice for the type and kind: kiln's choices have ids starting `kiln-` in `<vault>/.obsidian/plugins/quickadd/data.json`. Read that file; don't change it. Pass each `{{VALUE:<name>}}` the choice uses, in its file name format, its template or its format, as a var. The file name's vars give exactly the name from step 1:

   ```
   obsidian vault='<folder name>' quickadd:run choice='<choice name>' vars='{"<name>":"<value>"}'
   ```

4. Read the new note before you edit it. If it still holds `<%`, Templater didn't run: stop and tell the owner. Otherwise fill in its properties and body as edits to its file, by rule 2.

## 4. Rename and move through the Obsidian CLI

Obsidian then rewrites every link to the note. A rename on disk breaks them. Paths are relative to the vault, with `/`:

```
obsidian vault='<folder name>' rename path='<note path>' name='<new name>'
obsidian vault='<folder name>' move path='<note path>' to='<folder>/'
```

Moving a note out of a folder can leave the folder empty. The CLI can't remove a folder, and kiln never deletes on disk: tell the owner the empty folder is there.

## 5. Never write `<%`

Not in a new note, an existing note or captured text, including a QuickAdd var: QuickAdd puts each `{{VALUE:…}}` into the template, and Templater runs any `<%` as code. If text you are saving contains `<%`, leave that part out and tell the owner.

## 6. Run kiln-check on the notes the flow touched

At the end of the flow, check every note it changed. Check the notes it created in a separate run with `--new`. Pass each note's full path, `<vault>/<note path>`: the check reads a shorter path from the current folder.

```
node '<plugin>/scripts/kiln-check.mjs' '<note>' '<note>'
node '<plugin>/scripts/kiln-check.mjs' --new '<new note>'
```

A flow that touched much of the day's work may check `--today '<vault>'` instead. That lists other notes too: fix only the notes this flow touched, and report the rest. Exit code 0: no errors; report any warnings. Exit code 1: fix each error by these rules (move a note by rule 4), run the check again, and report what you couldn't fix.

## Calling the Obsidian CLI

- In Git Bash, call `obsidian.com`: bare `obsidian` there starts the app. In pwsh, and on macOS and Linux, call `obsidian`.
- Name the vault first on every call, `vault='<folder name>'`: unless the current folder is the vault folder itself, the CLI may act on the active vault instead. The folder name is the last part of rule 1's `vault` (not the `name` in the kiln file): for `D:\notes`, `obsidian vault='notes' quickadd:check`. If rule 1 was skipped because the owner named notes, use the name of the folder above the note that holds `_kiln/types/`. If two vaults share that folder name, stop and ask the owner: naming a vault by its id waits on T2.
- Put every value in single quotes, in both shells: nothing in single quotes runs or expands. Inside a value, write `'` as `'\''` in Bash and `''` in pwsh. In `vars`, JSON-escape the value first (`\"` for `"`, `\\` for `\`): `vars='{"title":"Bob'\''s \"big\" $5 idea"}'` in Bash, `vars='{"title":"Bob''s \"big\" $5 idea"}'` in pwsh. pwsh before 7.3 drops the double quotes inside `vars`, so use pwsh 7.3 or later.
- The CLI needs Obsidian running. Obsidian's docs say the first command starts it, but on Windows (Obsidian 1.14.4) it doesn't: the call fails at once with "The CLI is unable to find Obsidian. Please make sure Obsidian is running and try again." That means Obsidian is closed, nothing else. Tell the owner you are opening the vault, and open it by its link, `obsidian://open?vault=<encoded name>`. `<encoded name>` is the vault's folder name with every character but letters, digits and `-_.~` percent-encoded as UTF-8, `'` included, so the link needs no escaping in single quotes: `D:\Bob's notes` gives `obsidian://open?vault=Bob%27s%20notes`. Open it with:
  - pwsh: `Start-Process '<link>'`
  - Git Bash on Windows, and WSL with Obsidian installed on Windows: `rundll32.exe url.dll,FileProtocolHandler '<link>'`. You are in WSL when `uname -r` contains `microsoft` or `WSL_DISTRO_NAME` is set.
  - macOS: `open '<link>'`
  - Linux: `xdg-open '<link>'`

  Don't go by the open command's exit code (`rundll32` can't report whether the link opened: the functions it runs return nothing); judge by the retry. Wait about five seconds, then run the CLI command again, up to three times. The vault may still be loading: the CLI can say "unable to find Obsidian" again, or "command not found" (Obsidian words it `Command "<name>" not found`). Both mean still loading, so wait and retry. That holds only right after you opened the vault: at any other time, "not found" means the command, or the Obsidian plugin that provides it, really is missing, so stop and tell the owner. The link opens only a vault Obsidian already knows. If the call still fails after three tries, or doesn't return, ask the owner to open the vault in Obsidian, then try again.
- From WSL, calling the CLI itself is untested: a forum report says some of its commands exit with code 255 through WSL's Windows interop. If a call fails that way, stop and tell the owner.

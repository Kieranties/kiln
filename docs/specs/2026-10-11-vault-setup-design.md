# Setting up a vault

Status: **decided, exploring** (2026-10-11), with one trial to run. Nothing here is final.

Part of [Foundation: Claude in the vault](https://github.com/Kieranties/kiln/issues/79), for [#72](https://github.com/Kieranties/kiln/issues/72). `/kiln:setup` sets up a vault from the blueprint from any Claude session, with no clone. The same skill re-applies a changed blueprint and loads the Northwind Arena sample on request.

## Decided

### A Node helper does the mechanical work

Most of "Setting up a vault" (`claude-plugin/blueprint/README.md`) is mechanical: create the type folders, copy the blueprint to `_kiln/`, and merge the settings fragments into `.obsidian/`. A prototype of about 150 lines did all ten merges, and a second run changed nothing. So the skill runs a bundled Node helper, and Claude handles the judgement:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-setup.mjs" plan --vault "D:\notes"
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-setup.mjs" apply --vault "D:\notes"
```

- `plan` shows what would change; `apply` writes it. That's one approved run rather than dozens of write prompts, and the same result every time.
- Merging the JSON in pwsh corrupted data silently in a trial: at default depth, rule conditions became `" "`, and a one-item list became a string. Hence Node.
- Without Node, Claude follows the README by hand, which works but is slow.

The helper writes JSON the way Obsidian does: LF line endings and no final newline. It accepts an older `core-plugins.json` written as a list rather than an object; skipping that file would leave Bases and Properties off.

### The steps

1. **Check the plugins.** Each of `iconic`, `templater-obsidian`, `quickadd` and `homepage` has `manifest.json` and `main.js`, at or above the blueprint's minimum versions. Missing ones can be installed through the Obsidian CLI (below).
2. **Check the Obsidian CLI is registered** ([vault access](2026-10-11-vault-access-design.md)).
3. **Plan.** Show what will change. In a vault already in use, show every kit setting that would override the owner's (below).
4. **Check Obsidian is closed,** at this step and only here, because QuickAdd and Homepage read some settings at start-up. If Obsidian is running, say why it must close and how. With Run in Background installed, that means the tray's Close Vault, because quitting only hides it. Then check again. The check is a process check: in Git Bash that is `tasklist //FI "IMAGENAME eq Obsidian.exe"` (double slash, or MSYS rewrites it). It can't tell which vault is open. Obsidian's `obsidian.json` can say `open: true` when the app is closed, so it isn't used.
5. **Apply:**
   - the type folders;
   - the blueprint into `_kiln/`;
   - the settings merges;
   - one QuickAdd choice and template per kind, with "file exists" set so it never prompts;
   - "Automatically update internal links" turned on.
6. **Record:** write the version record in `.kiln/`, and add the vault to `~/.kiln/config.json` ([finding the vault](2026-10-11-finding-the-vault-design.md)).
7. **Offer, with consent:**
   - the permission settings;
   - Templater's per-device "Trigger Templater on new file creation", as a suggestion, not a requirement. It only gives notes made by hand in a type's folder their template. It lives in Obsidian's local storage, so no settings file can set it.
8. **Report** what changed.

### Installing the plugins through the Obsidian CLI (2026-10-12)

Added for [#112](https://github.com/Kieranties/kiln/issues/112), found while trialling #72. Current direction, not final.

The Obsidian CLI can install and switch on community plugins (`plugins:restrict off`, then `plugin:install id=<id> enable`), so setup no longer leaves that to the owner. That takes Obsidian **open**, and the apply step needs it **closed**, so installing comes first:

1. The owner opens the folder as a vault in Obsidian, which also creates `.obsidian/`, and keeps it open.
2. `plan` reports `install`: the ids of the missing plugins, and `vault`, the folder name to pass as `vault=`. It is `null` when nothing is missing. The helper still never runs `obsidian`, because that would start the app.
3. Claude says what installing does (it turns off restricted mode and downloads community plugin code) and asks. With a yes, it runs the CLI as the vault rules say: `vault='<name>'` first, single-quoted values, `obsidian.com` in Git Bash. Then it plans again.
4. Claude asks the owner to close Obsidian, and setup carries on at the closed check.

Choices within this:

- **Restricted mode is always turned off before installing.** The helper can't tell whether it is on. Obsidian doesn't document where it keeps the setting; forum reports put it in the app's local storage (`enable-plugin-<app id>`), not in `.obsidian/`. `community-plugins.json` only lists the plugins that are switched on.
- **Older plugins stay a manual update** (Settings → Community plugins → Check for updates). The CLI has no update command, and whether `plugin:install` updates an installed plugin isn't documented. Worth trying in a trial vault.
- **Without the CLI** on PATH, the owner installs the plugins in Obsidian, as before.
- **The CLI may not start Obsidian.** Obsidian's docs say the first command launches the app. On Windows, with Obsidian 1.14.4, it doesn't: every command fails at once with "The CLI is unable to find Obsidian. Please make sure Obsidian is running and try again." Whether that is a known Obsidian issue is still being checked. Until then, nothing relies on the CLI to launch Obsidian: the owner opens the vault first. Claude reads that message as "Obsidian is closed", never as a missing plugin, and never writes plugin files by hand.
- **Current direction: open the vault by its URI, then retry.** The owner found that opening `obsidian://open?vault=<name>` starts Obsidian on that vault, and CLI calls then work after a few seconds. `plan` gives the URI as `install.uri`, with every character but letters, digits and `-_.~` percent-encoded, `'` included, so it needs no escaping in single quotes. Claude opens it, waits about five seconds, and tries again up to three times before asking the owner to open Obsidian. The open command differs by shell and OS: `Start-Process` in pwsh, `rundll32.exe url.dll,FileProtocolHandler` in Git Bash and in WSL (for an Obsidian installed on Windows), `open` on macOS and `xdg-open` on Linux. `cmd.exe //c start "" '<uri>'` was ruled out because `cmd` would also read `%` in the encoded name. The URI opens only a vault Obsidian already knows, one opened in it before; setup's first stop already asks for that.
- **2026-10-12, the owner's results on Windows 11 with Obsidian 1.14.4** ([#114](https://github.com/Kieranties/kiln/issues/114)). From Git Bash with Obsidian closed, `explorer.exe '<uri>'` did not start Obsidian, so it was dropped. `rundll32.exe url.dll,FileProtocolHandler '<uri>'` did, from Git Bash and from WSL through Windows interop; pwsh's `Start-Process '<uri>'` did too. The first CLI command after the launch said "command not found" while the vault loaded, and the next try worked. That matches an open forum report, [CLI commands for second vault do not wait for vault's window to initialize](https://forum.obsidian.md/t/115473), seen on Linux with Obsidian 1.13.1.
- **Current direction: retry while the vault loads, and judge by the retry.** Right after Claude opened the link, "unable to find Obsidian" and "command not found" both mean "still loading": Claude waits about five seconds and retries, up to three times, then asks the owner. At any other time "not found" means the command or plugin is missing. No open command's exit code is relied on: Microsoft documents the functions `rundll32` runs as returning nothing, so it can't say whether the link opened.
- **WSL is detected by `uname -r` containing `microsoft`, or `WSL_DISTRO_NAME` being set.** Only the launch was tried there. The CLI itself through WSL is untested: a forum report, [Obsidian CLI property:\* commands return exit code 255 when called via WSL2 interop](https://forum.obsidian.md/t/113170), says some commands fail that way, and a reply there says running from WSL isn't officially supported. It stays out of the main path.

### A vault already in use

The kit's settings can collide with the owner's: Homepage, the new-note folder, the new-link format, where properties show in a note, the daily-note folder and format, Templater's template folder and folder templates, and property types. Setup shows each override and asks before writing. A fresh vault has nothing to ask, so setup stays one prompt. An existing `Home.md` is never replaced without asking.

### The version record

Machine-only state goes in a hidden `.kiln/blueprint.json` at the vault root:

```json
{
  "plugin": "a1b2c3d4e5f6",
  "blueprint": "sha256:…",
  "files": { "_kiln/types/work.md": "sha256:…" }
}
```

- `plugin` is the plugin version, read from the last folder name of `${CLAUDE_PLUGIN_ROOT}`.
- `blueprint` is a hash of the whole blueprint.
- `files` holds a hash for each file setup installed.

Obsidian doesn't index dot-folders, so the record never shows up in the vault. `_kiln/` stays for what Obsidian must see: templates (Templater and QuickAdd need indexed files), views (embedded `.base` files) and the type definitions, readable in Obsidian. Only the Node helper reads or writes the record, so the kiln Obsidian plugin can take it over later with one change.

### Re-applying the blueprint

After a kiln update, setup compares three versions of each file: what it installed last time (the hash in the record), what is in the vault now, and the new blueprint. Each file is then sorted:

| The vault's copy | The blueprint | Re-apply |
|---|---|---|
| Unchanged | Changed | Update it |
| Changed by the owner | Unchanged | Keep the owner's edit |
| Changed by the owner | Changed | Show both, and ask |
| Missing | New | Add it |
| Deleted by the owner (setup installed it) | Still has it | Leave it deleted, and report it; the owner can take it back |
| Deleted by the owner (setup installed it) | Dropped | Nothing to report: drop it from the record |
| Present | Dropped | Leave it, and report which notes still use it (archive, never delete) |

In a trial this sorted every case correctly. Re-apply can't change notes already written; it reports any that no longer match a changed definition, and `/kiln:check` finds them.

With Obsidian open, re-apply touches only what reloads live: `_kiln/` (plain files), and Iconic and Templater settings. QuickAdd also reloads its settings live since 2.30, so it can join after trial T3. Everything else waits until Obsidian is closed.

### The sample

Loading the Northwind Arena sample into a trial vault is an option, never the default. Setup fetches it only when asked, pinned to the plugin's commit ([repo layout](2026-10-11-repo-layout-design.md)).

### Minimum versions

The blueprint gets a `requires` list: Obsidian 1.12.7 (the CLI), QuickAdd 2.32, and minimums for Templater, Iconic and Homepage. Setup warns when something is older.

### Reused from #78

From the closed first attempt: the skill's structure, its confirmations and its "never" list, the guide changes, and most of `plugin.test.ts`. What changes:

- the kit path becomes `${CLAUDE_PLUGIN_ROOT}/blueprint/`;
- the install has no `--sparse`;
- re-apply becomes three-way;
- the sample is pinned to the plugin's commit.

## Trial

**T3, re-apply with Obsidian open.** In a trial vault, change a blueprint file under `_kiln/`, a Templater setting and a QuickAdd choice, and re-apply with Obsidian open. Confirm that:

- Obsidian picks up each change;
- it doesn't write its own copy back over `_kiln/`, the core settings or `workspace.json`.

## Open

- **Types added only in a vault** (a definition in `_kiln/types/` with no blueprint change). Out of scope: re-apply lists them. Generating their settings is the kiln Obsidian plugin's job later.
- **Showing the blueprint version in Obsidian.** Not for now.

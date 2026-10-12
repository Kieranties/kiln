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

1. **Check the plugins.** Each of `iconic`, `templater-obsidian`, `quickadd` and `homepage` has `manifest.json` and `main.js`, at or above the blueprint's minimum versions.
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
| Deleted by the owner (setup installed it) | Any | Leave it deleted, and report it; the owner can take it back |
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

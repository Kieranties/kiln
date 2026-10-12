# Setting up and re-applying

`/kiln:setup` sets up a vault from the blueprint, from any Claude session and with no copy of the kiln repo. The same skill re-applies a changed blueprint after an update, and loads the Northwind Arena sample on request. [Skills](../reference/skills.md#kiln-setup) says how to run it, and "Setting up a vault" in [the blueprint reference](../reference/blueprint.md#setting-up-a-vault) lists every step. This page says why it works the way it does. Current direction.

## A Node helper does the mechanical work

Most of setting up is mechanical: create the type folders, copy the blueprint to `_kiln/`, and merge the settings fragments into `.obsidian/`. So the skill runs a bundled Node helper, `kiln-setup.mjs`, and Claude handles the judgement: what to ask, and what to tell you.

- `plan` shows what would change; `apply` writes it. That's one approved run rather than dozens of write prompts, and the same result every time.
- Merging the JSON in pwsh corrupted data silently in a trial (nested values flattened, one-item lists turned into strings), hence Node.
- The helper writes JSON the way Obsidian does: LF line endings and no final newline.
- Without Node, Claude follows the steps by hand, which works but is slow.

## Obsidian open, then closed

Installing the community plugins needs Obsidian **open**: the Obsidian CLI turns off restricted mode, then downloads and switches on each missing plugin. Applying needs Obsidian **closed**, because QuickAdd and Homepage read their settings only at start-up. So installing comes first, and setup asks you to close Obsidian before it writes. With Run in Background installed, quitting only hides Obsidian, so you use its tray's Close Vault.

- **Restricted mode is always turned off before installing,** because the helper can't tell whether it is on: Obsidian keeps that switch outside `.obsidian/`.
- **Older plugins are a manual update** in Obsidian. The CLI has no update command.
- **The CLI doesn't start Obsidian** on Windows (Obsidian 1.14.4): every command fails with "The CLI is unable to find Obsidian". Setup opens the vault by its `obsidian://open?vault=<name>` link instead, waits a few seconds and retries, because the first command after the launch can say "command not found" while the vault loads. The helper never runs `obsidian` itself, because that would start the app.
- **Whether Obsidian is closed** is a process check, made at one step only. It can't tell which vault is open, and Obsidian's `obsidian.json` can say a vault is open when the app is closed, so that isn't used.
- **Claudian is required** like the other four, and setup's consent says it is the one Obsidian staff haven't reviewed ([ADR 0009](../adr/0009-the-blueprint-builds-on-five-community-plugins.md)). Setup never reads or writes Claudian's settings, which live in `.claudian/` in a format that changes often.

## A vault already in use

The blueprint's settings can collide with yours: Homepage, the new-note folder, the new-link format, where properties show, the daily-note folder and format, Templater's template folder and folder templates, and property types. Setup shows each one and asks; keeping yours is the default, and it won't ask again until the blueprint changes. A new vault has nothing to ask, so setup stays one prompt. An existing `Home.md` is never replaced without asking, and everything replaced is copied to `.kiln/backup/` first.

## The record, and re-applying

Machine-only state goes in a hidden `.kiln/blueprint.json` at the vault root: the Claude plugin's version, a hash of the whole blueprint, and a hash of each file setup installed. Obsidian doesn't index dot-folders, so it never shows in the vault. `_kiln/` holds only what Obsidian must see: templates, views and the type definitions.

After an update, setup compares three versions of each file: what it installed last time, what is in the vault now, and the new blueprint.

| The vault's copy | The blueprint | Re-apply |
|---|---|---|
| Unchanged | Changed | Update it |
| Changed by you | Unchanged | Keep your edit |
| Changed by you | Changed | Show both, and ask |
| Missing | New | Add it |
| Deleted by you (setup installed it) | Still has it | Leave it deleted, and report it; you can take it back |
| Deleted by you (setup installed it) | Dropped | Nothing to report: drop it from the record |
| Present | Dropped | Leave it, and report which notes still use it (archive, never delete) |

Re-apply can't change notes already written; `/kiln:check` finds any that no longer match a changed definition. With Obsidian open, re-apply changes only what reloads live: `_kiln/` and the Iconic and Templater settings. Everything else waits until Obsidian is closed and setup runs again.

Types you add to `_kiln/types/` yourself are listed and left alone: setup generates nothing for them.

## Claude creates notes from generated choices

Claude creates a note by running a QuickAdd choice, so every kind needs one. Setup generates a choice and a template per kind from the type definitions, grouped in a menu per type, so nothing in the blueprint's settings lists them. No template has a picker, which would open a dialog nobody can answer, and every choice keeps an existing file rather than asking. [ADR 0003](../adr/0003-claude-creates-notes-with-obsidian-create.md) proposes creating notes with `obsidian create` instead.

## The sample

Loading the Northwind Arena sample is an option, for a trial vault, never the default. Setup fetches it from GitHub only when asked, at the Claude plugin's own commit, so the sample and the blueprint always match.

## Minimum versions

The blueprint's `requires.json` holds the oldest Obsidian and plugin versions it is written for. Setup stops for a missing plugin and warns about an older one. A minimum is raised only when kiln depends on something newer.

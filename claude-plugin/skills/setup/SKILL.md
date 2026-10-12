---
name: setup
description: Set up an Obsidian vault with the kiln blueprint, re-apply the blueprint after a kiln update, or load the Northwind Arena sample into a trial vault. Use only for kiln vault setup, when the owner runs /kiln:setup or asks to set up, update or re-apply kiln.
---

# Set up a kiln vault

Follow `${CLAUDE_PLUGIN_ROOT}/reference/vault-rules.md`, where `<plugin>` is `${CLAUDE_PLUGIN_ROOT}`.

This skill is the only one that changes a vault's `_kiln/` and `.obsidian/`, records vaults in `~/.kiln/config.json`, and writes notes as plain files (the sample), always with Obsidian closed. A Node helper does every write in the vault; you do the asking. The one exception is installing the community plugins, at step 3: Obsidian does that through its CLI, with Obsidian open, before the rest. The procedure it runs is "Setting up a vault" in `${CLAUDE_PLUGIN_ROOT}/blueprint/README.md`.

## 1. Work out what was asked

- **The vault folder.** The one the owner named. With no folder named, find it by rule 1 of the vault rules and confirm the answer with the owner. If the resolver stops because a folder is an Obsidian vault without kiln, that folder is the one to set up. A new vault is the folder they opened in Obsidian.
- **The sample.** Load it only when the owner asks for the Northwind Arena sample, and only into a trial vault.
- **Node.** Run `node --version`. Without Node 24, follow "Setting up a vault" by hand instead, then go to step 7. Its step 1 says how to install missing plugins through the CLI, as step 3 here does.

## 2. Plan

```
node '${CLAUDE_PLUGIN_ROOT}/scripts/kiln-setup.mjs' plan --vault '<vault>'
```

Add `--sample` if the owner asked for the sample. The commands are the same in Bash and pwsh. Put every value you fill in (the vault, each `--take` id, a `--name`) in single quotes; a `'` inside one is written `'\''` in Bash and `''` in pwsh. The helper prints JSON:

- `stop`: tell the owner each reason and how to fix it, then plan again. Exit code 1 means there is at least one. A stop that says a plugin isn't installed is handled at step 3. A stop that says Obsidian is running, or that it can't tell, is not handled here: carry on to step 4 with the plan's `asks`, and deal with it at step 5, the only place Obsidian is checked. If the output has `error` instead, report it and stop. Exit code 2 prints usage text, not JSON: run it again with only the options listed here.
- `warnings`: pass each one on. One says the Obsidian CLI isn't registered; step 3 and kiln's other skills need it.
- Summarise the plan: the folders, the files by action, the settings that change. Files with action `wait` wait for Obsidian to close. Files with action `deleted` are ones setup installed that the owner has since deleted: setup leaves them deleted. Offer to put one back, which is `--take '<path>'` at step 6.
- `vaultOnlyTypes`: types the owner added to `_kiln/types/` themselves. Setup leaves them alone and generates nothing for them.
- `sample`: with `notes` above 0, the vault already has the owner's own notes. Ask before loading the sample there.

## 3. Install the missing plugins

Only when `install` isn't `null`. `install.plugins` are the ids of the plugins that are missing, and `install.vault` is the vault's name for the Obsidian CLI.

- **`cli` is `null`:** the CLI isn't on PATH. Ask the owner to install and switch on the plugins in Obsidian, as section 2 of `${CLAUDE_PLUGIN_ROOT}/blueprint/GETTING-STARTED.md` says, then plan again.
- **Otherwise,** offer to install and switch them on through the CLI. Say what that does first: it turns off restricted mode, which lets community plugins run, then downloads each plugin from Obsidian's community directory and turns it on. When `realclaudian` is in the list, also say that Claudian is the one plugin Obsidian staff haven't reviewed, and that it runs Claude Code inside Obsidian with the vault as its working folder. Run nothing until the owner says yes. The CLI needs Obsidian running with this vault open: ask the owner to open the vault in Obsidian and keep it open until the commands are done. Call it as "Calling the Obsidian CLI" in the vault rules says: `obsidian.com` in Git Bash, `obsidian` in pwsh, and every value in single quotes. Turn off restricted mode, install each id in `install.plugins`, then list what is installed:

  ```
  obsidian vault='<install.vault>' plugins:restrict off
  obsidian vault='<install.vault>' plugin:install id='<id>' enable
  obsidian vault='<install.vault>' plugins filter=community versions
  ```

  "The CLI is unable to find Obsidian" means Obsidian isn't running, not that a plugin is missing. The CLI doesn't start Obsidian itself, so open the vault by its URI, `install.uri`, which needs no escaping:
  - pwsh: `Start-Process '<install.uri>'`
  - Git Bash on Windows, and WSL with Obsidian installed on Windows: `rundll32.exe url.dll,FileProtocolHandler '<install.uri>'`. You are in WSL when `uname -r` contains `microsoft` or `WSL_DISTRO_NAME` is set.
  - macOS: `open '<install.uri>'`
  - Linux: `xdg-open '<install.uri>'`

  Don't go by the open command's exit code (`rundll32` can't report whether the link opened: the functions it runs return nothing); judge by the retry. Wait about five seconds, then run the CLI command again, up to three times. The vault may still be loading: the CLI can say "unable to find Obsidian" again, or "command not found" (Obsidian words it `Command "<name>" not found`). Both mean still loading, so wait and retry. That holds only right after you opened the vault: at any other time, "not found" means the command, or the plugin that provides it, really is missing.

  The URI opens only a vault Obsidian already knows, one opened in it before. If the command still fails after three tries, ask the owner to open the vault in Obsidian, then run it again. From WSL, the CLI itself is untested: a forum report says some of its commands exit with code 255 there. For any other failure, or a command that doesn't return, stop, tell the owner what happened, and ask them to install the rest in Obsidian. Never write plugin files yourself. Then plan again: each plugin should now be installed.
- **A plugin older than the blueprint's minimum** (a warning says so) isn't in `install`, because the CLI can't update one. Ask the owner to update it in Obsidian: Settings → Community plugins → Check for updates.

Obsidian is now open. Step 5 asks the owner to close it.

## 4. Ask about the owner's settings and files

Each entry in `asks` is a setting or file of the owner's that the blueprint would replace: its `id`, the `current` value and the `blueprint` value. Show both (for a file, the difference) and ask: keep theirs, or take the blueprint's. Keeping is the default, and setup won't ask about it again until the blueprint changes. For each one they take, add `--take '<id>'` to the apply command. A new vault has nothing to ask, so ask nothing.

## 5. Check Obsidian is closed

Look at `mode` in the plan (`setup` or `reapply`) and at `obsidian`: `running` is `true`, `false` or `null`.

- **`mode` is `setup`** and it needs Obsidian closed: QuickAdd and Homepage read their settings only when Obsidian starts. Ask the owner to quit Obsidian. With Run in Background installed, quitting only hides it, so they use the tray's Close Vault. Then plan again.
- **`mode` is `reapply`:** Obsidian open is fine: the helper changes `_kiln/`, Iconic and Templater now, and everything marked `wait` waits. Offer to run setup again once Obsidian is closed.
- **`running` is `null`:** the check couldn't run. Ask the owner, and add `--confirm-closed` only when they say Obsidian is closed.
- **On Linux,** a Flatpak or Snap Obsidian may not be seen by the process check. That matters only when `running` is `null`: if the owner uses one and says it is closed, add `--confirm-closed`. If they say it is open, ask them to close it.

## 6. Apply

```
node '${CLAUDE_PLUGIN_ROOT}/scripts/kiln-setup.mjs' apply --vault '<vault>'
```

With the same `--sample`, each `--take '<id>'`, and `--confirm-closed` if step 5 needed it. The first vault recorded becomes the default. Only when the plan's `kiln` has `recorded` set to `new` (`kiln.recorded`), and `kiln.default` names another vault, ask whether this one should be the default, and add `--default` if so. To use a name other than `kiln.name`, add `--name '<name>'`; it applies only to a vault not yet recorded, and a recorded vault keeps its name. The helper prints the same JSON with `applied: true`. Exit code 1 means it stopped, with the reasons in `stop`; if the output has `error` instead, report it, say that some writes may have been made, and point to the backups in `.kiln/backup/`. Exit code 2 prints usage text, not JSON.

## 7. Offer, with the owner's consent

- **The permission settings.** A session in another folder asks before every write to the vault, and Claude Code doesn't otherwise protect files that can run code inside Obsidian. Offer to add the plan's `permissions` to the user settings file, `~/.claude/settings.json` (on Windows, in your home folder's `.claude`): append its `additionalDirectories` entries to `permissions.additionalDirectories` and its `ask` entries to `permissions.ask`, adding only entries not already there and keeping everything else. Without Node there is no plan: offer the same shape, with the vault path in `permissions.additionalDirectories`, and `Edit(<rule path>/.obsidian/**)` and `Edit(<rule path>/_kiln/**)` in `permissions.ask`. `<rule path>` is the vault's absolute path with forward slashes and one more `/` in front: on Windows the drive becomes a lowercase folder, so `D:\notes` is `//d/notes`; elsewhere `/home/me/notes` is `//home/me/notes`. Show the owner the exact JSON first, and change the file only if they say yes. Never write to a vault's own `.claude/`.
- **Templater's trigger,** as a suggestion: in Obsidian, Settings → Templater, turn on **Trigger Templater on new file creation**. It gives notes made by hand in a type's folder their template. It is kept per device, so no settings file can set it. Claude doesn't need it.

## 8. Report

Say what changed: folders, files by action, settings, the backups (`backups`, under `.kiln/backup/`: setup copies each file and settings file there before it replaces it), what was kept, what waits, files the owner deleted (left deleted), dropped files with the notes that still use them (`usedBy`), the sample, and the name the vault was recorded under in `~/.kiln/config.json`. Then the next step: open Obsidian and work through section 4 of `_kiln/GETTING-STARTED.md`, or section 3 of `_kiln/TRY-THE-SAMPLE.md` for the sample.

## Never

- With Node, write to the vault yourself. Every change goes through the helper. (Without Node, you follow "Setting up a vault" by hand, and the rest of this list still holds.)
- With Node, edit `~/.kiln/config.json` yourself; the helper records the vault.
- Take the blueprint's version of the owner's setting or file without asking.
- Delete or rename anything in the vault. Dropped files stay where they are.
- Load the sample unless the owner asked for it.
- Write a vault's `.claude/` folder, or change the user settings without the owner's consent.
- Call the Obsidian CLI anywhere but step 3, or install a plugin without the owner's consent. The CLI needs Obsidian open, and the apply step needs it closed.
- Change the plugin's blueprint. That is "Adding or changing a type", in the kiln repo.

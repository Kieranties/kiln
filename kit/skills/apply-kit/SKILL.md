---
name: apply-kit
description: Use when the user asks to set up a kiln vault or apply the kiln kit to an Obsidian vault or folder ("Set up the kiln kit in D:\notes"), to re-apply the kit after the kiln plugin updated, to apply a new or changed kiln type to a vault, or to load the Northwind Arena sample into a trial vault. Copies the kit into the vault's _kiln folder and merges its Obsidian and plugin settings, following the kit's own README.
---

# Apply the kiln kit

The kit ships in this plugin: the plugin's folder **is** the kit, `${CLAUDE_PLUGIN_ROOT}`. The procedure is the kit's `README.md`. This skill says how to run that procedure from any session; it does not repeat it, so the README always wins.

**The kit folder** is `${CLAUDE_PLUGIN_ROOT}`, unless the owner names another, such as `kit/` in a kiln clone or worktree to try an unmerged kit. Use the one they name. Every kit path the README gives (`types/`, `settings/plugins/iconic.json`, ...) is under the kit folder.

## 1. Work out what was asked

- **The vault folder.** The owner may give a Windows path such as `D:\notes`; in Git Bash the same folder is `/d/notes`. Never write outside it.
- **The job:**
  - **Set up**: the vault has no `_kiln/` folder yet. Run "Setting up a vault".
  - **Re-apply**: the vault already has `_kiln/`, and the kit has changed: the plugin updated, or a type was added or changed. Run "Adding or changing a type", step 5, as section 4 below describes.
  - **The sample**: only when the owner asks for the Northwind Arena sample, never by default (section 5).

## 2. Before writing anything

1. Read the kit folder's `README.md`: "Conventions", "Setting up a vault" and "Adding or changing a type".
2. Check `<vault>/.obsidian/plugins/` has the four plugin folders that "Setting up a vault" step 1 names. If `.obsidian/` or any of them is missing, stop: name what is missing and point the owner to sections 1 and 2 of `GETTING-STARTED.md` in the kit folder.
3. Ask the owner to confirm both of these, unless their request already says so, and wait for the answer:
   - **Obsidian is closed.** Required to set up. To re-apply, only the changes the README says need it (QuickAdd, Homepage and `workspace.json`) wait for it.
   - **Templater's "Trigger Templater on new file creation" is on** on this device. No settings file can turn it on, and without it no template runs.

## 3. Set up

Run "Setting up a vault" steps 2 to 6, exactly as written.

- **Copy files byte for byte**, with a file copy, never by retyping them. Copy only what step 3 lists: the kit folder also holds `.claude-plugin/` and `skills/`, which are this plugin and never go into a vault.
- **Merge settings in place.** Read each target file before changing it, change only the keys and entries the rule names, and keep everything else. Write JSON with two-space indentation, as Obsidian does.
- **Step 5 needs `workspace.json`.** If Obsidian has never been opened on the vault, the file is missing: skip the step, as the README says, and say so in the report.

## 4. Re-apply

"Adding or changing a type" step 5 in practice. Compare the kit folder with the vault, then:

- **`_kiln/`**: copy in each file the vault lacks or whose content differs: `types/`, `templates/`, `views/`, `properties.md` and the guides. The kit owns `_kiln/`, so replacing a file there is expected. A file in `_kiln/` that the kit no longer has stays where it is: list it in the report.
- **The vault root**: `Home.md` and `Board.base` may carry the owner's own changes. When one differs from the kit, show the difference and ask before replacing it.
- **Type folders**: create any that are missing.
- **Settings**: merge every fragment again by the rules in "Setting up a vault" step 4. They are safe to repeat. With Obsidian open, leave out any QuickAdd, Homepage or `workspace.json` change: list it, and make it once the owner has closed Obsidian.
- **Nothing changed** is a fine result. Say so.

## 5. The sample, on request

Only into a trial vault. If the vault has notes of the owner's own (any `.md` outside `_kiln/` other than `Home.md`), stop and ask first.

1. Set up the vault as in section 3.
2. Find the sample: `tests/fixtures/layer1` beside the kit folder when the kit folder is `kit/` in a kiln clone. Otherwise fetch it into a temporary folder outside the vault. These commands work in Bash and PowerShell:

   ```bash
   git clone --depth 1 --filter=blob:none --sparse https://github.com/Kieranties/kiln.git <temporary folder>
   git -C <temporary folder> sparse-checkout set tests/fixtures/layer1
   ```

3. Copy everything under `tests/fixtures/layer1/` into the vault, keeping its folders: they are the type folders. Then remove the temporary clone.
4. Point the owner to section 3 of `TRY-THE-SAMPLE.md`.

## 6. Report

As "Setting up a vault" step 6 says: each file copied and each setting changed, by file and key. Also say which kit folder you used, anything you skipped and why, and any file you left in place.

Then the owner's next step: open Obsidian and work through section 4 of Getting started, which is in the vault at `_kiln/GETTING-STARTED.md` (or section 3 of `_kiln/TRY-THE-SAMPLE.md` for the sample).

## Never

- Write outside the vault, apart from the temporary clone in section 5.
- Delete or rename anything in the vault, or change the owner's own notes.
- Copy the sample unless the owner asked for it.
- Edit the kit folder. Changing the kit is "Adding or changing a type" steps 1 to 4, in a kiln clone.

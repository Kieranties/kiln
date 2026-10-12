---
name: check
description: Check notes in a kiln vault against their type definitions (folder, type, kind, status, properties, sections, file name). Use when the owner runs /kiln:check, or asks to check their kiln vault, kiln notes or today's kiln changes.
---

# Check kiln notes

Checks notes against the type definitions in the vault's `_kiln/types/`. The check never changes a note.

## 1. Find the vault

If the owner named notes or folders to check, skip to step 2. Otherwise run the resolver:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-vault.mjs"
```

It prints JSON, the same in Bash and pwsh. Exit code 0: `vault` is the vault folder to use. Exit code 1: no vault was found. Tell the owner the `reasons`, list the `candidates`, and ask which vault to use. Offer to record the answer through `/kiln:setup`, which is the only writer of `~/.kiln/config.json`; never edit that file yourself. Exit code 2: wrong arguments; run it again without arguments.

## 2. Run the check

The whole vault, unless the owner asks for today's changes:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" "<vault>"
```

Today's changes (notes modified since midnight):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" --today "<vault>"
```

To check particular notes or folders, pass their paths instead of `<vault>`. The commands are the same in Bash and pwsh. Exit code 0 means no errors (there may be warnings), 1 means errors, 2 means the arguments were wrong.

**Without Node:** if `node --version` fails or shows a version below 24, check by hand. For each note, read its `type`, then `_kiln/types/<type>.md` and `_kiln/properties.md`, and apply the rules below. Report in the same format as the script.

## 3. Report, then offer fixes

Show the output as it is: each note's path, then its `error` and `warn` lines. Then offer to fix the errors, and change a note only when the owner agrees. Move and rename notes through the Obsidian CLI, so links follow. Never write `<%` into a note.

## The rules

| Result | Rule |
|---|---|
| Error | Wrong folder, type, kind or status |
| Error | A section of the type is missing (extra sections are fine), or the daily note's Log isn't last |
| Error | A property that isn't shared, optional or the type's own; a relationship that isn't a list of links |
| Error | A file name that breaks the type's `naming`, or contains `#`, `^`, `[`, `]`, `\|` or `:` |
| Error | A new note with properties and no body, or with `<%` |
| Warning | A link to a note that doesn't exist yet (suggest a near match) |
| Warning | A file name another note uses |
| Warning | `<%` in an existing note |

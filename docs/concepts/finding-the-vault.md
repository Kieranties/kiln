# Finding the vault

Claude must find the vault from wherever a session runs: Claudian, which starts in the vault, or a terminal or Herdr tab in some other folder, such as a repo. [Configuration](../reference/configuration.md#how-claude-finds-the-vault) has the order it follows; this page says why. Current direction.

## A file of kiln's own

kiln records vaults in `~/.kiln/config.json`, not in a Claude Code plugin setting, because kiln's Node scripts read it, it holds more than one vault, and it isn't tied to Claude. A plugin setting holds one value, isn't visible to scripts Claude runs from the shell, and its default wasn't filled in when unset in a trial. `/kiln:setup` is its one writer.

## The order

- **A folder you name** comes first: you said so.
- **The current folder comes before `KILN_VAULT`,** because Obsidian inherits your environment variables and Claudian passes them on. A `KILN_VAULT` set for your whole user would otherwise point a Claudian session at the wrong vault.
- **A plain Obsidian vault stops the search.** If the current folder is inside a vault without `_kiln/`, Claude offers to set it up rather than moving on to another vault, since that is almost always the vault you meant.
- **`KILN_VAULT`** overrides the default for one terminal or one Herdr workspace.
- **Obsidian's vault list** is a fallback for discovery only: its format isn't documented, so it is used only when exactly one vault in it has `_kiln/`.
- **Asking** comes last, and the answer is recorded through setup, so there is one writer.

A small Node resolver in the plugin, `kiln-vault.mjs`, implements the order. It behaves the same in Bash and pwsh.

## Found when first needed

No start-up hook tells every session the path. A kiln skill runs the resolver the first time it needs the vault, so asking in any folder finds it. The note check walks up from the note it checks, so it needs no path.

## Permissions

A session in `D:\src\some-repo` that writes to `D:\notes` asks first in Manual mode, and `acceptEdits` doesn't cover folders outside the working ones. A plugin can't ship permission rules, so setup offers, with your consent, to add the vault as an additional directory in your user settings, with "ask first" rules on its `.obsidian/` and `_kiln/`. Writes there can run code inside Obsidian (plugin code, templates), and Claude Code doesn't otherwise protect them. A plugin hook that allowed writes to the vault worked in a trial, but it overrode the permission mode you chose, so it isn't used.

## Later

**Pointers from folders to vaults.** A worktree for a personal project should write to the personal vault, not the default. The kiln file could gain folder-to-vault routes, checked after `KILN_VAULT` and before the default. This belongs to [the flow for more than one vault](https://github.com/Kieranties/kiln/issues/103); nothing is built for it yet.

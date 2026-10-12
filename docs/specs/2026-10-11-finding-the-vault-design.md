# Finding the vault

Status: **decided, exploring** (2026-10-11). Nothing here is final.

Part of [Foundation: Claude in the vault](https://github.com/Kieranties/kiln/issues/79), for [#81](https://github.com/Kieranties/kiln/issues/81). Claude must find the vault from wherever the session runs: Claudian, or a terminal or Herdr tab in some other folder, such as a repo.

## Decided

### kiln's record of vaults

kiln keeps a small file, `~/.kiln/config.json` (on Windows, in the user's home folder), written by [setup](2026-10-11-vault-setup-design.md):

```json
{
  "default": "work",
  "vaults": {
    "work": "D:\\notes",
    "trial": "D:\\tmp\\kiln-sample"
  }
}
```

It's a plain file, not a Claude Code plugin setting, because:
- kiln's Node scripts read it;
- it holds more than one vault;
- it isn't tied to Claude.

The plugin setting (`userConfig`) holds one value, isn't visible to scripts Claude runs from the shell, and its default wasn't substituted when unset in a trial.

### Resolution order

The first answer wins:

1. A path given explicitly ("capture this to `D:\notes`").
2. The vault containing the current folder: walk up to the first folder holding `_kiln/types/`. In Claudian, the session always starts in the vault root, so this always finds it. If the current folder is instead inside a plain Obsidian vault (it has `.obsidian/` but no `_kiln/types/`), resolution stops there and offers setup, rather than moving on to another vault.
3. `KILN_VAULT`, a vault name or a path. It is an override for one terminal or one Herdr workspace.
4. The kiln file's `default`.
5. Obsidian's own vault list (`obsidian.json`), only when exactly one vault in it has `_kiln/`. The format isn't documented, so this is a fallback for discovery.
6. Ask. Claude lists the candidates, and offers to record the answer through setup, so there is one writer.

The current folder comes before `KILN_VAULT` because Obsidian inherits user environment variables and Claudian passes them on. A global `KILN_VAULT` would otherwise point a Claudian session at the wrong vault.

A small Node resolver in the plugin implements the order. In a trial it resolved a vault subfolder, reported ambiguity with two vaults and no record, honoured `KILN_VAULT` by name and by path, and rejected a plain Obsidian vault. It behaved the same in Bash and pwsh.

### Found when first needed

No start-up hook tells every session the path. A kiln skill runs the resolver the first time it needs the vault, so asking "capture this" in any folder finds it. The [note check](2026-10-11-note-check-design.md) walks up from the note it checks, so it needs no path.

### Permissions

A session in `D:\src\some-repo` that writes to `D:\notes` asks first in Manual mode, and `acceptEdits` doesn't cover folders outside the working ones. A plugin can't ship permission rules. Setup offers, with the owner's consent, to add to the user settings:

- the vault as an additional directory;
- "ask first" rules on `.obsidian/**` and `_kiln/**`. Writes there can run code inside Obsidian (plugin code, templates), and Claude Code doesn't protect them otherwise.

A plugin hook that allows writes to the vault worked in a trial, but it overrides the mode the owner chose, so it isn't used.

## Later

**Pointers from folders to vaults.** A worktree for a personal project should write to the personal vault, not the default. The kiln file gains folder-to-vault pointers, checked after `KILN_VAULT` and before the default:

```json
"routes": [{ "path": "D:\\src\\personal\\**", "vault": "personal" }]
```

This belongs to the Multiple bases flow; nothing is built for it yet.

## Open

- A vault identity note (a name, the blueprint version) for when the marker alone isn't enough. Setup's version record covers the version for now.

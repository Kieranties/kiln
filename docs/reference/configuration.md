# Configuration

What kiln keeps outside your notes, and how Claude finds your vault.

## `~/.kiln/config.json`

kiln's record of your vaults, in `.kiln` in your home folder. `/kiln:setup` is its only writer: it adds each vault it sets up, and the first one becomes the default.

```json
{
  "default": "work",
  "vaults": {
    "work": "D:\\notes",
    "trial": "D:\\tmp\\kiln-sample"
  }
}
```

| Key | Holds |
|---|---|
| `default` | The name of the vault Claude uses when nothing else says which |
| `vaults` | Each vault's name and folder |

To forget a vault, delete its line, or delete the vault folder: kiln then says it is gone and offers your other vaults.

## `KILN_VAULT`

A vault name from the kiln file, or a vault folder, for one terminal or one Herdr workspace:

```bash
export KILN_VAULT=work
```

```powershell
$env:KILN_VAULT = 'work'
```

## How Claude finds the vault

The first answer wins:

1. A folder you name ("capture this to `D:\notes`").
2. The vault holding the current folder: the first folder above it with `_kiln/types/`. In Claudian the session starts in the vault, so this always answers. Inside an Obsidian vault without kiln, Claude stops there and offers `/kiln:setup`.
3. `KILN_VAULT`.
4. The kiln file's `default`.
5. Obsidian's own vault list, when exactly one vault in it has `_kiln/`.
6. Claude asks, lists the candidates and offers to record your answer through `/kiln:setup`.

[Finding the vault](../concepts/finding-the-vault.md) says why the order is this one.

## In each vault

| Path | Holds | Written by |
|---|---|---|
| `_kiln/` | The blueprint: type definitions, templates, views, `properties.md` and its README | `/kiln:setup` |
| `.kiln/blueprint.json` | The plugin version and a hash of the blueprint and of each file setup installed, for re-applying. Hidden from Obsidian | `/kiln:setup` |
| `.kiln/backup/<date and time>/` | A copy of each file and setting setup replaced, one folder per run | `/kiln:setup` |
| `.obsidian/` | Obsidian's and the plugins' settings, with the blueprint's merged in | `/kiln:setup`, and Obsidian |

kiln never writes to a vault's `.claude/` or Claudian's `.claudian/`.

## Claude Code permissions

With your consent, `/kiln:setup` adds to your user settings, `~/.claude/settings.json`: the vault as an additional directory, so a session in another folder can write to it, and "ask first" rules on its `.obsidian/` and `_kiln/`, because writes there can run code inside Obsidian.

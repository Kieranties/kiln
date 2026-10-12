# Skills

kiln's skills come with its [Claude plugin](../guides/install.md) and run from any Claude session: Claudian in Obsidian, or Claude Code in any folder. Each one follows the [vault rules](./vault-rules.md). Ask for one by name, or describe what you want ("re-apply kiln to my vault").

| Skill | What it does | Changes |
|---|---|---|
| `/kiln:setup` | Sets up a vault from the blueprint, re-applies the blueprint after an update, and loads the Northwind Arena sample into a trial vault on request | The vault's `_kiln/` and `.obsidian/`, the type folders, `Home.md` and `Board.base`, and `~/.kiln/config.json`; with your consent, the community plugins and your Claude Code user settings |
| `/kiln:check` | Checks the whole vault, today's changes or the notes you name against their type definitions | Nothing: it reports, then offers fixes |

## `/kiln:setup`

```text
/kiln:setup <vault folder>
/kiln:setup <trial vault folder> with the Northwind Arena sample
```

With no folder named, it finds the vault as [Configuration](./configuration.md#how-claude-finds-the-vault) describes and asks you to confirm it. It runs `kiln-setup.mjs` to plan, shows you what will change, and asks before it:

- installs a missing community plugin through the Obsidian CLI, which needs the vault open in Obsidian;
- replaces a setting or file of yours with the blueprint's (keeping yours is the default);
- writes anything, which needs Obsidian closed;
- adds the vault to your Claude Code permissions, so a session in another folder can write to it.

It suggests turning on Templater's per-device trigger, and reports what changed, what it kept, what waits for Obsidian to close, and where it put the backups (`.kiln/backup/`). Without Node 24, Claude follows "Setting up a vault" in [the blueprint reference](./blueprint.md#setting-up-a-vault) by hand. [Setting up and re-applying](../concepts/setup.md) says how it decides.

## `/kiln:check`

```text
/kiln:check
/kiln:check today's changes
/kiln:check <notes or folders>
```

It runs `kiln-check.mjs` and shows each note with its `error` and `warn` lines: a note in the wrong folder, a type, kind, status or property its definition doesn't have, a missing section, a file name that breaks the type's naming, a new note with `<%`, and links to notes that don't exist yet. Exit code 0 means no errors, 1 errors, 2 wrong arguments. It never changes a note; it offers fixes and makes them only when you agree. kiln's other skills run the same check on the notes they touch ([ADR 0008](../adr/0008-one-note-check-that-never-writes.md)).

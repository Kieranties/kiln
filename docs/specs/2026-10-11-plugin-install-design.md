# Installing kiln's Claude skills

Status: **decided, exploring** (2026-10-11). Nothing here is final.

Part of [Foundation: Claude in the vault](https://github.com/Kieranties/kiln/issues/79), for [#82](https://github.com/Kieranties/kiln/issues/82). kiln's skills reach every session: Claudian, and Claude Code in any folder.

## Decided

### One user-scope plugin

The plugin is installed at user scope, which is the only scope that covers both:

- **Claude Code in any folder.** User-scope plugins load in every session.
- **Claudian.** It runs the user's own `claude` through the Agent SDK, with the vault as the working folder. Its "Load user Claude Code settings" switch is on by default, so user plugins, skills and hooks load there too. The owner has confirmed this from use.

Not used:
- **Enabling the plugin in the vault's `.claude/settings.json`.** That only enables a plugin that is already installed, and Claude Code ignores the vault's settings when the vault isn't trusted.
- **A project-scope install in the vault.** It doesn't reach other folders.

kiln never writes to a vault's `.claude/`.

### Install and update

The same commands work in Bash and pwsh ([repo layout](2026-10-11-repo-layout-design.md)):

```
claude plugin marketplace add Kieranties/kiln
claude plugin install kiln@kiln
```

To update, refresh the catalog, update the plugin, then ask Claude to re-apply the blueprint to the vault ([vault setup](2026-10-11-vault-setup-design.md)):

```
claude plugin marketplace update kiln
claude plugin update kiln@kiln
```

Auto-update is off by default for catalogs outside Anthropic's own. It can be turned on in `/plugin`, but it only runs in interactive terminal sessions, and Claudian never auto-updates. If Claudian-only use drifts behind, add a throttled start-up hook that updates the plugin.

### What the plugin carries

| Part | What it is |
|---|---|
| `blueprint/` | The types, templates, views, root files and settings applied to a vault |
| `reference/vault-rules.md` | The rules every kiln skill follows in a vault (below). Not a skill: nobody runs it |
| `scripts/` | Bundled Node scripts: `kiln-check.mjs`, the setup helper, the vault resolver |
| `skills/setup/` | `/kiln:setup`: set up a vault, re-apply the blueprint, load the sample |
| `skills/check/` | `/kiln:check`: check the whole vault or today's changes |

Skills reach these files through `${CLAUDE_PLUGIN_ROOT}`.

**The vault rules** say how every kiln skill works in a vault:

1. Find the vault with the resolver ([finding the vault](2026-10-11-finding-the-vault-design.md)).
2. Read the note's type definition before changing it.
3. Create notes through QuickAdd, after checking the file doesn't exist.
4. Rename and move through the Obsidian CLI.
5. Never write `<%`.
6. Run `kiln-check` on the notes the flow touched, then fix or report what fails.

### Skill names

Skills use short verbs: `/kiln:setup`, `/kiln:check`, and later `/kiln:capture`, `/kiln:triage` and so on. Each later flow adds its own skill when its story comes up.

kiln's skills show in every session, code repos included, so their descriptions stay tight and trigger only on kiln work. A repo where they are noise can turn the plugin off locally.

### Companion skills

kepano's [Obsidian skills](https://github.com/kepano/obsidian-skills) (`obsidian-cli`, `obsidian-markdown`) are a separate install, documented next to kiln's:

```
claude plugin marketplace add kepano/obsidian-skills
claude plugin install obsidian@obsidian-skills
```

## Open

- Whether the update steps run themselves: a start-up self-update hook for Claudian, if needed.
- Readable versions, if commit-SHA versions prove confusing ([repo layout](2026-10-11-repo-layout-design.md)).

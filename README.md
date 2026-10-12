# kiln

A personal knowledge and work process built on Obsidian: unshaped things in, finished things out.

Obsidian first, then Claude, then everything else. kiln is a vault structure that reads well, the workflows that keep it current, and Claude skills that follow the same process. Why and how: [the vision](docs/vision.md).

## Get started

- **[Getting started](claude-plugin/blueprint/GETTING-STARTED.md):** set up your vault with the kiln blueprint, from an empty folder.
- **[Try the sample](claude-plugin/blueprint/TRY-THE-SAMPLE.md):** see the whole blueprint working with a fictional project, in a trial vault.
- **[The kiln blueprint](claude-plugin/blueprint/README.md):** the types, conventions and how the blueprint is applied.

Each release on GitHub also carries the blueprint as `kiln-blueprint-<version>.zip`.

### The Claude plugin

This repo is also a Claude Code plugin marketplace with one plugin, `kiln`. The plugin carries the blueprint, kiln's skills and the rules every kiln skill follows in a vault. There are two skills so far: `/kiln:setup` sets up a vault from the blueprint, re-applies the blueprint after an update and loads the sample on request, and `/kiln:check` checks a vault's notes, or today's changes, against their type definitions. The commands are the same in Bash and PowerShell.

#### Install

Install it once, for your user (the default), so it reaches every Claude Code session in any folder:

```
claude plugin marketplace add Kieranties/kiln
claude plugin install kiln@kiln
```

[Claudian](https://github.com/YishenTu/claudian), which `/kiln:setup` installs in your vault, runs your own Claude Code inside Obsidian, so it loads the plugin too, as long as its **Load user Claude Code settings** switch is on (the default). Enabling kiln in a vault's `.claude/settings.json` isn't a substitute: it only turns on a plugin that is already installed, Claude Code ignores it in a folder you haven't trusted, and it reaches only that folder.

To try a branch, add the marketplace at that branch instead: `claude plugin marketplace add Kieranties/kiln#some-branch`.

#### Update

Refresh the catalog, then update the plugin:

```
claude plugin marketplace update kiln
claude plugin update kiln@kiln
```

The new version loads in your next session, or after `/reload-plugins`. Then run `/kiln:setup` to re-apply the blueprint to your vault, so the vault's types, templates, views and settings match the new version.

Auto-update is off by default for marketplaces outside Anthropic's own. You can turn it on for `kiln` in `/plugin`, under **Marketplaces**, but it only runs in interactive sessions. Claudian never auto-updates, so if you mostly use Claudian, update from a terminal now and then.

#### Turn it off in one repo

kiln's skills show in every session. In a repo where they are noise, run this in the repo:

```
claude plugin disable kiln@kiln --scope local
```

It writes `"kiln@kiln": false` to the repo's `.claude/settings.local.json`, which applies only to you and only there. `claude plugin enable kiln@kiln --scope local` turns it back on.

#### Companion skills

kepano's [Obsidian skills](https://github.com/kepano/obsidian-skills) teach Claude the Obsidian CLI (`obsidian-cli`) and Obsidian's Markdown (`obsidian-markdown`), among others. kiln's skills work without them. To add them:

```
claude plugin marketplace add kepano/obsidian-skills
claude plugin install obsidian@obsidian-skills
```

## What's in the repo

| Path | What |
|---|---|
| `.claude-plugin/marketplace.json` | The catalog: one plugin, `kiln`, from `./claude-plugin` |
| `claude-plugin/` | The Claude plugin, and nothing else. Its manifest is `claude-plugin/.claude-plugin/plugin.json`, with no version: the plugin's version is the commit |
| `claude-plugin/blueprint/` | The blueprint: type definitions, Templater templates, Bases views, Obsidian and plugin settings, and its guides |
| `claude-plugin/reference/vault-rules.md` | The rules every kiln skill follows in a vault: find the vault, read the type definition, create through QuickAdd, rename through the Obsidian CLI, never write `<%`, check at the end |
| `claude-plugin/skills/` | The plugin's skills, one folder each: `check`, `setup` |
| `claude-plugin/scripts/` | The scripts the skills run, such as `kiln-check.mjs`, `kiln-setup.mjs` and `kiln-vault.mjs`: each one file built from `src/` by `npm run build`, committed, never edited by hand |
| `src/` | The code: `blueprint/` reads a blueprint's definitions, `check/` is the note check, `vault/` finds the vault, `setup/` sets up a vault, `cli/` holds an entry point per script |
| `scripts/` | Repo tooling: `build.mjs` builds the plugin's scripts; `apply-repo-settings.mjs` applies the GitHub merge settings and rulesets (`node scripts/apply-repo-settings.mjs`) |
| `tests/blueprint/` | Checks reading the definitions and the errors for a malformed one, every blueprint file against the definitions, and the sample against both |
| `tests/check/` | Checks the note check, the built `kiln-check.mjs` and the check skill |
| `tests/vault/` | Checks finding the vault: the resolution order, the kiln file, Obsidian's vault list and the built `kiln-vault.mjs` |
| `tests/setup/` | Checks setting up a vault: the generated QuickAdd choices, the settings merges, the three-way re-apply, the sample, the built `kiln-setup.mjs` and the setup skill |
| `tests/plugin/` | Checks the catalog, the plugin manifest and folder, the release zip, the vault rules and every skill, the README's plugin commands, and the living docs' links |
| `tests/fixtures/sample/` | The Northwind Arena sample vault |
| `tests/fixtures/check/` | Broken notes for the note check, laid over the sample |
| `docs/` | The vision, with how the flows hand off, and each layer's design and plan |

## Working on kiln

Node 24 or later. `npm ci`, then before pushing: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run build:check` (after changing `src/`, run `npm run build` and commit the scripts it writes). CI runs the same as its `check` job, which `main` requires. Every merge to `main` is a release: version `0.2.<n>` (the version in `version.json`, then the number of commits since it last changed), tagged `v0.2.<n>`, with the blueprint attached. To start a new minor version, change `version.json`. To check the catalog and the plugin, run `claude plugin validate .`; its warning that the plugin has no version is expected.

kiln 0.1 was a knowledge-base engine (an MCP server, a SQLite index and a CLI). It was removed in 0.2; the vision's "What v1 taught us" says why. It remains in the git history and the `v0.1.1` tag.

## License

MIT

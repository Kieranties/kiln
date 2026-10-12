# The repo

What is where in [Kieranties/kiln](https://github.com/Kieranties/kiln), and how to work on it. [ADR 0007](../adr/0007-products-live-in-host-plugin-folders.md) says why it is laid out this way.

| Path | What |
|---|---|
| `.claude-plugin/marketplace.json` | The catalog: one plugin, `kiln`, from `./claude-plugin` |
| `claude-plugin/` | The Claude plugin, and nothing else. Its manifest is `claude-plugin/.claude-plugin/plugin.json`, with no version: the plugin's version is the commit |
| `claude-plugin/blueprint/` | The blueprint: type definitions, Templater templates, Bases views, Obsidian and plugin settings, `properties.md` and its README |
| `claude-plugin/reference/vault-rules.md` | The [vault rules](./vault-rules.md) every kiln skill follows |
| `claude-plugin/skills/` | The plugin's [skills](./skills.md), one folder each: `check`, `setup` |
| `claude-plugin/scripts/` | The scripts the skills run, such as `kiln-check.mjs`, `kiln-setup.mjs` and `kiln-vault.mjs`: each one file built from `src/` by `npm run build`, committed, never edited by hand |
| `src/` | The code: `blueprint/` reads a blueprint's definitions, `check/` is the note check, `vault/` finds the vault, `setup/` sets up a vault, `cli/` holds an entry point per script |
| `scripts/` | Repo tooling: `build.mjs` builds the plugin's scripts; `apply-repo-settings.mjs` applies the GitHub merge settings and rulesets (`node scripts/apply-repo-settings.mjs`) |
| `tests/` | One folder per folder of `src/`; `tests/blueprint/` also checks every blueprint file against the definitions and the sample against both, and `tests/plugin/` checks the catalog, the plugin, the release, the skills and the docs' links and words. Shared helpers are in `tests/support/` |
| `tests/fixtures/sample/` | The Northwind Arena sample vault |
| `tests/fixtures/check/` | Broken notes for the note check, laid over the sample |
| `docs/` | This site: guides, reference, concepts and decisions (`adr/`). `docs/agents/` is for the engineering skills, and isn't published |
| `GLOSSARY.md` | The canonical language for the repo, its docs, issues and skills |

## Working on kiln

Node 24 or later. `npm ci`, then before pushing: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run build:check`. After changing `src/`, run `npm run build` and commit the scripts it writes. CI runs the same as its `check` job, which `main` requires. To check the catalog and the plugin, run `claude plugin validate .`; its warning that the plugin has no version is expected.

Work goes issue, then PR. Design is discussed in the issue; plans aren't committed. An [ADR](../adr/0001-remove-the-v0-1-engine.md) records a decision only when it is hard to reverse, surprising without context, and the result of a real trade-off.

## Releases

Every merge to `main` is a release: version `0.2.<n>` (the version in `version.json`, then the number of commits since it last changed), tagged `v0.2.<n>`, with the blueprint attached as `kiln-blueprint-<version>.zip`. To start a new minor version, change `version.json`. [ADR 0006](../adr/0006-each-product-versions-the-way-its-host-expects.md) says why.

kiln 0.1 was a knowledge-base engine (an MCP server, a SQLite index and a CLI). It was removed in 0.2 ([ADR 0001](../adr/0001-remove-the-v0-1-engine.md)), and remains in the git history and the `v0.1.1` tag.

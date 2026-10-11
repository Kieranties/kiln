# kiln

A personal knowledge and work process built on Obsidian: unshaped things in, finished things out.

Obsidian first, then Claude, then everything else. kiln is a vault structure that reads well, the workflows that keep it current, and Claude skills that follow the same process. Why and how: [the vision](docs/vision.md).

## Get started

- **[Getting started](claude-plugin/blueprint/GETTING-STARTED.md):** set up your vault with the kiln blueprint, from an empty folder.
- **[Try the sample](claude-plugin/blueprint/TRY-THE-SAMPLE.md):** see the whole blueprint working with a fictional project, in a trial vault.
- **[The kiln blueprint](claude-plugin/blueprint/README.md):** the types, conventions and how the blueprint is applied.

Each release on GitHub also carries the blueprint as `kiln-blueprint-<version>.zip`.

### The Claude plugin

This repo is also a Claude Code plugin marketplace with one plugin, `kiln`. The commands are the same in Bash and PowerShell:

```
claude plugin marketplace add Kieranties/kiln
claude plugin install kiln@kiln
```

For now the plugin carries only the blueprint; its skills come with later work. To try a branch, add the marketplace at that branch instead: `claude plugin marketplace add Kieranties/kiln#some-branch`.

## What's in the repo

| Path | What |
|---|---|
| `.claude-plugin/marketplace.json` | The catalog: one plugin, `kiln`, from `./claude-plugin` |
| `claude-plugin/` | The Claude plugin, and nothing else. Its manifest is `claude-plugin/.claude-plugin/plugin.json`, with no version: the plugin's version is the commit |
| `claude-plugin/blueprint/` | The blueprint: type definitions, Templater templates, Bases views, Obsidian and plugin settings, and its guides |
| `tests/kit/` | Checks every blueprint file against the type definitions, and the sample against both |
| `tests/plugin/` | Checks the catalog, the plugin manifest and folder, the release zip, and the living docs' links |
| `tests/fixtures/layer1/` | The Northwind Arena sample vault |
| `docs/` | The vision, the user flows and story order, and each layer's design and plan |

## Working on kiln

Node 24 or later. `npm ci`, then before pushing: `npm run format:check`, `npm run lint`, `npm run typecheck` and `npm test`. CI runs the same as its `check` job, which `main` requires. Every merge to `main` is a release: version `0.2.<n>` (the version in `version.json`, then the number of commits since it last changed), tagged `v0.2.<n>`, with the blueprint attached. To start a new minor version, change `version.json`. To check the catalog and the plugin, run `claude plugin validate .`; its warning that the plugin has no version is expected.

kiln 0.1 was a knowledge-base engine (an MCP server, a SQLite index and a CLI). It was removed in 0.2; the vision's "What v1 taught us" says why. It remains in the git history and the `v0.1.1` tag.

## License

MIT

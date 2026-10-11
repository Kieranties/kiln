# kiln

A personal knowledge and work process built on Obsidian: unshaped things in, finished things out.

Obsidian first, then Claude, then everything else. kiln is a vault structure that reads well, the workflows that keep it current, and Claude skills that follow the same process. Why and how: [the vision](docs/vision.md).

## Get started

- **[Getting started](kit/GETTING-STARTED.md):** set up your vault with the kiln kit, from an empty folder.
- **[Try the sample](kit/TRY-THE-SAMPLE.md):** see the whole kit working with a fictional project, in a trial vault.
- **[The kiln kit](kit/README.md):** the types, conventions and how the kit is applied.

Each release on GitHub also carries the kit as `kiln-kit-<version>.zip`.

## What's in the repo

| Path | What |
|---|---|
| `kit/` | The kit: type definitions, Templater templates, Bases views, Obsidian and plugin settings, and its guides |
| `tests/kit/` | Checks every kit file against the type definitions, and the sample against both |
| `tests/fixtures/layer1/` | The Northwind Arena sample vault |
| `docs/` | The vision, the user flows and story order, and each layer's design and plan |

## Working on kiln

Node 24 or later. `npm ci`, then before pushing: `npm run format:check`, `npm run lint`, `npm run typecheck` and `npm test`. CI runs the same, and `main` requires them. Every green push to `main` is a release, versioned by [nbgv](https://github.com/dotnet/Nerdbank.GitVersioning) from `version.json`.

kiln 0.1 was a knowledge-base engine (an MCP server, a SQLite index and a CLI). It was removed in 0.2; the vision's "What v1 taught us" says why. It remains in the git history and the `v0.1.1` tag.

## License

MIT

# kiln

A personal knowledge and work system: unshaped things in, finished things out. Owner: Kieranties (public repo).

## Start here

| What | Where |
|---|---|
| **Why kiln exists, principles, entities, types and kinds, layers** | [docs/vision.md](docs/vision.md) |
| **User flows and the agreed story order** | [docs/specs/2026-10-11-user-flows.md](docs/specs/2026-10-11-user-flows.md) |
| **Layer 1, the vault structure: design and plan** | [design](docs/specs/2026-10-11-layer-1-structure-design.md), [plan](docs/plans/2026-10-11-layer-1-structure.md) |
| **The kit** (types, templates, views, settings), its guides and checks | [kit/README.md](kit/README.md), [Getting started](kit/GETTING-STARTED.md), [Try the sample](kit/TRY-THE-SAMPLE.md); tests in `tests/kit/` |

kiln 0.1 (an MCP server, SQLite index and CLI) was removed in 0.2. It is in the git history and the `v0.1.1` tag; the vision's "What v1 taught us" says why.

## Working rules

- **Everything is exploratory.** Present choices as current direction, never as final, and revisit them when the evidence changes.
- **Confirm scope before broad changes.** When asked to investigate, investigate; don't jump to fixes.
- **Obsidian first, then Claude, then everything else.** New work follows the layers in the vision. Notes are shaped for a person reading them in Obsidian.
- **The kit's type definitions are the source of truth.** Change a definition, then everything written from it; `npx vitest run tests/kit` names anything out of step.
- **No real knowledge in this repo, its tests or its docs.** Test data and doc examples use the fictional "Northwind Arena" organisation in `tests/fixtures/`. Never copy notes from the owner's own vault into the repo.
- **Archive, never delete.** Notes are retired through their `status`.
- **Writes are targeted.** Change only the frontmatter keys and sections you mean to change.

## Environment

- Windows 11; Git Bash is the shell (MSYS `/x/...` paths in Bash, `X:\...` in the file tools). Use `pwsh`, never `powershell`.
- Node 24. TypeScript 7 ESM, vitest, oxlint (type-aware), Prettier.
- **Before pushing:** `npm run format:check`, `npm run lint`, `npm run typecheck` and `npm test`. CI runs the same and `main` requires them. Every green push to `main` is a release with the kit attached as a zip.
- Machine-specific notes (drives, scratch folders, registries) go in your own `CLAUDE.local.md`, which is gitignored.
- **npm:** the user's global npm registry may be a private one. This repo's `.npmrc` must set `registry=https://registry.npmjs.org/`. If a global install is needed, pass `--userconfig` pointing at a clean npmrc.

# kiln

A personal knowledge and work system: unshaped things in, finished things out. Owner: Kieranties (public repo).

## Start here

| What | Where |
|---|---|
| **The language and the decisions**: canonical terms, and why kiln is shaped the way it is | [GLOSSARY.md](GLOSSARY.md), [docs/adr/](docs/adr/). Where an older doc below disagrees with an ADR, the ADR wins |
| **Why kiln exists, principles, entities, types and kinds, layers** | [docs/vision.md](docs/vision.md) |
| **User flows** | Each flow's epic on GitHub (label `epic`); how they hand off is in [docs/vision.md](docs/vision.md#flows). Board order is the priority |
| **Layer 1, the vault structure: design and plan** | [design](docs/specs/2026-10-11-layer-1-structure-design.md), [plan](docs/plans/2026-10-11-layer-1-structure.md) |
| **Foundation: Claude in the vault (#79)**, one design note per sub-issue | [vault access](docs/specs/2026-10-11-vault-access-design.md), [repo layout](docs/specs/2026-10-11-repo-layout-design.md), [note check](docs/specs/2026-10-11-note-check-design.md), [finding the vault](docs/specs/2026-10-11-finding-the-vault-design.md), [plugin install](docs/specs/2026-10-11-plugin-install-design.md), [vault setup](docs/specs/2026-10-11-vault-setup-design.md) |
| **The blueprint** (types, templates, views, settings), its guides and checks | [claude-plugin/blueprint/README.md](claude-plugin/blueprint/README.md), [Getting started](claude-plugin/blueprint/GETTING-STARTED.md), [Try the sample](claude-plugin/blueprint/TRY-THE-SAMPLE.md); tests in `tests/blueprint/` |
| **The Claude plugin** and its catalog | `claude-plugin/` (manifest in `claude-plugin/.claude-plugin/plugin.json`), the catalog in `.claude-plugin/marketplace.json`, and the [repo layout](docs/specs/2026-10-11-repo-layout-design.md); tests in `tests/plugin/` |

The blueprint was called the kit, at the repo root, until #105. The dated plans and the design notes still call it the kit.

kiln 0.1 (an MCP server, SQLite index and CLI) was removed in 0.2. It is in the git history and the `v0.1.1` tag; the vision's "What v1 taught us" says why.

## Working rules

- **Everything is exploratory.** Present choices as current direction, never as final, and revisit them when the evidence changes.
- **Confirm scope before broad changes.** When asked to investigate, investigate; don't jump to fixes.
- **Obsidian first, then Claude, then everything else.** New work follows the layers in the vision. Notes are shaped for a person reading them in Obsidian.
- **The blueprint's type definitions are the source of truth.** Change a definition, then everything written from it; `npx vitest run tests/blueprint` names anything out of step.
- **No real knowledge in this repo, its tests or its docs.** Test data and doc examples use the fictional "Northwind Arena" organisation in `tests/fixtures/`. Never copy notes from the owner's own vault into the repo.
- **Archive, never delete.** Notes are retired through their `status`.
- **Writes are targeted.** Change only the frontmatter keys and sections you mean to change.

## How work moves

- **An issue, then a PR.** Design discussion lives in the issue's body and comments. A plan you write to do the work is a working file: keep it in scratch, and put what a reviewer needs in the PR body. Each PR closes or advances its issue.
- **The glossary changes with the work.** Use its terms in code, docs, issues and skills, and add or sharpen a term in the same PR that settles it.
- **An ADR only when a decision is hard to reverse, surprising without context, and the result of a real trade-off.** Add the next number in `docs/adr/`. An accepted ADR is superseded by a new one, never rewritten.
- **The dated specs and plans in `docs/` are being retired** into ADRs, guides and the docs site. Leave them as they are; new design goes in issues.

## Agent skills

### Issue tracker

GitHub Issues on Kieranties/kiln, ordered on project board 5. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage roles, as state labels next to the kind labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.

## Environment

- Windows 11; Git Bash is the shell (MSYS `/x/...` paths in Bash, `X:\...` in the file tools). Use `pwsh`, never `powershell`.
- Node 24. TypeScript 7 ESM, vitest, oxlint (type-aware), Prettier.
- **Before pushing:** `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run build:check`. CI runs the same as its `check` job, which `main` requires. Every merge to `main` is a release, tagged `v<version.json>.<n>`, with the blueprint attached as a zip.
- **Code** is in `src/`. `npm run build` bundles each `src/cli/<name>.ts` into `claude-plugin/scripts/<name>.mjs`, one file with its dependencies; commit the bundle with its source. The plugin has no `package.json`.
- **The plugin:** `claude plugin validate .` checks the catalog and the plugin; its warning that the plugin has no version is expected. To try an install, point `CLAUDE_CONFIG_DIR` at a throwaway folder first, so your own Claude Code config is never touched.
- Machine-specific notes (drives, scratch folders, registries) go in your own `CLAUDE.local.md`, which is gitignored.
- **npm:** the user's global npm registry may be a private one. This repo's `.npmrc` must set `registry=https://registry.npmjs.org/`. If a global install is needed, pass `--userconfig` pointing at a clean npmrc.

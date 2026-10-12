# kiln

A personal knowledge and work system: unshaped things in, finished things out. Owner: Kieranties (public repo).

## Start here

| What | Where |
|---|---|
| **The language and the decisions** | [GLOSSARY.md](GLOSSARY.md), [docs/adr/](docs/adr/). Where a doc disagrees with an ADR, the ADR wins |
| **Why kiln exists, and how it works** | [docs/concepts/](docs/concepts/): the vision, how notes are shaped, Claude in the vault, finding the vault, setting up and re-applying |
| **What exists and its exact shape** | [docs/reference/](docs/reference/): the blueprint, the vault rules, the skills, configuration and the repo layout |
| **How to use kiln** | [docs/guides/](docs/guides/) |
| **Flows not yet built** | Their epics on GitHub (label `epic`). Board order is the priority |
| **The blueprint** | `claude-plugin/blueprint/`: its README and `properties.md` are read by Claude in a vault; tests in `tests/blueprint/` |
| **The Claude plugin** | `claude-plugin/`, with its catalog in `.claude-plugin/marketplace.json`; tests in `tests/plugin/` |

## Working rules

- **Everything is exploratory.** Present choices as current direction, never as final, and revisit them when the evidence changes.
- **Confirm scope before broad changes.** When asked to investigate, investigate; don't jump to fixes.
- **Obsidian first, then Claude, then everything else.** Notes are shaped for a person reading them in Obsidian.
- **The blueprint's type definitions are the source of truth.** Change a definition, then everything written from it; `npx vitest run tests/blueprint` names anything out of step.
- **No real knowledge in this repo, its tests or its docs.** Test data and doc examples use the fictional "Northwind Arena" organisation in `tests/fixtures/`. Never copy notes from the owner's own vault into the repo.
- **Archive, never delete.** Notes are retired through their `status`.
- **Writes are targeted.** Change only the frontmatter keys and sections you mean to change.

## How work moves

- **An issue, then a PR.** Design discussion lives in the issue's body and comments. A plan you write to do the work is a working file: keep it in scratch, and put what a reviewer needs in the PR body. Each PR closes or advances its issue.
- **The glossary changes with the work.** Use its terms in code, docs, issues and skills, and add or sharpen a term in the same PR that settles it.
- **An ADR only when a decision is hard to reverse, surprising without context, and the result of a real trade-off.** Add the next number in `docs/adr/`. An accepted ADR is superseded by a new one, never rewritten.
- **Docs are guides, reference, concepts and decisions,** published from `docs/` as the docs site. Each fact has one home. A flow's design stays in its epic until the flow is built, then it gets a guide. `docs/agents/` is for the engineering skills and isn't published.

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
- **Building, checking and releasing:** [docs/reference/repo.md](docs/reference/repo.md) says how: the checks to run before pushing (CI's `check` job, which `main` requires), building `src/` into the Claude plugin's scripts, trying an install, and releases.
- Machine-specific notes (drives, scratch folders, registries) go in your own `CLAUDE.local.md`, which is gitignored.
- **npm:** the user's global npm registry may be a private one. This repo's `.npmrc` must set `registry=https://registry.npmjs.org/`. If a global install is needed, pass `--userconfig` pointing at a clean npmrc.

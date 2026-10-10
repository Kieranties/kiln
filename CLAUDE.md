# kiln

A personal knowledge and work system: unshaped things in, finished things out. Owner: Kieranties (private repo).

## Start here

| What | Where |
|---|---|
| Why kiln exists, principles, work model | [docs/vision.md](docs/vision.md) |
| **Current design (lean v1)** | [docs/specs/2026-10-10-kb-core-design.md](docs/specs/2026-10-10-kb-core-design.md) |
| **Implementation plan** | [docs/plans/2026-10-10-kb-core-v1.md](docs/plans/2026-10-10-kb-core-v1.md) |
| How we got here: decisions, preferences, open questions | [docs/context/2026-10-10-decision-log.md](docs/context/2026-10-10-decision-log.md) |
| Evidence | [landscape research](docs/research/2026-10-10-knowledge-landscape.md), [spike results](docs/research/2026-10-10-spike-results.md) |

## Working rules

- **Everything is exploratory.** Present choices as current direction, never as final, and revisit them when the evidence changes.
- **Confirm scope before broad changes.** When asked to investigate, investigate; don't jump to fixes.
- **No real knowledge in this repo or its tests.** Realistic test data is generated, using the fictional "Northwind Arena" organisation in `tests/fixtures/`. Never copy notes from the owner's own vault into the repo.
- **The kiln core is deterministic.** No LLM calls, no network, no external credentials in kiln code. Judgement lives in the Claude skills.
- **No deletes.** kiln archives via `status` and dismisses via `triage`.
- **Writes are byte-preserving.** Change only the targeted frontmatter keys and sections.
- **Before building, check the plan's stop conditions.** Stop and report instead of working around:
  - `node:sqlite` lacks FTS5 or contentless delete;
  - a golden-set category has recall@5 below 0.6 at baseline;
  - a scale target is missed.

## Environment

- Windows 11; Git Bash is the shell (use `/d/...` paths in Bash and `D:\...` in the file tools). Use `pwsh`, never `powershell`.
- Node 24 (`node:sqlite`). TypeScript ESM, vitest.
- **npm:** the user's global npm registry may be a private one. This repo's `.npmrc` must set `registry=https://registry.npmjs.org/`. If a global install is needed, pass `--userconfig` pointing at a clean npmrc.

## Commits

End commit messages with the attribution trailer given in the session's instructions. PR descriptions end with the Claude Code footer.

# Build and release: design

Status: agreed in conversation 2026-10-11, awaiting spec review. Everything here is current direction. Revisit it when the evidence changes.

## Goal

Every change to kiln is linted, formatted, type-checked and tested on Windows and Linux. Every green commit on `main` is a versioned release, and users install kiln from that release instead of building from a checkout. This removes the "never install from a worktree" hazard. The getting-started guide follows the release path.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Versioning | nbgv (`nerdbank-gitversioning` npm package). `version.json` holds `major.minor`. The patch is the git height. | Matches how the owner versions other repos. No commits back to the repo, no release PRs. |
| Release trigger | Every green push to `main` releases. PRs build and test but never publish. | Trunk-based. `main` is always releasable. |
| Merge method | Squash only, with the PR title as the commit title | One commit per PR, so one patch number per PR. Conventional PR titles carry through. |
| CLI hosting | GitHub Packages npm registry (`@kieranties/kiln`), plus the `.tgz` attached to a GitHub Release | Packages supports `npm update`. The Release tarball needs no npm token. |
| Plugin | No `version` in `plugin.json`. The marketplace is added from `Kieranties/kiln` (that is, `main`). | Claude Code then uses the commit SHA as the plugin version, so the plugin updates with `main`. |
| Container | None | kiln is a local CLI and hook binary that reads local folders. A container adds nothing. |
| Lint | oxlint with `oxlint-tsgolint@7` (`--type-aware`) | typescript-eslint cannot load TypeScript 7, which has no in-process JS API. tsgolint is built on the TS 7 compiler and covers nearly all typescript-eslint type-aware rules. |
| Type check | `tsc --noEmit` over `src/`, `tests/` and `scripts/` | Today only `src/` is type-checked, by the build. |
| Format | Prettier 3 | oxfmt is pre-1.0. Prettier bundles its own TypeScript parser, so TS 7 does not affect it. |
| Repo rules | Rulesets for `main` and `v*` tags, kept as code. The repo becomes public, which makes rulesets available on the Free plan. | Enforces PR-only changes and green checks. |

### Known gaps, accepted

- **The plugin can be one commit ahead of the CLI.** A merge updates the plugin at once. The CLI updates when that commit's release publishes. If a `main` build fails, the plugin is ahead until a fix lands.
- **Plugin and CLI are separate installs.** Updating one and not the other can leave the plugin calling a command the CLI lacks. The guide makes "update both" a single step. A version handshake at session start is a follow-up issue, not part of this work.
- **Installing from GitHub Packages needs a token** with `read:packages`, even for a public package. The Release tarball is the no-token route.

## Versioning

- `version.json` at the repo root:

  ```json
  {
    "$schema": "https://raw.githubusercontent.com/dotnet/Nerdbank.GitVersioning/main/src/NerdBank.GitVersioning/version.schema.json",
    "version": "0.1",
    "publicReleaseRefSpec": ["^refs/heads/main$"]
  }
  ```

- On `main` the version is `0.1.<height>`. Elsewhere it is `0.1.<height>-g<sha>`.
- To bump major or minor, change `version.json` in a PR. The height resets.
- `package.json` commits nbgv's placeholder version (`0.0.0-placeholder`). CI stamps the real version with `nbgv-setversion` before packing. The MCP server already reports `package.json`'s version, so a released CLI reports its release number.
- nbgv needs the full history (`fetch-depth: 0`) and a .NET 8+ runtime. Local `npm run build` and `npm test` need neither; only stamping does.

## Package

`package.json` changes:

- `name`: `@kieranties/kiln`. `private` is removed.
- `repository`: `git+https://github.com/Kieranties/kiln.git`. GitHub Packages links the package to the repo through it.
- `publishConfig.registry`: `https://npm.pkg.github.com`.
- `files`: `["dist"]`. The README and `package.json` are always included.
- New scripts: `lint`, `typecheck`, `format`, `format:check`.
- `build` becomes `tsc -p tsconfig.build.json`.

`tsconfig.json` becomes the type-check config: `noEmit`, covering `src/`, `tests/`, `scripts/` and `vitest.config.ts`. oxlint's type-aware rules read it. `tsconfig.build.json` extends it and emits `src/` to `dist/`.

## Workflow: `.github/workflows/ci.yml`

Runs on `pull_request` to `main` and `push` to `main`. The default token permission is `contents: read`. Each job asks only for what it needs.

| Job | Runner | Steps |
|---|---|---|
| `lint` | ubuntu | `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `claude plugin validate` on the marketplace and the plugin |
| `test` | matrix: ubuntu, windows; Node 24 | `npm ci`, `npm test` (builds, then runs the whole suite including the retrieval eval) |
| `package` | ubuntu, `fetch-depth: 0` | `npm ci`, `npm run build`, stamp the version with nbgv (`package.json` only), `npm pack`, upload the `.tgz` as a workflow artifact. Outputs the version. |
| `release` | ubuntu; push to `main` only; needs `lint`, `test`, `package` | Download the `.tgz`. Publish to GitHub Packages unless that version already exists. Create the GitHub Release `v<version>` at the commit, with generated notes and the `.tgz`, unless it already exists. Permissions: `contents: write`, `packages: write`. |

- **Concurrency.** PR runs cancel superseded runs on the same branch. `main` runs never cancel. The `release` job runs in a single `release` group, one at a time.
- **Idempotent release.** Each step checks before acting, so re-running a failed `release` job finishes the work without failing on what is already done.
- **Actions** are pinned to current majors: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-dotnet@v6`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`.
- **Publishing auth.** `setup-node` with `registry-url: https://npm.pkg.github.com` and `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. No other secrets.
- The test job's run time is about 7 s locally. CI cost is small.

## Lint and format

- **oxlint**: `oxlint --type-aware` with a committed `.oxlintrc.json`: the default rule set plus the recommended type-aware rules. It ignores `dist/`, `node_modules/` and `tests/fixtures/`.
- **Prettier**: `.prettierrc.json` with `singleQuote: true`, `semi: true`, `printWidth: 120`, `endOfLine: "auto"`. `.prettierignore` covers Markdown, `tests/fixtures/`, `package-lock.json`, `dist/` and `node_modules/`. It formats `.ts`, `.json`, `.yml` and `.yaml`.
- **The one-off reformat** ships in this work. `main` is squash-only, so it shares a commit with the other changes, and there is no `.git-blame-ignore-revs`.
- **Existing lint findings** are fixed in this work. If they turn out to be extensive, stop and report instead of piling fixes in.

## Repo settings and rulesets

Kept as code under `.github/rulesets/` and applied by `scripts/apply-repo-settings.sh` with `gh api`. The script is idempotent: it updates a ruleset with the same name and creates one otherwise.

- **Repo settings:**
  - squash merge only, with the PR title and body;
  - delete head branches after merge;
  - workflow token read-only by default (already set).
- **`main` ruleset:**
  - changes only through a PR, with 0 required approvals;
  - required checks `lint`, `test (ubuntu-latest)`, `test (windows-latest)` and `package`, not strict;
  - linear history;
  - no force-push and no deletion;
  - no bypass actors.
- **`v*` tag ruleset:** no update and no deletion. Creation stays open, so the release job can tag.

## Documentation

- **Getting started** becomes install-from-release:
  1. prerequisites;
  2. the GitHub Packages token: use `gh auth refresh -s read:packages` and `gh auth token` if that works, otherwise a classic PAT, plus the `@kieranties` scope line;
  3. `npm i -g @kieranties/kiln`, with `--registry https://registry.npmjs.org/` when your default registry is private, and the Release tarball as the fallback;
  4. the plugin: `claude plugin marketplace add Kieranties/kiln`, including private-git auth notes;
  5. turn on plugin auto-update (`/plugin` → Marketplaces → kiln), or update manually;
  6. a single "update kiln" step that updates the CLI, then the plugin;
  7. troubleshooting, with a new row for a plugin and CLI that are out of step;
  8. uninstall.
- **README**:
  - Install points to the guide;
  - a new "Developing kiln" section takes the clone, `npm link` and local-marketplace route, with the worktree warning;
  - a new "Versioning and releases" section;
  - Checks gains lint, format and type check.
- **CLAUDE.md**: the Environment section loses machine-specific detail. Machine detail lives in each developer's `CLAUDE.local.md`, which is now gitignored.

## Out of scope

- The CLI/plugin version handshake. To be filed as an issue.
- Dependabot.
- A container image.
- Publishing to the public npm registry.

## Verification

- A PR from this work runs `lint`, `test` (both OSes) and `package` green, and the uploaded `.tgz` installs globally and runs `kiln status`.
- After merge, `main` publishes `v0.1.<n>`. A clean machine install following the guide works: Packages route, tarball route, plugin from `Kieranties/kiln`, `claude mcp list` shows kiln connected.
- Re-running the `release` job on the same commit succeeds without publishing twice.
- With rulesets applied, a direct push to `main` is rejected.

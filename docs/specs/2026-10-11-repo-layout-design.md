# Repo layout: the Claude plugin, the blueprint and later code

Status: **decided, exploring** (2026-10-11). Nothing here is final.

Part of [Foundation: Claude in the vault](https://github.com/Kieranties/kiln/issues/79), for [#105](https://github.com/Kieranties/kiln/issues/105). It replaces the first attempt, #78, which made `kit/` the plugin root.

## Decided

### The layout

```
.claude-plugin/
  marketplace.json      the catalog: one plugin, source ./claude-plugin
claude-plugin/          the plugin, and nothing else
  .claude-plugin/
    plugin.json
  blueprint/            what was kit/: types, templates, views, root files, settings
  reference/            shared rules the skills read (vault rules)
  scripts/              bundled Node scripts (kiln-check.mjs, the setup helper)
  skills/               setup, check, and later capture, triage, ...
src/                    later code: the checker's source, a kiln service, an Obsidian plugin
tests/                  tests/kit reads claude-plugin/blueprint/
docs/
```

- **The plugin is its own folder,** `claude-plugin/`. Watch the near-collision: the repo root's `.claude-plugin/` holds the catalog, and `claude-plugin/.claude-plugin/` holds the plugin's manifest.
- **The kit is renamed the blueprint,** and `claude-plugin/blueprint/` is its only copy. `tests/kit` reads it there; in a trial, moving the kit and changing one path in `tests/kit/load.ts` gave the same result (76 passed, 1 skipped). A vault still receives it into `_kiln/`.
- **Later code goes in `src/`.** Nothing moves when it arrives.

Ruled out:
- A symlink from the plugin to a root `kit/`. Git for Windows checks symlinks out as text, so the plugin shipped a 6-byte file instead of its kit.
- A copy kept in step by a sync check. That is two copies to maintain.
- The repo root as the plugin. Claude Code would copy docs and tests into its cache and install the root `package.json` (#78).

### Install

The catalog uses a relative source, `./claude-plugin`. The commands are the same in Bash and pwsh:

```
claude plugin marketplace add Kieranties/kiln
claude plugin install kiln@kiln
```

To test a branch, add the marketplace at that branch:

```
claude plugin marketplace add Kieranties/kiln#some-branch
```

The marketplace clone is the whole repo, but it is a shallow clone and small (about 110 KiB in a trial), and only `claude-plugin/` reaches Claude Code's plugin cache. #105 first asked for an install that never fetches the whole repo. That needs `git-subdir` or `--sparse`, and sparse paths are saved into users' settings, so they go stale when folders move, which is what broke 0.1. The requirement is dropped.

### Versions

There is no `version` in `plugin.json`, so Claude Code uses the commit SHA. Every merge to `main` is already a release (tagged `v<version.json>.<n>`), so a plugin update is a release. Docs-only merges count as updates too.

Later, if readable versions matter, the release workflow can stamp `version.json`'s version into the plugin on a `stable` branch that the catalog tracks.

### Bundled code

Claude Code doesn't build a plugin when installing it. If the plugin's root had a `package.json` and a lockfile, Claude Code would run `npm install` on every install, and that fails behind a private or expired npm registry. So code the plugin runs is built from `src/` into single `.mjs` files in `claude-plugin/scripts/`, with dependencies such as `yaml` inlined. The bundles are committed, and CI checks that they match `src/`.

Node 24 is a prerequisite for kiln's scripts. Installing Claude doesn't bring Node: the native installer and the npm package both install a standalone binary. When Node is missing, each skill falls back to Claude doing the step by hand.

### The sample

The Northwind Arena sample (`tests/fixtures/layer1`) stays where it is. Setup fetches it only when the owner asks for it, pinned to the plugin's commit, so the sample and the blueprint always match.

### Docs

The dated [layer 1 plan](../plans/2026-10-11-layer-1-structure.md) stays as written. The living docs move with the rename: the README, `CLAUDE.md`, the layer 1 design and the kit guides.

## Open

- **When to stamp versions.** Only if commit-SHA versions prove confusing.
- **A separate `kiln-sample` plugin** in the same catalog, instead of fetching the sample. It would be versioned with the blueprint and need no git when it runs.
- **The folder name, if an Obsidian plugin arrives.** It goes in `src/obsidian/` or `obsidian/`; `claude-plugin/` already says who it is for.

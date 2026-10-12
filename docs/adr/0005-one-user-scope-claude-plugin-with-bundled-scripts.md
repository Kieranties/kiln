---
status: accepted
---

# One user-scope Claude plugin, with its scripts bundled and committed

The Claude plugin is installed at user scope from this repo's marketplace, because that is the only scope that reaches both Claude Code in any folder and Claudian, which runs the owner's own Claude Code inside Obsidian. kiln never writes to a vault's `.claude/`. Claude Code installs a plugin by copying its folder, with no build step, and runs `npm install` when the folder has a `package.json` and a lockfile, which fails behind a private or expired registry. So the code the plugin runs is bundled from `src/` into single `.mjs` files in `claude-plugin/scripts/`, dependencies inlined, committed, and checked against `src/` in CI.

## Considered options

- **Enabling the plugin in a vault's `.claude/settings.json`.** It only turns on a plugin that is already installed, and Claude Code ignores it in a folder that isn't trusted.
- **A project-scope install in the vault.** It doesn't reach other folders.
- **The repo root as the plugin.** Claude Code would copy the docs and tests into its cache and install the root `package.json`.

## Consequences

- Node 24 is a prerequisite for the scripts. Each skill falls back to Claude doing the step by hand when Node is missing.
- After changing `src/`, run `npm run build` and commit the scripts it writes.

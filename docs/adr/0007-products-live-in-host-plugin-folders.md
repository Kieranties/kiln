---
status: accepted
---

# Products live in `<host>-plugin/` folders, with one `src/`

Each kiln product is a top-level folder named for where it runs: `claude-plugin/` now, `obsidian-plugin/` if one arrives. A product folder holds what ships: hand-written content (skills, the blueprint, a manifest) and the output built from `src/`. All code lives in one `src/` with one toolchain, split into shared and per-product folders only when a second product needs it. The built output stays committed on `main`, so `claude plugin marketplace add Kieranties/kiln#<branch>` can try any branch.

## Considered options

- **npm workspaces (`packages/*`).** Each member needs a `package.json`, and a Claude plugin folder with a `package.json` and a lockfile triggers `npm install` on every install ([ADR 0005](0005-one-user-scope-claude-plugin-with-bundled-scripts.md)).
- **A `stable` branch that CI builds and the catalog tracks.** It keeps built files off `main` and allows stamped versions, but it changes the install command, makes the plain repo install an unbuilt plugin, and needs preview branches for testing.
- **A top-level `blueprint/` copied into the Claude plugin.** The blueprint isn't Claude's, but the plugin can only use files inside its own folder. A copy doubles every blueprint diff. A symlink was tried: Git for Windows checks symlinks out as text, and the plugin shipped a 6-byte file.

## Consequences

- The blueprint stays in `claude-plugin/blueprint/`. **Revisit** when an Obsidian plugin needs to read it.
- **Revisit** the release branch when built output gets large or noisy (an Obsidian plugin's `main.js` is the likely case), or when readable versions matter.
- A product may move to a repo of its own later. No trigger is set.

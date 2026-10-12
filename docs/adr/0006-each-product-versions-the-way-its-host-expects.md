---
status: accepted
---

# Each product versions the way its host expects

kiln's products version independently, each the way its host installs and updates it. The Claude plugin has no `version` in its `plugin.json`, so Claude Code uses the commit: every merge to `main` is a release, tagged `v<version.json>.<n>` with the blueprint attached as a zip, and a plugin update is a release. Readable version numbers weren't worth a second source of truth while one person uses kiln.

## Consequences

- Docs-only merges also count as plugin updates.
- An Obsidian plugin, if one is listed in Obsidian's community directory, needs semver releases with bare `x.y.z` tags that match its `manifest.json`, and that `manifest.json` at the repo root. That is acceptable alongside the Claude plugin's `v`-prefixed tags.
- If readable versions come to matter for the Claude plugin, the release workflow can stamp `version.json`'s version into it on a branch the catalog tracks ([ADR 0007](0007-products-live-in-host-plugin-folders.md)).

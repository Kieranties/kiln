---
status: accepted
---

# kiln needs Node and the Obsidian CLI, with no by-hand fallback

kiln's skills run their scripts with Node 24 or later, and reach Obsidian through the Obsidian CLI. Both used to have a by-hand fallback: without Node, Claude followed the blueprint README's steps itself, and without the CLI, the owner installed the five community plugins in Obsidian. Each fallback was a second copy of a procedure (in the skills, the vault rules, the blueprint README and the guides) that drifted from the first, was slower, and was rarely tried. Now both are required. When Node is missing, `/kiln:setup` offers to install it, with the owner's consent (winget on Windows, Homebrew on macOS). The CLI is a switch in Obsidian's own settings, which kiln can't set, so setup stops and says which switch to turn on.

## Considered options

- **Keep both fallbacks.** Works in more places, but doubles every procedure, and it is the double that goes stale.
- **Keep only the Node fallback.** The CLI is needed for creating and renaming notes anyway ([ADR 0002](0002-claude-reaches-the-vault-through-files-and-the-obsidian-cli.md)), so a vault without it isn't usable by kiln's skills, while a by-hand setup still duplicates the helper.

## Consequences

- This replaces the fallback in [ADR 0005](0005-one-user-scope-claude-plugin-with-bundled-scripts.md)'s consequences: a skill no longer does a step by hand when Node is missing; it stops and points to `/kiln:setup`.
- The blueprint README's "Setting up a vault" describes what setup does. It is no longer a procedure for Claude to follow without the helper.
- The setup helper stops when the Obsidian CLI isn't on PATH, rather than warning.

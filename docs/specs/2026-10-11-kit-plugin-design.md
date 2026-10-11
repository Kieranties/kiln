# The kiln plugin: the kit from any Claude session

Status: **built, waiting on the owner's check in Obsidian** (2026-10-11), for [kiln#72](https://github.com/Kieranties/kiln/issues/72). Nothing here is final.

Setting up a vault with the [kit](../../kit/README.md) used to mean cloning the kiln repo and starting Claude inside it, because Claude followed `kit/README.md` and copied files from `kit/`. The kit should be reachable from any Claude session, as v1's plugin was (vision P3: plain files, reachable from anywhere).

## Decided

### The kit folder is the plugin

`kit/` is the plugin root. It gains two things, and nothing in it is copied or generated:

| Path | What |
|---|---|
| `kit/.claude-plugin/plugin.json` | The plugin manifest: `kiln` |
| `kit/skills/apply-kit/SKILL.md` | The one skill. It runs the procedures in `kit/README.md` from any session; it does not repeat them |
| `.claude-plugin/marketplace.json` | At the repo root: the `kiln` marketplace, listing one plugin, `kiln`, with source `./kit` |

So there is one copy of the kit. The type definitions stay the single source of truth, and the tests in `tests/kit/` check the same files the plugin ships. The kiln Obsidian plugin (after the migration slice) can read the same folder.

Considered and set aside:

- **The repo root as the plugin** (`"source": "."`), with `skills/` at the root. Claude Code copies a plugin into its cache and installs its Node packages when the root has a `package.json` and lockfile, which the repo has for its checks. It would also copy the docs and tests.
- **A `plugin/` folder holding a copy of the kit,** kept in step by a script and a test. Two copies to keep in step, for no gain.
- **A `plugin/kit` symlink to `../kit`.** Claude Code refuses plugin paths that lead outside the plugin and its validator warns about symlinked sources, and Git for Windows checks symlinks out as text files by default.

The skill does not copy `.claude-plugin/` or `skills/` into a vault: "Setting up a vault" step 3 lists what is copied, and the kit README's table says where every top-level kit folder goes. A test holds both.

### Install

```bash
claude plugin marketplace add Kieranties/kiln --sparse .claude-plugin kit
claude plugin install kiln@kiln
```

The same commands work in Bash and PowerShell. `--sparse` checks out only the marketplace and the kit; v1 found that a full checkout can fail on Windows with `EPERM` when Claude Code renames the marketplace folder. The plugin is also loadable for one session from any kit folder, such as a worktree's: `claude --plugin-dir <clone>/kit`. The release zip of `kit/` is a plugin folder too.

### Versions

Neither manifest sets `version`, so Claude Code takes the commit SHA as the version, and each commit to `main` is an update, matching kiln's release-per-merge. Claude Code's validator warns about the missing version; that warning is expected. Auto-update is off by default for marketplaces outside Anthropic's, so the guides tell the owner to turn it on.

### The skill

`apply-kit` (`/kiln:apply-kit`) works out the job from the request and the vault:

| Job | When | Runs |
|---|---|---|
| Set up | The vault has no `_kiln/` | "Setting up a vault" |
| Re-apply | The vault has `_kiln/` and the kit changed: the plugin updated, or a type was added or changed | "Adding or changing a type", step 5: copy in what differs, create missing type folders, merge every fragment again (the rules are safe to repeat) |
| The sample | Only on request, only into a trial vault | Set up, then copy `tests/fixtures/layer1` in |

- **The owner confirms** that Obsidian is closed and that Templater's per-device trigger is on, unless the request already says so. The skill stops and points to Getting started section 2 when the vault's `.obsidian/plugins/` lacks any of the four plugins.
- **The kit folder** is the plugin's own, unless the owner names another, such as a worktree's `kit/` to try an unmerged kit.
- **The sample** is not in the plugin: it is test data and stays in `tests/fixtures/layer1`. Beside a kit folder in a clone, the skill uses it from there; otherwise it fetches it with a sparse `git clone` of the repo into a temporary folder.
- **Vault-root files** (`Home.md`, `Board.base`) may carry the owner's changes, so on re-apply the skill shows a difference and asks before replacing one. The kit owns `_kiln/`, so files there are replaced. Nothing in the vault is deleted.

Adding a type to the kit (steps 1 to 4 of "Adding or changing a type") still happens in a clone, because it changes the kit and its tests.

### Checks

`tests/kit/plugin.test.ts` holds the plugin to the kit:

- the marketplace lists one plugin, `kiln`, whose source is `./kit`, the folder every other kit test reads;
- the entry and manifest names match, and neither sets a version;
- the skill exists, its description fits the skill listing, and every README section and kit path it names exists;
- the skill points to the README's procedure rather than restating the merge rules;
- the guides install the plugin with the same commands, and none asks for a clone to set up a vault.

`claude plugin validate .` checks the manifests against Claude Code's own rules.

## Open

- **The sample's version.** A fetched sample comes from `main`, while the plugin may lag behind it until it updates. The same as the kit zip today; worth a look if they drift.
- **Checking a vault.** The skill reports what it wrote; nothing yet checks a vault against the kit after the fact. A check could live in the skill or in the kiln Obsidian plugin.

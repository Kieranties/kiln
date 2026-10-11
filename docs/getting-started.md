# Getting started with kiln

This guide takes you from nothing to a working kiln setup:
- the `kiln` command on your PATH, installed from a release;
- the Claude Code plugin installed and updating itself;
- a base registered and indexed;
- a first capture, triage and recall in a Claude session.

It finishes with updating, troubleshooting and uninstalling. The [README](../README.md) is the reference for configuration, commands and checks. This guide is the path through them. To work on kiln itself, see [Developing kiln](../README.md#developing-kiln) instead.

## 1. Prerequisites

- **Node 24 or later.** kiln uses the built-in `node:sqlite`. Check with `node --version`.
- **Claude Code** on your PATH (`claude --version`).
- **The GitHub CLI**, signed in (`gh auth status`). It supplies the token npm needs to read GitHub Packages.
- **Git Bash** on Windows. The commands below use Bash syntax. kiln itself runs natively on Windows.
- **Obsidian** (optional) is the viewer, but kiln never needs it.

kiln has two parts, and you install both:

| Part | What it is | Where it comes from |
|---|---|---|
| The `kiln` command | The CLI, the MCP server and the hook commands | The `@kieranties/kiln` package on GitHub Packages, or the tarball on a [GitHub Release](https://github.com/Kieranties/kiln/releases) |
| The Claude Code plugin | Registers the MCP server, the skills and the hooks, all of which call `kiln` | The `Kieranties/kiln` repo, as a plugin marketplace |

Every commit on `main` is a release, versioned `<major>.<minor>.<patch>`. The plugin and the command must stay in step, so always update both (section 9).

## 2. Install the `kiln` command

### From GitHub Packages (recommended)

GitHub Packages needs a token to install, even for a public package. The GitHub CLI's token works once it has the `read:packages` scope:

```bash
gh auth refresh -h github.com -s read:packages
npm config set @kieranties:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken "$(gh auth token)"
```

These lines go in your user `~/.npmrc`. The first command opens a browser to approve the new scope. Then install:

```bash
npm install -g @kieranties/kiln@latest --registry https://registry.npmjs.org/
```

`@kieranties/kiln` comes from GitHub Packages, because of the scope line. `--registry` makes its dependencies come from the public npm registry, even if your default registry is a private one.

### From a GitHub Release (no token)

Each release has the same package as a `.tgz`:

```bash
gh release download --repo Kieranties/kiln --pattern '*.tgz' --dir /tmp/kiln-release --clobber
npm install -g /tmp/kiln-release/kieranties-kiln-*.tgz --registry https://registry.npmjs.org/
```

This takes the latest release. For a particular version, pass its tag: `gh release download v0.1.4 --repo Kieranties/kiln …`.

### Check it

```bash
npm ls -g @kieranties/kiln
kiln status
```

`npm ls` shows the installed version. On a fresh machine `kiln status` prints nothing, because no base is configured yet. Running `kiln` with no arguments prints the usage.

## 3. Install the Claude Code plugin

```bash
claude plugin marketplace add Kieranties/kiln
claude plugin install kiln@kiln
```

**Turn on auto-update.** Claude Code updates the plugin whenever `main` moves, but only if auto-update is on for the marketplace, and it is off by default for marketplaces outside Anthropic's own. In a Claude Code session, run `/plugin`, open **Marketplaces**, choose **kiln** and enable auto-update. Updates then install when a session starts. Without auto-update, update by hand (section 9).

Then check:

```bash
claude plugin list
claude mcp list
```

`claude plugin list` should show `kiln@kiln` as enabled. `claude mcp list` should show `plugin:kiln:kiln … Connected`.

The plugin gives every Claude Code session four things:
- the `kiln` MCP server, with 13 tools;
- the skills `kiln:capture`, `kiln:triage`, `kiln:recall` and `kiln:review`;
- a hook that blocks direct file writes into a base;
- a hook that prints an orientation line when a session starts.

## 4. Create your first base

A base is a folder of markdown notes. Pick an empty or new folder:

```bash
kiln init Z:/kb/work --name work
kiln reindex --base work
```

`init` does four things:
- creates the folder layout (`anchors/`, `projects/`, `work/`, `decisions/`, `references/`, `notes/`, `attachments/`, `sources/<kind>/`, `views/`);
- adds the Obsidian views;
- adds `.kiln/` to the folder's `.gitignore` and `.stignore`;
- registers the base in `~/.kiln/config.yaml`.

The first base you register becomes `default_base`. `reindex` builds the search index, which lives in `<base>/.kiln/index/`. That index is per machine and never synced. It must exist before a session can use the base.

> If you point `init` at a folder that already holds many notes, `reindex` takes about 30 s per 100,000 notes.

## 5. Choose which folders use which base

Each Claude session picks its base from the folder it starts in. The order is:
1. an explicit `base` on a tool call;
2. otherwise the first matching rule;
3. otherwise `default_base`.

With a single base, `default_base` is all you need. With several, add rules to `~/.kiln/config.yaml`:

```yaml
rules:
  - path: Z:/clients/**
    base: work
  - path: Z:/code/**
    base: work
```

- Paths are absolute globs with forward slashes.
- The first matching rule wins.
- Matching is case-insensitive on Windows.
- Rules match the session's **project root**. For a session in a git worktree, that is the main repo root, not the worktree folder.

> `kiln init` rewrites this file and drops comments and keys it doesn't know. Keep any notes about your setup elsewhere.

Check what a folder resolves to:

```bash
kiln status --line --cwd Z:/code/some-repo
```

It prints `kiln: base=work · inbox 0 · needs review 0`.

## 6. Open the base in Obsidian (optional)

Open the base folder as a vault. The views in `views/` are Obsidian Bases files:
- **Inbox**: captures waiting for triage;
- **Needs review**: notes Claude flagged as unsure;
- **Active work**;
- **Decisions**.

You can read and edit notes freely in Obsidian. kiln notices your edits the next time it checks the folder, which happens at most every 10 seconds.

## 7. Your first session

Start Claude Code in a folder that resolves to your base. The first line should read:

```
kiln: base=work · inbox 0 · needs review 0
```

Then try the four jobs. Plain requests are enough, because the skills trigger on them.

| You say | What happens |
|---|---|
| "Capture NWA-142 into kiln" or "Save this thread to kiln: <link>" | **capture.** Claude fetches the item through its connectors (Atlassian, Slack, GitHub, Gmail) and stores the relevant extract as a source in the inbox. If you capture the same item again later, the source is refreshed and returns to the inbox. |
| "Triage the kiln inbox" | **triage.** Claude works through the inbox in batches of up to 10. For each source it decides one of: dismiss, link-to-anchor, update-work-item, new-work-item, new-decision, supersede, new-reference or duplicate-of. It files the source into notes and records the outcome. Anything it is unsure about gets `review: needed`. |
| "What did we decide about renewal retries?" or "Where are we on the Vale Rovers onboarding?" | **recall.** Claude resolves the names you mention, reads their briefs, searches with a few rephrasings and answers with `[[links]]` to the notes it used. |
| "Review what kiln flagged" | **review.** Claude walks through the Needs review items and likely duplicates. For each one you confirm it, edit it or revert it. |

Claude cannot write files in a base directly. The write guard blocks Write, Edit, MultiEdit and NotebookEdit there, so every change goes through the kiln tools and stays valid and indexed. Shell commands are not guarded. Your own edits in Obsidian are never blocked.

## 8. Keep it healthy

```bash
kiln validate
```

`validate` reports four kinds of problem:
- schema problems;
- broken links;
- notes missing a summary or aliases;
- likely duplicates.

It reports only and never changes anything. It exits 1 when there are schema problems.

```bash
kiln reindex
```

`reindex` rebuilds the index from the files. Run it if the index ever looks wrong. It is always safe: the markdown is the truth.

## 9. Update kiln

Update the command first, then the plugin, then start a new Claude session:

```bash
npm install -g @kieranties/kiln@latest --registry https://registry.npmjs.org/
claude plugin update kiln@kiln
```

From a release tarball instead, repeat the download and install in section 2.

**Always update both.** The plugin's hooks and MCP server call the `kiln` command. A plugin newer than the command can call a command or tool the command lacks, and a failing write-guard hook can block every Write and Edit. With auto-update on, the plugin updates itself at session start, so update the command whenever you see a new [release](https://github.com/Kieranties/kiln/releases).

`npm ls -g @kieranties/kiln` shows the installed command's version. The MCP server reports the same version to Claude.

## 10. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| No orientation line at session start | No base matches this folder. Add a rule, or set `default_base`. Check with `kiln status --line --cwd <folder>`. |
| `kiln: base=… · index not built: run kiln reindex` | Run `kiln reindex --base <name>`. |
| Tool error `no_base: …` | Same as the first row. Alternatively, pass `base` explicitly. |
| Claude says a Write into a base was blocked | Working as intended. Claude should use the kiln tools; ask it to capture or update the note instead. |
| `conflict: … stale_revision` | The note changed since Claude read it, for example you edited it in Obsidian. Claude should re-read it with `get` and retry. |
| `conflict: … duplicate` | A similar note already exists. Claude should update that note instead, or retry with a reason. |
| `busy: …` | Another session is writing. Retry in a moment. |
| `claude mcp list` doesn't show kiln as connected | Check that `kiln` is on your PATH (`kiln status`). Reinstall the command (section 2). |
| Hooks fail, or every Write and Edit is blocked, after an update | The plugin and the command are out of step. Update both (section 9). |
| `npm install` fails with `401` or `E401` from `npm.pkg.github.com` | The token is missing or lacks `read:packages`. Rerun the three commands at the start of section 2. |
| `npm install` fails with `404` for `@kieranties/kiln` | The `@kieranties:registry` line is missing, so npm looked on the public registry. Rerun the `npm config set @kieranties:registry …` command. |
| `npm install` fails fetching a dependency from a private registry | Add `--registry https://registry.npmjs.org/` to the install command. |

## 11. Uninstall

```bash
claude plugin uninstall kiln@kiln
claude plugin marketplace remove kiln
npm rm -g @kieranties/kiln
rm -rf ~/.kiln
```

To remove the GitHub Packages settings too:

```bash
npm config delete @kieranties:registry
npm config delete //npm.pkg.github.com/:_authToken
```

Your bases are untouched. They are plain markdown folders. Each holds a `.kiln/` folder with its index, which you can delete; kiln rebuilds it whenever needed.

## Where to go next

- [README](../README.md): configuration, the command reference, the write guard, developing kiln, versioning and releases, and the checks.
- [Spec](specs/2026-10-10-kb-core-design.md): how kiln is designed: note types, frontmatter, tools and retrieval.
- [Open issues](https://github.com/Kieranties/kiln/issues): decisions to verify (`decision`), follow-ups and checks still to do (`verification`).

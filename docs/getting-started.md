# Getting started with kiln

This guide takes you from nothing to a working kiln setup:
- the `kiln` command on your PATH;
- the Claude Code plugin installed;
- a base registered and indexed;
- a first capture, triage and recall in a Claude session.

It finishes with updating, troubleshooting and uninstalling. The [README](../README.md) is the reference for configuration, commands and checks. This guide is the path through them.

## 1. Prerequisites

- **Node 24 or later.** kiln uses the built-in `node:sqlite`. Check with `node --version`.
- **Claude Code** on your PATH (`claude --version`).
- **Git Bash** on Windows. The commands below use Bash syntax. kiln itself runs natively on Windows.
- **Obsidian** (optional) is the viewer, but kiln never needs it.

## 2. Get the code

Clone or pull the repo into a **main checkout**, for example `D:\src\kiln`, and work on `main`.

> Install from the main checkout, never from a git worktree. Both the `npm link` and the plugin install point at the folder you install from. If that folder is a worktree that is later cleaned up, kiln stops working in every session.

## 3. Point npm at the public registry

Create `.npmrc` in the repo root with a single line:

```
registry=https://registry.npmjs.org/
```

Your global npm config points at a private registry, so without this file `npm install` fails. Agents are blocked from writing `.npmrc`, so add it yourself ([#56](https://github.com/Kieranties/kiln/issues/56)).

## 4. Build and link the `kiln` command

From the repo root:

```bash
npm install
npm run build
npm link
```

Check it:

```bash
kiln status
```

On a fresh machine this prints nothing, because no base is configured yet. Running `kiln` with no arguments prints the usage.

## 5. Install the Claude Code plugin

```bash
claude plugin marketplace add D:/src/kiln
claude plugin install kiln@kiln
```

Use your own repo path in place of `D:/src/kiln`. Then check:

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

The plugin is read from `plugin/` in place, so skill and hook changes take effect at the next session start.

## 6. Create your first base

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

## 7. Choose which folders use which base

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

## 8. Open the base in Obsidian (optional)

Open the base folder as a vault. The views in `views/` are Obsidian Bases files:
- **Inbox**: captures waiting for triage;
- **Needs review**: notes Claude flagged as unsure;
- **Active work**;
- **Decisions**.

You can read and edit notes freely in Obsidian. kiln notices your edits the next time it checks the folder, which happens at most every 10 seconds.

## 9. Your first session

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

## 10. Keep it healthy

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

## 11. Update kiln

After pulling changes:

```bash
npm install
npm run build
npm link
```

Then start a new Claude session. **Rebuild and relink every time.** The plugin hooks call the `kiln` command, and a binary that is out of step with the plugin can fail the hooks.

## 12. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| No orientation line at session start | No base matches this folder. Add a rule, or set `default_base`. Check with `kiln status --line --cwd <folder>`. |
| `kiln: base=… · index not built: run kiln reindex` | Run `kiln reindex --base <name>`. |
| Tool error `no_base: …` | Same as the first row. Alternatively, pass `base` explicitly. |
| Claude says a Write into a base was blocked | Working as intended. Claude should use the kiln tools; ask it to capture or update the note instead. |
| `conflict: … stale_revision` | The note changed since Claude read it, for example you edited it in Obsidian. Claude should re-read it with `get` and retry. |
| `conflict: … duplicate` | A similar note already exists. Claude should update that note instead, or retry with a reason. |
| `busy: …` | Another session is writing. Retry in a moment. |
| `claude mcp list` doesn't show kiln as connected | Check that `kiln` is on your PATH (`kiln status`). Rebuild and relink (section 11). |

## 13. Uninstall

```bash
claude plugin uninstall kiln@kiln
claude plugin marketplace remove kiln
npm rm -g kiln
rm -rf ~/.kiln
```

Your bases are untouched. They are plain markdown folders. Each holds a `.kiln/` folder with its index, which you can delete; kiln rebuilds it whenever needed.

## Where to go next

- [README](../README.md): configuration, the command reference, the write guard, and the test, eval, scale and triage checks.
- [Spec](specs/2026-10-10-kb-core-design.md): how kiln is designed: note types, frontmatter, tools and retrieval.
- [Open issues](https://github.com/Kieranties/kiln/issues): decisions to verify (`decision`), follow-ups and checks still to do (`verification`).

# The note check

Status: **decided, exploring** (2026-10-11). Nothing here is final.

Part of [Foundation: Claude in the vault](https://github.com/Kieranties/kiln/issues/79), for [#83](https://github.com/Kieranties/kiln/issues/83). It answers the vision's open question of how Claude's writes are checked.

## Decided

### What is checked

Claude creates notes from templates through QuickAdd ([vault access](2026-10-11-vault-access-design.md)), and `tests/kit` checks every template against its definition. So a note starts in the right shape. The check is about whether **a note is still valid after it changes**, whoever changed it:

| What changes a note | What can go wrong |
|---|---|
| Claude filling in or editing the body | A section heading removed or renamed; Log lines added without Log staying last |
| Claude editing frontmatter, directly or with `obsidian property:set` | A status the type doesn't allow; a relationship written as `project: Foo` rather than a list of links |
| Triage converting a capture | The type changes, so properties from the old type are left behind, the new type's are missing, and the note sits in the wrong folder or has the wrong name |
| Captured text | It contains `<%`, which Templater would run |
| The owner, or something that isn't Claude | Hand edits; the board's `+` button making a frontmatter-only note; edited templates in a vault already in use |

Converting a capture is the riskiest change, and it happens through CLI moves, renames and property changes. A hook after Claude's file writes would miss all of it.

### One script, run by skills

- **The logic is one function,** `checkNote()`, in `src/check/`. `tests/kit` uses it on the sample, so there is one implementation. Today's `tests/kit/examples.test.ts` already checks most of this against the definitions, as assertions that stop at the first failure. A prototype that reuses `load.ts` passed the sample and named each problem in two broken notes.
- **The plugin runs it as `kiln-check.mjs`,** bundled from `src/` ([repo layout](2026-10-11-repo-layout-design.md)):

  ```
  node "${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs" "D:\notes\Inbox\2026-10-06 Ask Priya about grace periods.md"
  ```

- **It reads the vault's own `_kiln/types/`,** found by walking up from the note, so a new type or kind needs no change to the check.
- **Kiln skills run it on the notes a flow touched,** at the end of the flow: triage on the notes it filed, end of day on the day's changes. Claude then fixes or reports what fails. The shared vault rules say so.
- **`/kiln:check`** is the owner's way in: the whole vault, or today's changes. It covers hand edits.
- **Without Node,** Claude checks a note by reading its definition.
- **The check never writes to notes.**

No hook, for now. It would only add cover for one-off edits Claude makes outside a kiln skill. Add one if those turn out to drift.

### What fails, and what warns

| Result | Rule |
|---|---|
| Error | Wrong folder, type, kind or status |
| Error | A section of the type is missing |
| Error | A property the type doesn't have |
| Error | A new note with frontmatter and no body |
| Error | `<%` in a new note |
| Allowed | Extra sections |
| Warning | A link to a note that doesn't exist yet, with a near-match hint. The design allows linking to a note before it exists |
| Warning | A file name used by another note |
| Warning | `<%` in an existing note. Templater only reprocesses new notes |

A failure names the note, the rule and the fix:

```
Inbox/2026-10-06 Ask Priya about grace periods.md
  error  type is work but the note is in Inbox/; work notes live in Work/
  error  missing section: ## Outcome
  error  unknown property: attendees (work has jira, github, priority, projects, products, and the shared properties)
  warn   [[Priya Rahman]] doesn't exist yet; did you mean [[Priya Raman]]?
```

### What the definitions gain

- **A naming rule per type:** `title`, `date`, `date-title` or `source-title`. Today it is hard-coded by type name in the tests.
- **"Log comes last"** for the daily note. Line formats stay as prose for Claude.
- **The shared properties written into `properties.md`.** Today they are hard-coded in `tests/kit/load.ts`.
- **`captured`, `from` and `url` as optional properties shared by every type.** A converted capture keeps them (layer 1 design, "Captures"), and today's allowed-keys check would reject them.

## Open

- Whether `summary` is required on some types, via a per-type `required` list.
- Machine-readable line formats for the daily Log, if prose proves too loose.
- The kiln Obsidian plugin running the same check on hand edits, as they happen.

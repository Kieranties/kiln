---
status: accepted
---

# One note check, run by skills and the owner, that never writes

Notes start in the right shape from their templates, so the check asks whether a note is still valid after it changes, whoever changed it. It is one function in `src/check/`, used by the blueprint tests on the sample and bundled as `kiln-check.mjs`. It reads the vault's own type definitions, so a new type needs no change to it. kiln's skills run it on the notes a flow touched, at the end of the flow, and the owner runs `/kiln:check` on the whole vault or today's changes. It reports and never changes a note.

## Considered options

- **A hook after Claude's file writes.** Most risky changes, such as triage converting a capture, happen through Obsidian CLI moves, renames and property changes, which a file-write hook never sees, and it misses hand edits altogether. Add one only if one-off edits outside a kiln skill turn out to drift.

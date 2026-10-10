---
name: review
description: Use when the user asks to review their kiln knowledge base - work through kiln's "Needs review" items, check what Claude filed or changed in kiln notes, confirm or revert flagged kiln notes or superseded kiln decisions, or deal with suspected duplicate notes in the knowledge base. Not for reviewing code or code changes. Walks each flagged note with the user and clears the flag once it is confirmed, edited or reverted.
---

# Review flagged kiln notes

Claude writes knowledge immediately and flags what it was unsure of with `review: needed`. This skill walks those flags with the user, one item at a time, and clears each one. **Every write goes through the kiln tools; never edit files in the base directly** (the write guard blocks it).

## Gather

1. `query({ review: true })`: every note flagged `review: needed`, newest first.
2. `validate()`: keep only the `possible_duplicate` findings. These are suggested merges to review too.
3. Tell the user how many of each there are, then start with the flagged notes.

## For each flagged note

1. `get` the note (you need its `revision`).
2. **Show what changed and why**, briefly:
   - the `review_reason`;
   - what the note says now: title, `summary`, and the section or fields Claude wrote;
   - where it came from: its `sources` (`get` a source when the user wants to see the evidence);
   - for a decision with `supersedes`, the old decision it replaced, side by side.
3. **Ask: confirm, edit or revert?** Then act:

| Choice | Do |
|---|---|
| **Confirm** | `update_note({ id_or_path, if_revision, unset: ["review", "review_reason"] })` |
| **Edit** | `update_note` with the user's corrections (`set` fields, `sections` with `mode: "replace"` or `"append"`) and `unset: ["review", "review_reason"]` in the same call |
| **Revert** | Undo the change (below), and unset `review` and `review_reason` |

Never clear a flag the user has not confirmed. Skipping an item leaves it flagged.

## Reverting

kiln never deletes. Revert by restoring what was there and retiring what was added through `status`:
- **A field or section Claude changed:** `update_note` it back to the previous content (from the user, or from the source), and unset the review flags.
- **A note Claude created that should not exist:** retire it through its status (anchor or reference `archived`, work `abandoned`, project `closed`) and unset the review flags. A plain `note` has no status: tell the user, who can remove it in Obsidian.
- **A supersede** (the new decision has `supersedes`; the old one is `superseded`):
  1. `get` the old decision, then `update_note` it: `set: { status: "active" }`, `unset: ["superseded_by"]`. This restores the old decision's status.
  2. `get` the new decision, then `update_note` it: `set: { status: "superseded", superseded_by: ["[[<old decision title>]]"] }`, `unset: ["supersedes", "review", "review_reason"]`. This retires the new one and points readers back at the decision in force.
  3. Tell the user both notes changed.

## Possible duplicates

For each `possible_duplicate` finding, `get` both notes and show them side by side: title, `summary`, `aliases`, `sources`, `updated`. Ask: **merge or keep both?**
- **Merge:** pick the note to keep with the user. `update_note` it to add the other's `aliases` and `sources`, and append any content it lacks. Then retire the other, by its type:
  - anchor or reference: `status: "archived"`; work: `status: "abandoned"`; project: `status: "closed"`; each with a `[[link]]` to the kept note in its body;
  - decision: `update_note` with `set: { status: "superseded", superseded_by: ["[[<kept note title>]]"] }`;
  - source: `mark_source` with `triage: "dismissed"`, `outcome: "duplicate-of"` and `linked_to: ["[[<kept note title>]]"]`;
  - plain `note`: it has no status; tell the user, who can remove it in Obsidian.
- **Keep both:** if the titles are confusingly close, offer to make one more specific with `update_note` (`set: { title, aliases }`).

## Conflicts

A `conflict` on `update_note` means the note changed since you read it (often a hand edit in Obsidian). `get` it again, show the user what changed, and redo the action on the new content. Never retry with the old revision.

## Report

At the end: counts of confirmed, edited, reverted, merged and skipped items, and what is still flagged.

## Example (Northwind Arena)

Flagged: `2026-10-08 Patch turnstile firmware before reverting`, which supersedes `2026-09-30 Revert turnstile firmware on matchdays`, with `review_reason: "Superseded by a decision recorded from a Slack thread"`.
- Show both decisions' `Decision` sections and the Slack source.
- User: "Revert. The patch was only proposed." Restore the September decision to `active`; set the October one to `superseded` with `superseded_by: ["[[2026-09-30 Revert turnstile firmware on matchdays]]"]` and clear its flags.

## If the kiln tools are unavailable

If the kiln MCP tools are not available in this session, say so plainly and **stop. Do not confirm, edit or revert anything by editing files.** The user can still read the **Needs review** view in Obsidian; review resumes once kiln is connected.

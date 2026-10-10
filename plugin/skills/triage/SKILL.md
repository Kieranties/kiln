---
name: triage
description: Use when the user asks to triage, process, file or clear the kiln inbox, or says yes to "triage it now?" after a capture. Works through captured sources in batches, decides what each one means for the knowledge base, files it into notes with the kiln tools, and records the outcome on the source.
---

# Triage the kiln inbox

Turn captured sources into knowledge: decide what each one means, file it, record the outcome. **Every write goes through the kiln tools; never write files in the base directly** (the write guard blocks it).

## Loop

1. Call `inbox({ limit: 10 })`. Work through **at most 10 items per batch**, oldest first. After a batch, report and ask before starting the next.
2. For each item, `get` the source to read its content and `revision`.
3. **Look up targets, cheapest first:**
   - `resolve` each name in the source: organisations, products, services, people, topics, projects, ticket keys.
   - `brief` the anchors or project that resolved, to see current truth, active decisions and open work.
   - `search` with `q` plus 2-4 `variants` only when resolve did not find the target.
   - `get` a candidate note before changing it (you need its `revision`).
4. **Choose one outcome** from the table below.
5. **File it**: `create_note`, `update_note` or `supersede`, as the outcome says.
6. **Finish the item with `mark_source`.** Every item ends with it, including dismissals.

## Outcomes (choose exactly one per item)

| Outcome | Use when | File it with |
|---|---|---|
| `dismiss` | No lasting value: noise, chatter, an FYI already known, or out of scope | nothing; `mark_source` with `triage: "dismissed"` |
| `link-to-anchor` | A fact, issue or change about an organisation, product, service, person or topic, not tied to a piece of work | `update_note` on the anchor: append to `Facts` or `Known issues`; replace `Summary` with dated current truth when the truth changed |
| `update-work-item` | Progress, a blocker, a status change or new open items on existing work | `update_note` on the work note (see below) |
| `new-work-item` | A new ticket, bug, feature, chore, incident or research thread with no work note yet | `create_note` with `type: "work"` and a `kind` (feature, bug, chore, incident, research) |
| `new-decision` | Something was decided and no active decision on the same question exists | `create_note` with `type: "decision"`, `decided_on`, and sections `Context`, `Decision`, `Consequences` |
| `supersede` | A decision replaces an existing active decision on the same question | `supersede` the old decision (it flags the new one for review) |
| `new-reference` | A doc, spec, code location, post, thread, video, dashboard, sheet or slides worth finding again | `create_note` with `type: "reference"` and its `kind` |
| `duplicate-of` | The source repeats something already filed, with nothing new | nothing; `mark_source` with `triage: "dismissed"` and `linked_to` the existing note |

Superseding: `get` the old decision, then `supersede({ old_id_or_path, if_revision: <the OLD decision's revision>, new_decision: { fields: { title, decided_on, summary, aliases, sources, confidence, anchors, ... }, sections: [{ heading: "Context", text }, { heading: "Decision", text }, { heading: "Consequences", text }] } })`.

If a source carries two things (a decision and a work update), file both, use the outcome for the main one, and list every note touched in `linked_to`.

## Updating a work note (`update-work-item`)

`get` the work note first: you need its current `Open items` and its `revision`. Then make one `update_note` call with that `if_revision`:
- `sections`:
  - `{ heading: "Checkpoints", mode: "append", text: "- <today, YYYY-MM-DD>: <what changed>" }`: a dated checkpoint that also names each item the source closed.
  - `Open items`, merged so nothing still open is lost:
    - when the source **only adds** items and closes none: `mode: "append"` with the new items, verbatim;
    - otherwise `mode: "replace"` with the **merged current list**: every existing item that is still open, kept verbatim; minus only the items the source shows are closed (each recorded in the checkpoint); plus the new items, verbatim.
  - Never paraphrase open items, and never drop one the source does not show closed.
- `set`: `last_checkpoint` (today), `status` if it changed, and `sources` as the existing list **plus** `[[<source title>]]`.

## What every note you write must carry

Every note you create must carry these fields. When you update a note, add the source to its `sources`, and set any of the others it is missing:
- `summary`: 1-2 plain-language sentences.
- `aliases`: at least one other name it will be looked up by (ticket key, nickname, short name).
- `sources`: wikilinks to the source notes it came from, e.g. `[[NWA-142 Turnstiles reject mobile tickets at North Stand]]`.
- `confidence`: `verbatim` when the content is taken directly from the source, `inferred` when you concluded it.
- Links to anchors in `anchors`, and to the project in `project`, as `[[Note title]]`.

**Review flag.** Rate your own confidence in each filing (the outcome chosen, the target, the content). When it is **medium or low**, also set `review: "needed"` and a `review_reason` that says what to check, e.g. `"Inferred that the Thursday patch covers gate 4 as well as gate 3"`. `supersede` sets the flag itself.

## Finishing an item

```
mark_source({
  id_or_path: <source id>,
  if_revision: <source revision>,
  triage: "linked",            // "dismissed" for dismiss and duplicate-of
  outcome: "update-work-item", // the outcome chosen
  linked_to: ["[[Fix North Stand turnstile firmware]]"]
})
```

## Conflicts

- **Duplicate on create** (`conflict` naming an existing note): the note already exists. `get` it and `update_note` it instead. Retry `create_note` with `new_reason` only when it is genuinely a different thing.
- **Stale revision** (`conflict` on `update_note`, `supersede` or `mark_source`): the note changed since you read it. `get` it again and redo the change on the new content. Never retry blindly with the old revision.
- `validation`: the error names the field and the fix. Correct it and call again.

## Report

After each batch, give a short summary: one line per item (source title, outcome, notes touched), then a **Flagged for review** list with each `review_reason`, then how many items remain in the inbox. Offer the next batch.

## Example (Northwind Arena)

Source: `NWA-142 Turnstiles reject mobile tickets at North Stand`, a Jira update saying the vendor patch fixed gate 3, gate 4 still rejects mobile tickets, and the gate 4 reader needs a new cable.
- `resolve("NWA-142")` finds the work note `Fix North Stand turnstile firmware`; `get` it. Its `Open items` are "Patch gate 3", "Patch gate 4" and "Brief stewards on the paper-ticket fallback".
- Outcome `update-work-item`, in one `update_note`:
  - append the checkpoint `- <today>: Vendor patch fixed gate 3 (closed "Patch gate 3"); gate 4 still rejects mobile tickets.`;
  - replace `Open items` with the merged list: "Patch gate 4", "Brief stewards on the paper-ticket fallback" (both still open, kept verbatim), plus the new "Replace the gate 4 reader cable";
  - add the source to `sources`.
- Confidence high, so no review flag. `mark_source` with `triage: "linked"`.

## If the kiln tools are unavailable

If the kiln MCP tools are not available in this session, say so plainly and **stop. Do not file anything by editing files**, in the base or anywhere else. Triage resumes once kiln is connected.

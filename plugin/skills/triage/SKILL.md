---
name: triage
description: Use when the user asks to triage, process, file or clear the kiln inbox, or says yes to "triage it now?" after a capture. Works through captured sources in batches, decides what each one means for the knowledge base, files it into notes with the kiln tools, and records the outcome on the source.
---

# Triage the kiln inbox

Turn captured sources into knowledge: decide what each one means, file it, record the outcome. **Every write goes through the kiln tools; never write files in the base directly** (the write guard blocks it).

**Links:** build every link from the note's `path`, as returned by `get`, `create_note`, `capture`, `resolve` or `search`. A link is `[[<path basename without .md>|<title>]]`, e.g. `[[2026-10-08 Patch turnstile firmware before reverting|Patch turnstile firmware before reverting]]` for `decisions/2026/2026-10-08 Patch turnstile firmware before reverting.md`. Decision and source files start with a date, so a bare `[[<title>]]` does not open in Obsidian. When the basename already is the title, `[[<title>]]` is the same link.

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
| `dismiss` | No lasting value, and nothing in the base it duplicates: noise, chatter, out of scope | nothing; `mark_source` with `triage: "dismissed"`, no `linked_to` |
| `link-to-anchor` | A fact, issue or change about an organisation, product, service, person or topic, not tied to a piece of work | `update_note` on the anchor: append to `Facts` or `Known issues`; replace `Summary` with dated current truth when the truth changed |
| `update-work-item` | Progress, a blocker, a status change or new open items on existing work | `update_note` on the work note (see below) |
| `new-work-item` | A new ticket, bug, feature, chore, incident or research thread with no work note yet | `create_note` with `type: "work"`, a `kind` (feature, bug, chore, incident, research) and `status: "active"` (or `blocked`/`paused` when the source says so) |
| `new-decision` | Something was decided and no active decision on the same question exists | `create_note` with `type: "decision"`, `status: "active"` (`"proposed"` when the source shows it is not final yet), `decided_on`, and sections `Context`, `Decision`, `Consequences` |
| `supersede` | A decision replaces an existing active decision on the same question | `supersede` the old decision (it flags the new one for review) |
| `new-reference` | A doc, spec, code location, post, thread, video, dashboard, sheet or slides worth finding again | `create_note` with `type: "reference"`, its `kind` and `status: "active"` |
| `duplicate-of` | The source repeats a specific note already in the base, with nothing new. Use it whenever you can name that note | nothing; `mark_source` with `triage: "dismissed"` and `linked_to` that note |

Tie-break: if an existing note already covers the source, use `duplicate-of`, not `dismiss`.

Superseding: `get` the old decision, then `supersede({ old_id_or_path, if_revision: <the OLD decision's revision>, new_decision: { fields: { title, status: "active" /* or "proposed" if not final */, decided_on, summary, aliases, sources, confidence, anchors, ... }, sections: [{ heading: "Context", text }, { heading: "Decision", text }, { heading: "Consequences", text }] } })`.

If a source carries two things (a decision and a work update), file both, use the outcome for the main one, and list every note touched in `linked_to`, each linked from its path.

## Updating a work note (`update-work-item`)

`get` the work note first: you need its current `Open items` and its `revision`. Then make one `update_note` call with that `if_revision`:
- `sections`:
  - `{ heading: "Checkpoints", mode: "append", text: "- <today, YYYY-MM-DD>: <what changed>" }`: a dated checkpoint that also names each item the source closed.
  - `Open items`, merged so nothing still open is lost:
    - when the source **only adds** items and closes none: `mode: "append"` with the new items, verbatim;
    - otherwise `mode: "replace"` with the **merged current list**: every existing item that is still open, kept verbatim; minus only the items the source shows are closed (each recorded in the checkpoint); plus the new items, verbatim.
  - Never paraphrase open items, and never drop one the source does not show closed.
- `set`: `last_checkpoint` (today), `status` if it changed, and `sources` as the existing list **plus** the link to the source, `[[<source basename>|<source title>]]`.

## What every note you write must carry

Every note you create must carry these fields. When you update a note, add the source to its `sources`, and set any of the others it is missing:
- `summary`: 1-2 plain-language sentences.
- `aliases`: at least one other name it will be looked up by (ticket key, nickname, short name).
- `sources`: links to the source notes it came from, e.g. `[[2026-10-10 NWA-142 Turnstiles reject mobile tickets at North Stand|NWA-142 Turnstiles reject mobile tickets at North Stand]]` for `sources/jira/2026-10-10 NWA-142 Turnstiles reject mobile tickets at North Stand.md`.
- `confidence`: `verbatim` when the content is taken directly from the source, `inferred` when you concluded it.
- `status`: kiln sets no default, and a note without one is missed by status queries and briefs. Decision `active` (`proposed` when not final); work `active`; anchor and reference `active`; project `shaping` or `active`.
- Links to anchors in `anchors`, and to the project in `project`, built from their paths, e.g. `[[Turnstile Network]]` for `anchors/service/Turnstile Network.md`.

**Review flag.** Rate your own confidence in each filing (the outcome chosen, the target, the content). When it is **medium or low**, also set `review: "needed"` and a `review_reason` that says what to check, e.g. `"Inferred that the Thursday patch covers gate 4 as well as gate 3"`. `supersede` sets the flag itself.

## Finishing an item

```
mark_source({
  id_or_path: <source id>,
  if_revision: <source revision>,
  triage: "linked",            // "dismissed" for dismiss and duplicate-of
  outcome: "update-work-item", // the outcome chosen
  linked_to: ["[[Fix North Stand turnstile firmware]]"] // from work/2026/Fix North Stand turnstile firmware.md
})
```

A new decision is linked by its dated file name, e.g. `linked_to: ["[[2026-10-10 Patch gate 4 before the derby|Patch gate 4 before the derby]]"]`.

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
  - add the source to `sources` as `[[<source basename>|NWA-142 Turnstiles reject mobile tickets at North Stand]]`, the basename taken from the source's `path`.
- Confidence high, so no review flag. `mark_source` with `triage: "linked"`.

## If the kiln tools are unavailable

If the kiln MCP tools are not available in this session, say so plainly and **stop. Do not file anything by editing files**, in the base or anywhere else. Triage resumes once kiln is connected.

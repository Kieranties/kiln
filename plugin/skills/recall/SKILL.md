---
name: recall
description: Use when the user asks to recall something from kiln or their knowledge base or notes - what they know, decided or agreed, or where a project, ticket, organisation, product, person or past decision stands ("what did we decide about...", "where are we on...", "what do my notes say about...", "check kiln for..."). Not for questions about the code in the current repo. Answers from kiln notes, in a fixed retrieval order, citing [[links]].
---

# Recall from kiln

Answer from the user's knowledge base with the kiln tools, in this order. Stop as soon as you can answer well; go further only when you cannot.

## Retrieval order

1. **Resolve, then brief.** Call `resolve({ name })` for each named thing in the question: organisation, product, service, person, topic, project, ticket key. `resolve` already returns a brief of its best match; call `brief({ id_or_path })` only for the other anchors or projects it found that matter to the question.
2. **Structured follow-up on those anchors** with `query`:
   - active decisions: `query({ type: "decision", status: "active", anchors: ["[[Turnstile Network]]"] })`
   - open work: `query({ type: "work", status: "active", anchors: [...] })` (and `status: "blocked"` when relevant)
   - recent changes: `query({ anchors: [...], updated_after: "YYYY-MM-DD" })`
   - by project: `query({ project: "[[North Stand Upgrade]]" })`
3. **Search with 2-4 rephrasings.** `search({ q, variants: [...], scope_anchors: [...] })`. Scoped to the anchors from step 1 first; when that finds nothing useful, search again without `scope_anchors`. Variants should use other words for the same thing: synonyms, ticket keys, abbreviations, the user's nicknames. Use `base: "all"` only when the user asks across bases.
4. **Read the top hits with `get`.** Read the 2-5 most relevant notes in full before answering from them; summaries and snippets are not enough to quote.
5. **Live connector reads only for current external status.** Use Jira, GitHub, Slack and the like only when the question is about the current state of an external item ("is NWA-142 closed yet?") and the notes may be stale. Say which parts came from the live read.

## Answering

- Be concise: lead with the answer, then the supporting points.
- **Cite `[[links]]` to every note you used**, using the note titles, e.g. "Mobile tickets fail at gates 3 and 4 ([[Fix North Stand turnstile firmware]]); the vendor patch is the agreed fix ([[2026-10-08 Patch turnstile firmware before reverting]])."
- **Say when an answer rests on a superseded decision.** If the decision you found has `status: superseded`, say so and follow `superseded_by` to the current one.
- **Say when a note is flagged `review: needed`**: it is unconfirmed; mention its `review_reason`.
- **Say when nothing was found.** "I found nothing in kiln about X" is a complete answer. Do not fill gaps from general knowledge without saying that is what you are doing.
- Recall is read-only. If the answer reveals something worth keeping (a live status read, a correction), offer to capture it.

## Example (Northwind Arena)

Question: "Where are we on the North Stand turnstiles?"
1. `resolve("North Stand turnstiles")` finds the anchor `Turnstile Network` and returns its brief.
2. `query({ type: "work", status: "active", anchors: ["[[Turnstile Network]]"] })` returns `Fix North Stand turnstile firmware`.
3. Skip search: the brief and query answer it.
4. `get` the work note for its latest checkpoint and open items.
5. Only if asked for today's ticket state: read NWA-142 through the Atlassian connector.

## If the kiln tools are unavailable

If the kiln MCP tools are not available in this session, say so plainly, then fall back to a **read-only** search of the base folder:
- Find the base folder with `kiln status` (its `path`), or from `~/.kiln/config.yaml` (`bases[].path`).
- Use Grep and Glob over its markdown files (skip `.kiln/`), then Read the best matches.
- Answer with `[[links]]` as above, and say the answer came from a plain text search, not kiln.
- **Never write, edit or create files in the base** in this mode.

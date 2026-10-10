---
name: capture
description: Use when the user asks to capture, save, keep, note or "kiln" something into their knowledge base, or hands over an external item to keep - a Jira key (e.g. NWA-142), a Slack thread link, a GitHub PR or issue link, an email or a meeting - or pastes text or a link they want kept. Fetches the item through the session's connectors and captures it into the kiln inbox with the kiln capture tool.
---

# Capture into kiln

Put something into the kiln inbox as a `source` note, so `triage` can file it later. Capture records what was said; it does not decide where it belongs.

**Never write files in the base directly.** Every write goes through the kiln MCP tools; the write guard blocks direct Write/Edit into a base.

## Steps

1. **Work out what is being captured** and its kind. `kind` is one of: `jira`, `github`, `slack`, `email`, `meeting`, `web`, `note`.

2. **Fetch external content through the session's connectors.** Capture by reference means you read the item yourself:

   | Item | Fetch with | `source_id` |
   |---|---|---|
   | Jira key or link | Atlassian MCP (`getJiraIssue`) | the issue key, e.g. `NWA-142` |
   | Slack thread link | Slack MCP (read the thread) | channel id + thread ts |
   | GitHub PR or issue | `gh pr view` / `gh issue view` (with `--comments`) | `owner/repo#number` |
   | Email | Gmail MCP (get the thread) | the thread or message id |
   | Meeting | the meeting tool (notes or transcript) | the meeting id, or date + title |
   | Web page | WebFetch | omit, or the canonical URL |
   | Pasted text | nothing to fetch | omit |

   If a connector is missing or needs authorisation, say so and offer to capture what the user pasted instead. Do not guess at content you could not read.

3. **Call `capture`** with:
   - `kind`: from step 1.
   - `title`: short and findable. Lead with the key where there is one: `NWA-142 Turnstiles reject mobile tickets at North Stand`.
   - `content`: **the relevant extract, not the whole history.** Keep the description, the decisions, the current state, open questions and who owns what. Drop bot noise, reactions, signatures and repeated quoted replies. Quote decisions and commitments verbatim. Markdown.
   - `url`: the link to the item, when there is one.
   - `source_id`: the item's key in its system (table above). Capturing the same `kind` + `source_id` again refreshes that source instead of duplicating it, so re-capture freely when an item has moved on. When the content changed, the refreshed source returns to the inbox (`triage: pending`) even if it was triaged before, keeping its earlier outcome and `linked_to` as history.
   - `why`: one line on why this is worth keeping, from the user's words where they gave a reason.
   - `base`: only if the user named a base; otherwise the session's base is used.

4. **Confirm briefly**: the title and path from the result, and whether it was new or a refresh (`created`).

5. **Offer to triage immediately**: "Captured. Triage it now?" If yes, follow the `triage` skill for this item. For a refresh with new content, say it is back in the inbox and offer the same: "Refreshed; it is back in the inbox. Triage the update now?"

## Example

User: "kiln NWA-142"

1. `getJiraIssue` for `NWA-142` returns a bug: gates 3 and 4 at the North Stand reject mobile tickets since Saturday's firmware update; the vendor has a patch scheduled for Thursday.
2. Call:
   ```
   capture({
     kind: "jira",
     title: "NWA-142 Turnstiles reject mobile tickets at North Stand",
     content: "Gates 3 and 4 reject mobile tickets since the firmware update on Saturday.\n\n- Workaround: stewards scan paper backups at gate 2.\n- Vendor patch scheduled for Thursday.\n\nOpen: confirm the patch before the Saturday fixture.",
     url: "https://jira.northwind-arena.test/browse/NWA-142",
     source_id: "NWA-142",
     why: "Matchday entry is slowed at the North Stand"
   })
   ```
3. Reply: "Captured `sources/jira/NWA-142 Turnstiles reject mobile tickets at North Stand.md`. Triage it now?"

## Several items at once

Capture each item with its own `capture` call, then offer one triage pass over all of them.

## Errors

- `validation`: the error names the field and the fix. Correct it and call again.
- `no_base`: no base matches this folder. Ask which base to use and pass `base`, or suggest `kiln init <path> --name <base>`.

## If the kiln tools are unavailable

If the kiln MCP tools are not available in this session, say so plainly and **stop. Do not write the capture as a file**, not in the base and not anywhere else as a stand-in. Offer to keep the fetched extract in the conversation so it can be captured once kiln is connected.

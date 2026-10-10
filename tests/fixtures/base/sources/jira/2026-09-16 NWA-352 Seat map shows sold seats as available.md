---
id: 01M2MZZAN0R7NYA23M0SMHNXYR
type: source
kind: jira
title: NWA-352 Seat map shows sold seats as available
created: 2026-09-16
updated: 2026-09-16
source_id: NWA-352
dedupe_key: "jira:NWA-352"
url: "https://jira.northwind-arena.example/browse/NWA-352"
captured_at: "2026-09-16T18:05:00.000Z"
captured_by: manual
why: Seat map bug from Harbour on-sale
triage: linked
linked_to:
  - "[[Seat map shows sold seats as available]]"
triage_outcome: new-work-item
---

**NWA-352** · Bug · Priority: High · Status: In Progress
Reporter: Ellie Thornbury (for Harbour Athletic box office) · Assignee: Priya Raman · Components: ticketing-svc/seatmap

**Description**
During the Harbour Athletic v Vale Rovers on-sale, fans picked seats the map showed as free that had already sold. They got `409 HOLD_CONFLICT` at checkout. About 9% of basket attempts in the first 15 minutes hit it.
Cause: the 60-second seat map cache.

**Comments**
- Priya Raman: short term, 15s TTL for high-demand events behind `seatmap.hot_event_ttl`. Long term, invalidate from `ticket.events` on the queue.

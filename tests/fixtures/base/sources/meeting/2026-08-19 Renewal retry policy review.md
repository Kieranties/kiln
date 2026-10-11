---
id: 01M0CN7NP0GK2VWWGG8H03317J
type: source
kind: meeting
title: Renewal retry policy review
created: 2026-08-19
updated: 2026-08-19
source_id: mtg-2026-08-19-renewal-retry-review
dedupe_key: "meeting:mtg-2026-08-19-renewal-retry-review"
url: "https://notes.northwind-arena.example/meetings/2026-08-19-renewal-retry-review"
captured_at: "2026-08-19T15:00:00.000Z"
captured_by: manual
why: Retry policy replaced
triage: linked
linked_to:
  - "[[Retry failed renewal payments four times over ten days]]"
  - "[[Retry failed renewal payments three times in one week]]"
triage_outcome: supersede
---

# Renewal retry policy review

Attendees: Aoife Brennan, Tomasz Wielgosz, Hannah Varga, Rhys Calloway, Nora Kestrel

- Hannah: Kingsport FC's July instalment data shows 3 retries in 7 days recovers 54% of failed payments. Retries near month-end payday recover noticeably more.
- Rhys: Kingsport FC wants seats held longer before release.

**Decision:** retry up to **4 times over 10 days** (day 1, 3, 6 and 10, shifted towards month-end), every attempt with the same `Idempotency-Key` per renewal invoice. Release the seat after 21 days. This replaces the March three-retries rule.

Tomasz to change renewal-worker as part of NWA-298.

---
id: 01M1H5KZF0CAHJZFSVC6HDPTZM
type: source
kind: jira
title: NWA-311 Renewals charged twice after provider timeout
created: 2026-09-02
updated: 2026-09-02
source_id: NWA-311
dedupe_key: "jira:NWA-311"
url: "https://jira.northwind-arena.example/browse/NWA-311"
captured_at: "2026-09-02T17:45:00.000Z"
captured_by: manual
why: Renewal double-charge bug
triage: linked
linked_to:
  - "[[Duplicate charges on renewal retry]]"
triage_outcome: new-work-item
---

**NWA-311** · Bug · Priority: Highest · Status: In Progress
Reporter: Sofia Marchetti · Assignee: Tomasz Wielgosz · Components: renewal-worker, payments-svc

**Description**
In the UAT renewal run for Kingsport FC (test cohort of 1,200 staff and volunteer members paying with real cards), 41 members were charged twice.
When the payment provider answers `504` (we log `PAY-TIMEOUT-504`), renewal-worker retries through the fallback path `chargeWithFallback()`, which builds a new request without the `Idempotency-Key` header. The provider treats it as a new charge.

**Comments**
- 2026-09-03 Tomasz Wielgosz: confirmed. Fix behind flag `payments.retry.idempotency_on_timeout`.
- 2026-09-04 Aoife Brennan: UAT paused until the fix is in and everyone affected is refunded.

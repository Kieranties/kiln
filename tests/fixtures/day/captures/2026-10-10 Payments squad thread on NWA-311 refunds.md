---
id: 01M4K79VR04724KBECN138J6ZT
type: source
kind: slack
title: Payments squad thread on NWA-311 refunds
created: 2026-10-10
updated: 2026-10-10
source_id: payments-squad/p1760084700
dedupe_key: "slack:payments-squad/p1760084700"
url: "https://chat.northwind-arena.example/archives/payments-squad/p1760084700"
captured_at: "2026-10-10T08:25:00.000Z"
captured_by: manual
why: Double-charge fix status
triage: pending
---

#payments-squad, 10 October

**Tomasz Wielgosz** 09:12
NWA-311 fix (PR #1187, reuses the original Idempotency-Key on the timeout fallback) went to production at 08:30. `payments.retry.idempotency_on_timeout` is on for all clubs.

**Tomasz Wielgosz** 09:14
Refunds: 37 of the 41 went through overnight. The other 4 bounced because those cards have expired since, so finance will have to pay them back by bank transfer.

**Aoife Brennan** 09:20
Great news. Can we restart renewal UAT on Monday?

**Tomasz Wielgosz** 09:21
Yes, once Sofia's re-run of the timeout scenario passes. Should be today.

**Aoife Brennan** 09:22
I'll chase Rhys on the apology email wording.

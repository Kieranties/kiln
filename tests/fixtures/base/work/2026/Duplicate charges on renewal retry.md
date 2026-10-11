---
id: 01M1H2ZR50ZB99SGJT3R8ZN4CG
type: work
kind: bug
title: Duplicate charges on renewal retry
status: active
created: 2026-09-02
updated: 2026-09-09
aliases:
  - NWA-311
  - renewal double charge
  - charged twice
summary: "The renewal job retried timed-out card payments without the idempotency key, so 41 Kingsport FC test members paid twice; the fix and refunds are in progress."
keywords:
  - PAY-TIMEOUT-504
  - Idempotency-Key
  - chargeWithFallback
anchors:
  - "[[Payments]]"
  - "[[Memberships]]"
  - "[[Kingsport FC]]"
sources:
  - "[[NWA-311 Renewals charged twice after provider timeout]]"
  - "[[Payments weekly 9 September]]"
confidence: verbatim
project: "[[Season Ticket Renewals 2027]]"
ticket: NWA-311
last_checkpoint: 2026-09-09
---

## Summary
During the renewal UAT for [[Kingsport FC]], 41 members in the 1,200-person test cohort were charged twice. When the payment provider times out (`504`, logged as `PAY-TIMEOUT-504`), `renewal-worker` falls back to `chargeWithFallback()`, which sends a fresh request with no `Idempotency-Key`. That breaks [[Retry failed renewal payments four times over ten days]], which says every attempt reuses the same key per renewal invoice.
Owner: [[Tomasz Wielgosz]]. UAT for [[Season Ticket Renewals 2027]] is paused until this is fixed and everyone is refunded.

## Checkpoints
- 2026-09-02: reported by [[Sofia Marchetti]] from the UAT run.
- 2026-09-03: root cause confirmed; fix behind `payments.retry.idempotency_on_timeout`.
- 2026-09-04: Aoife paused renewal UAT.
- 2026-09-09: fix in code review. Refund list ready: 41 members, £18,450.

## Open items
- Pass the idempotency key on the timeout retry path in renewal-worker
- Refund the 41 members charged twice
- Add an alert when one member has two captures for the same renewal invoice
- Agree the apology email wording with Kingsport FC

## Outcome

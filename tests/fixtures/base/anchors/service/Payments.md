---
id: 01KES7DAM0GXYDJFWJC744KTR3
type: anchor
kind: service
title: Payments
status: active
created: 2026-01-12
updated: 2026-09-09
aliases:
  - payments-svc
  - checkout
  - card payments
summary: Payments takes card payments for tickets, memberships and renewals through a single external payment provider, using stored provider tokens.
keywords:
  - payment provider
  - vault_token
  - payments-db
anchors:
  - "[[Northwind Arena]]"
sources:
  - "[[NWA-277 Checkout outage during Harbour Athletic derby sale]]"
  - "[[Security and compliance review April]]"
  - "[[Payments weekly 9 September]]"
confidence: verbatim
---

## Summary
2026-09-09: the riskiest area right now. Fixing double charges in renewal retries (NWA-311), researching a second acquirer for matchday failover, and shrinking PCI scope before the November assessment.

## Facts
- Code: `payments-svc`, database `payments-db` (Postgres 16 since April 2026).
- No permanent lead since June; [[Gareth Pryce]] is acting lead. Senior engineer: [[Tomasz Wielgosz]].
- One payment provider. Card details stored only as provider tokens (`vault_token`).
- Every charge carries an `Idempotency-Key`; timeouts are logged as `PAY-TIMEOUT-504`.
- Runbook: [[Payments service runbook]]. Dashboard: [[Checkout latency dashboard]].

## Known issues
- [[Duplicate charges on renewal retry]]
- No failover if the provider degrades on a matchday.

## Decisions
- [[Hold card data only as payment provider tokens]]
- [[Season tickets are paid by card only]]
- [[Add a secondary acquirer for matchday failover]] (proposed)

## Open work
- [[Duplicate charges on renewal retry]]
- [[Payment provider failover options]]
- [[Remove card details from Club Console]]

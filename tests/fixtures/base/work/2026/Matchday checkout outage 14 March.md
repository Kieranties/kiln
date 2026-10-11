---
id: 01KKP96GW0XDAWZ29CHWP9Y5X4
type: work
kind: incident
title: Matchday checkout outage 14 March
status: done
created: 2026-03-14
updated: 2026-03-21
aliases:
  - NWA-277
  - derby day checkout outage
  - March checkout incident
summary: Checkout failed for 23 minutes during the Harbour Athletic v Kingsport FC derby on-sale because database connections ran out.
keywords:
  - E_POOL_TIMEOUT
  - max_client_conn
  - fraud-score
anchors:
  - "[[Payments]]"
  - "[[Harbour Athletic]]"
  - "[[Kingsport FC]]"
sources:
  - "[[NWA-277 Checkout outage during Harbour Athletic derby sale]]"
  - "[[Checkout outage postmortem review]]"
confidence: verbatim
ticket: NWA-277
last_checkpoint: 2026-03-21
---

## Summary
10:02 to 10:25 on 14 March: checkout returned `503 E_POOL_TIMEOUT`. A fraud-score call added on 10 March ran inside the database transaction, holding each connection about 1.2s. About 3,100 baskets abandoned. Incident commander [[Daniel Okafor]]; fix by [[Tomasz Wielgosz]].

## Checkpoints
- 2026-03-14: mitigated by raising `max_client_conn` from 400 to 800.
- 2026-03-19: postmortem review ([[Matchday checkout outage postmortem]]).
- 2026-03-21: NWA-279 moved the fraud-score call outside the transaction.

## Open items

## Outcome
Resolved. Follow-ups: [[Upgrade payments-db to Postgres 16]], pool-wait alerting ([[Observability]]), load test profile refreshed before high-demand on-sales.

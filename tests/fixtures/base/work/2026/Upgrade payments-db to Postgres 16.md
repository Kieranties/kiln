---
id: 01KM37Y0C0C80VQ5S2CYCSBQCH
type: work
kind: chore
title: Upgrade payments-db to Postgres 16
status: done
created: 2026-03-19
updated: 2026-04-16
aliases:
  - NWA-260
  - payments database upgrade
summary: Upgraded the payments database from Postgres 14 to 16 after the March checkout outage, for better connection handling.
anchors:
  - "[[Payments]]"
  - "[[Observability]]"
sources:
  - "[[Checkout outage postmortem review]]"
confidence: verbatim
ticket: NWA-260
last_checkpoint: 2026-04-16
---

## Summary
Postmortem action from [[Matchday checkout outage 14 March]]. Owner: [[Daniel Okafor]].

## Checkpoints
- 2026-03-19: raised from the postmortem.
- 2026-04-02: rehearsal on a restored snapshot: 14 minutes downtime.
- 2026-04-16: upgraded in the 05:00 maintenance window, 11 minutes read-only.

## Open items

## Outcome
payments-db runs Postgres 16. Pooler limits re-tuned: `max_client_conn=1200`, `default_pool_size=60`.

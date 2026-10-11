---
id: 01KMJH9640H6MM599K35KK3KPF
type: reference
kind: doc
title: Payments service runbook
status: active
created: 2026-03-25
updated: 2026-09-12
aliases:
  - payments on-call guide
  - checkout runbook
summary: "On-call guide for the payments service: what each error code means, which dashboard to open and how to fail safe on a matchday."
anchors:
  - "[[Payments]]"
  - "[[Observability]]"
sources:
  - "[[Checkout outage postmortem review]]"
confidence: verbatim
url: "https://wiki.northwind-arena.example/payments/runbook"
---

## Key points
- `E_POOL_TIMEOUT`: database pool exhausted; check pool wait on [[Checkout latency dashboard]]; raise `max_client_conn` only as a stopgap.
- `PAY-TIMEOUT-504`: provider timeout; never retry without the original `Idempotency-Key`.
- `HOLD_CONFLICT`: not a payments problem; hand to Ticketing.
- Matchday escalation: payments on-call, then [[Tomasz Wielgosz]], then [[Gareth Pryce]].
- Updated 2026-09-12 with the NWA-311 lesson.

---
id: 01KM2ZF0G07WGRHRTSKBBYKBDM
type: reference
kind: doc
title: Matchday checkout outage postmortem
status: active
created: 2026-03-19
updated: 2026-03-19
aliases:
  - NWA-277 postmortem
  - derby outage write-up
summary: "Blameless postmortem of the 14 March checkout outage: timeline, causes and actions."
anchors:
  - "[[Payments]]"
  - "[[Harbour Athletic]]"
  - "[[Observability]]"
sources:
  - "[[Checkout outage postmortem review]]"
confidence: verbatim
url: "https://wiki.northwind-arena.example/incidents/2026-03-14-checkout-outage"
---

## Key points
- Timeline 10:02 to 10:25; about 3,100 baskets abandoned.
- Cause: fraud-score call held database connections inside the transaction.
- Actions: NWA-279, pool alerting, NWA-260 (Postgres 16), load test refresh.

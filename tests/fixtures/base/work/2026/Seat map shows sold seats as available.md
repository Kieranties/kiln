---
id: 01M2MY8CV0VSCQA993P5QWACBQ
type: work
kind: bug
title: Seat map shows sold seats as available
status: active
created: 2026-09-16
updated: 2026-09-23
aliases:
  - NWA-352
  - stale seat map
  - ghost seats
summary: During busy on-sales the seat map shows seats that have already sold, so fans hit a hold conflict at checkout.
keywords:
  - HOLD_CONFLICT
  - seatmap-cache
anchors:
  - "[[Ticketing]]"
  - "[[Harbour Athletic]]"
sources:
  - "[[NWA-352 Seat map shows sold seats as available]]"
confidence: verbatim
ticket: NWA-352
last_checkpoint: 2026-09-23
---

## Summary
Caused by the 60-second cache in [[Cache the seat map for 60 seconds]]. On the Harbour Athletic v Vale Rovers on-sale about 9% of basket attempts hit `409 HOLD_CONFLICT` in the first 15 minutes. Owner: [[Priya Raman]]. Code: [[Seat map service code]].

## Checkpoints
- 2026-09-16: raised by Ellie for the Harbour Athletic box office.
- 2026-09-23: 15-second TTL for high-demand events shipped behind `seatmap.hot_event_ttl`.

## Open items
- Prototype invalidation from ticket.events on the queue
- Load test the 15-second TTL at Kingsport FC on-sale volumes
- Add an alert on HOLD_CONFLICT rate

## Outcome

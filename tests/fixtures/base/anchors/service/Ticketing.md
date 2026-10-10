---
id: 01KESHBXY0G2BP13Y2C40WAAHT
type: anchor
kind: service
title: Ticketing
status: active
created: 2026-01-12
updated: 2026-09-16
aliases:
  - ticketing-svc
  - box office
  - seat booking
summary: "Ticketing sells match tickets: seat maps, holds, baskets and ticket issue for all three clubs."
keywords:
  - seatmap
  - on-sale
  - holds
anchors:
  - "[[Northwind Arena]]"
sources:
  - "[[Ticketing design review seat map caching]]"
  - "[[Ticketing planning Q3]]"
  - "[[NWA-352 Seat map shows sold seats as available]]"
confidence: verbatim
---

## Summary
2026-09-16: stable apart from the seat map cache problem during high-demand on-sales (NWA-352). Dynamic pricing pilot paused.

## Facts
- Code: `ticketing-svc`; seat map endpoint `GET /v2/events/{id}/seatmap`.
- Engineering lead: [[Priya Raman]].
- Seat holds last 10 minutes; checkout re-checks the hold and returns `409 HOLD_CONFLICT` if the seat is gone.
- Peak load: about 900 seat map requests per second in the first 10 minutes of a Kingsport FC on-sale.

## Known issues
- [[Seat map shows sold seats as available]]

## Decisions
- [[Cache the seat map for 60 seconds]]
- [[Pause the dynamic pricing pilot until Kingsport FC board sign-off]]

## Open work
- [[Seat map shows sold seats as available]]
- [[Dynamic pricing pilot]] (paused)

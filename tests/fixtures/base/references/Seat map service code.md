---
id: 01M2MZ2150QHPN23HMHMN2J9T5
type: reference
kind: code
title: Seat map service code
status: active
created: 2026-09-16
updated: 2026-09-16
aliases:
  - seatmap module
  - ticketing-svc/seatmap
summary: Where the seat map endpoint and its cache live in the ticketing service code.
anchors:
  - "[[Ticketing]]"
sources:
  - "[[NWA-352 Seat map shows sold seats as available]]"
confidence: verbatim
url: "https://git.northwind-arena.example/ticketing/ticketing-svc/tree/main/seatmap"
---

## Key points
- `seatmap/handler.ts`: `GET /v2/events/{id}/seatmap`.
- `seatmap/cache.ts`: TTL from `seatmap.cache.ttl_seconds`, override `seatmap.hot_event_ttl`.
- Hold check is in `basket/holds.ts`, not here.

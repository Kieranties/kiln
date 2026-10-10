---
id: 01KHR9DP50E4EWPP8PG40AYKF5
type: decision
title: Cache the seat map for 60 seconds
status: active
created: 2026-02-18
updated: 2026-02-18
aliases:
  - seat map TTL
  - seatmap cache rule
summary: "Seat maps are served from a 60-second cache; checkout re-checks the hold, so a recently sold seat only costs the fan a retry."
anchors:
  - "[[Ticketing]]"
sources:
  - "[[Ticketing design review seat map caching]]"
confidence: verbatim
decided_on: 2026-02-18
---

## Context
Seat map p95 was 1.8s under on-sale load, reading Postgres on every request. Push invalidation needs an event stream we did not have yet.

## Decision
Cache seat maps for 60 seconds per event and section (`seatmap.cache.ttl_seconds=60`). Revisit once platform events exist.

## Consequences
Stale seats show up at high demand: [[Seat map shows sold seats as available]]. A 15-second override for hot events was added in September.

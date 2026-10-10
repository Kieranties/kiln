---
id: 01KHR8SHM06ABWSCEEB0FS8GBJ
type: source
kind: meeting
title: Ticketing design review seat map caching
created: 2026-02-18
updated: 2026-02-18
source_id: mtg-2026-02-18-ticketing-seatmap-cache
dedupe_key: "meeting:mtg-2026-02-18-ticketing-seatmap-cache"
url: "https://notes.northwind-arena.example/meetings/2026-02-18-ticketing-seatmap-cache"
captured_at: "2026-02-18T11:00:00.000Z"
captured_by: manual
why: Seat map caching choice
triage: linked
linked_to:
  - "[[Cache the seat map for 60 seconds]]"
  - "[[Ticketing]]"
triage_outcome: new-decision
---

# Ticketing design review: seat map caching

Attendees: Priya Raman, Sofia Marchetti, Daniel Okafor

- `GET /v2/events/{id}/seatmap` p95 is 1.8s in the last load test; every request reads seat state from Postgres.
- On-sale traffic for Kingsport FC home games is ~900 seat map requests/sec in the first 10 minutes.
- Options: (a) no cache, scale read replicas; (b) 60s TTL in the edge cache; (c) push invalidation on every sale.
- (c) needs an event stream we don't have yet (the broker is still being built).
- Showing a seat that sold in the last minute is acceptable: checkout re-checks the hold and returns `409 HOLD_CONFLICT`, and the fan just picks again.

Decision: (b). `seatmap.cache.ttl_seconds=60`, cache key per event and section.

Revisit when events are available.

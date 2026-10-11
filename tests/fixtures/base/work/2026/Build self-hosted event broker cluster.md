---
id: 01KGM1VBT0ARBN9STHJXQ3V3XH
type: work
kind: chore
title: Build self-hosted event broker cluster
status: abandoned
created: 2026-02-04
updated: 2026-05-12
aliases:
  - NWA-205
  - event broker build
summary: "Build and run our own three-node event broker for platform events; abandoned in May in favour of the managed queue."
anchors:
  - "[[Northwind Arena]]"
  - "[[Observability]]"
sources:
  - "[[Architecture forum event bus options]]"
  - "[[Architecture forum managed queue proposal]]"
confidence: verbatim
ticket: NWA-205
last_checkpoint: 2026-05-12
---

## Summary
Started from [[Run a self-hosted event broker for platform events]]. Owner: [[Daniel Okafor]].

## Checkpoints
- 2026-02-04: started.
- 2026-03-24: broker disk full, 2 hours of lost renewal events replayed by hand.
- 2026-04-30: second disk-full incident.
- 2026-05-12: abandoned; see [[Use the managed message queue for platform events]].

## Open items

## Outcome
Abandoned. Producers and consumers moved to the managed queue by 26 June. Write-up: [[Moving platform events to the managed queue]].

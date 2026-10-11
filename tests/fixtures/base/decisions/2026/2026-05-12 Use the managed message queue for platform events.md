---
id: 01KRE9GFJ0H1X9RFZD2D5KQEHG
type: decision
title: Use the managed message queue for platform events
status: active
created: 2026-05-12
updated: 2026-05-12
aliases:
  - managed queue decision
  - event bus v2
summary: "Platform events run on our cloud provider's managed message queue instead of a broker we operate ourselves."
anchors:
  - "[[Northwind Arena]]"
  - "[[Memberships]]"
  - "[[Ticketing]]"
  - "[[Payments]]"
sources:
  - "[[Architecture forum managed queue proposal]]"
confidence: verbatim
decided_on: 2026-05-12
supersedes:
  - "[[Run a self-hosted event broker for platform events]]"
---

## Context
The self-hosted broker had two disk-full incidents in six weeks and took about 40% of one engineer's time. Redone cost model: about £410/month at real volumes.

## Decision
Move all platform events to the managed message queue. Keep topic names. Consumers are at-least-once and deduplicate on `event_id`. Replaces [[Run a self-hosted event broker for platform events]].

## Consequences
[[Build self-hosted event broker cluster]] abandoned; migration finished 26 June. Analytics export moved to the queue's export. Write-up: [[Moving platform events to the managed queue]].

---
id: 01KGJ6P1W0BHNV7EY5NG2QZKVC
type: decision
title: Run a self-hosted event broker for platform events
status: superseded
created: 2026-02-03
updated: 2026-05-12
aliases:
  - self-hosted broker decision
  - event bus v1
summary: "In February we chose to run our own three-node event broker for platform events; replaced in May by the managed queue."
anchors:
  - "[[Northwind Arena]]"
  - "[[Observability]]"
sources:
  - "[[Architecture forum event bus options]]"
confidence: verbatim
decided_on: 2026-02-03
superseded_by:
  - "[[Use the managed message queue for platform events]]"
---

## Context
Services called each other's webhooks directly and lost calls during deploys. Renewals need fan-out to several services. Estimated peak: 2.1M events on a derby on-sale day.

## Decision
Run a self-hosted event broker (three brokers on our VMs), operated by [[Daniel Okafor]]'s platform team. Topics `membership.events`, `ticket.events`, `payment.events`, 7-day retention. Managed queue rejected on per-message cost and lock-in.

## Consequences
Platform team takes on broker operations. Build tracked as [[Build self-hosted event broker cluster]].
Superseded on 2026-05-12 by [[Use the managed message queue for platform events]].

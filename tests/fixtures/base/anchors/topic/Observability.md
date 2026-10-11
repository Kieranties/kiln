---
id: 01KM5ABVQ0BAN9V5TMY8MCKEFN
type: anchor
kind: topic
title: Observability
status: active
created: 2026-03-20
updated: 2026-08-12
aliases:
  - monitoring
  - alerting
  - o11y
summary: "How we watch the platform: dashboards, alerts and on-call, owned by the platform team."
anchors:
  - "[[Northwind Arena]]"
sources:
  - "[[Checkout outage postmortem review]]"
  - "[[NWA-322 Membership cards fail to add to phone wallets]]"
confidence: verbatim
---

## Summary
2026-08-12: alerting improved after the March outage; certificate expiry now monitored.

## Facts
- Owner: [[Daniel Okafor]].
- Alert when connection pool wait p95 > 200ms on payments-db (added after NWA-277).
- Cert monitor warns 30 days before any certificate expires, including wallet pass certificates.
- Matchday dashboards: [[Checkout latency dashboard]].

## Known issues
- No alert on the seat map serving stale data.

## Decisions

## Open work

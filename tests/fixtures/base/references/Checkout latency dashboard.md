---
id: 01KMB3BNA0N2GG4K2Q9JHP632P
type: reference
kind: dashboard
title: Checkout latency dashboard
status: active
created: 2026-03-22
updated: 2026-03-22
aliases:
  - checkout dashboard
  - payments latency board
summary: Live dashboard of checkout latency, error rate and database pool wait, watched during every on-sale.
anchors:
  - "[[Payments]]"
  - "[[Observability]]"
sources:
  - "[[Checkout outage postmortem review]]"
confidence: verbatim
url: "https://metrics.northwind-arena.example/d/checkout-latency"
---

## Key points
- Panels: checkout p50/p95, provider error rate, pool wait p95, baskets per minute.
- The pool wait alert (> 200ms) fires from here.

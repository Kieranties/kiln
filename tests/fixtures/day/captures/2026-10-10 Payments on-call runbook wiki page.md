---
id: 01M4K3F5Z0N81Q4006JK514STY
type: source
kind: web
title: Payments on-call runbook wiki page
created: 2026-10-10
updated: 2026-10-10
source_id: wiki-payments-runbook
dedupe_key: "web:wiki-payments-runbook"
url: "https://wiki.northwind-arena.example/payments/runbook"
captured_at: "2026-10-10T13:20:00.000Z"
captured_by: manual
why: Want to find the payments runbook again
triage: pending
---

# Payments service runbook

On-call guide for payments-svc.
- `E_POOL_TIMEOUT`: database pool exhausted; check pool wait on the checkout latency dashboard.
- `PAY-TIMEOUT-504`: provider timeout; never retry without the original Idempotency-Key.
- `HOLD_CONFLICT`: hand to Ticketing.
- Matchday escalation: payments on-call, then Tomasz, then Gareth.

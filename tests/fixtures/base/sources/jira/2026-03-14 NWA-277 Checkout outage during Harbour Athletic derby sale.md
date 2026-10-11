---
id: 01KKP0X0S0Y5AR7RNW7GJVMT13
type: source
kind: jira
title: NWA-277 Checkout outage during Harbour Athletic derby sale
created: 2026-03-14
updated: 2026-03-14
source_id: NWA-277
dedupe_key: "jira:NWA-277"
url: "https://jira.northwind-arena.example/browse/NWA-277"
captured_at: "2026-03-14T12:40:00.000Z"
captured_by: manual
why: Matchday outage ticket
triage: linked
linked_to:
  - "[[Matchday checkout outage 14 March]]"
triage_outcome: new-work-item
---

**NWA-277** · Incident · Priority: Highest · Status: Done
Reporter: Daniel Okafor · Assignee: Tomasz Wielgosz · Components: payments-svc, checkout-web

**Description**
From 10:02 to 10:25 on 14 March, during the on-sale for Harbour Athletic v Kingsport FC, checkout returned HTTP 503 with `E_POOL_TIMEOUT`. payments-svc ran out of connections to payments-db through the connection pooler (`max_client_conn=400`). Roughly 3,100 baskets were abandoned.

**Comments**
- 10:09 Daniel Okafor: pool saturated, wait times > 5s. Raising `max_client_conn` to 800 as mitigation.
- 10:25 Daniel Okafor: error rate back under 0.5%. Monitoring.
- 16:30 Tomasz Wielgosz: root cause found. The new fraud-score call (shipped 10 March) runs inside the DB transaction, so each checkout holds a connection for the ~1.2s remote call. Follow-up NWA-279 moves the call outside the transaction.

**Resolution:** Fixed. Follow-ups: NWA-279, NWA-260.

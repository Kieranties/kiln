---
id: 01KM339P90BK8DVDG315P7M96M
type: source
kind: meeting
title: Checkout outage postmortem review
created: 2026-03-19
updated: 2026-03-19
source_id: mtg-2026-03-19-checkout-postmortem
dedupe_key: "meeting:mtg-2026-03-19-checkout-postmortem"
url: "https://notes.northwind-arena.example/meetings/2026-03-19-checkout-postmortem"
captured_at: "2026-03-19T10:15:00.000Z"
captured_by: manual
why: Postmortem actions for NWA-277
triage: linked
linked_to:
  - "[[Matchday checkout outage postmortem]]"
  - "[[Matchday checkout outage 14 March]]"
  - "[[Upgrade payments-db to Postgres 16]]"
triage_outcome: new-reference
---

# Checkout outage postmortem review (NWA-277)

Attendees: Daniel Okafor, Tomasz Wielgosz, Gareth Pryce, Ellie Thornbury, Sofia Marchetti

Blameless review. Doc: "Matchday checkout outage postmortem" (linked in the incident channel).

Contributing factors
- Fraud-score call inside the checkout transaction (shipped 10 March, not load tested).
- Pooler limits unchanged since 2024.
- No alert on pool wait time; we found out from Harbour Athletic's box office calling Ellie.
- The load test profile was last season's traffic, about 40% below this derby.

Actions
1. Move fraud-score outside the transaction (NWA-279), Tomasz. Done 21 March.
2. Alert when pool wait p95 > 200ms, Danny.
3. Upgrade payments-db from Postgres 14 to 16 for better connection handling (NWA-260), Danny.
4. Refresh the load test profile before every high-demand on-sale, Sofia.
5. Ellie to brief Kwame at Harbour Athletic and send the summary.

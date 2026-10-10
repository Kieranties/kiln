---
id: 01KPR35700V413S1D3775MTPCX
type: source
kind: meeting
title: Security and compliance review April
created: 2026-04-21
updated: 2026-04-21
source_id: mtg-2026-04-21-security-compliance-review
dedupe_key: "meeting:mtg-2026-04-21-security-compliance-review"
url: "https://notes.northwind-arena.example/meetings/2026-04-21-security-compliance-review"
captured_at: "2026-04-21T13:00:00.000Z"
captured_by: manual
why: PCI scope decision
triage: linked
linked_to:
  - "[[Hold card data only as payment provider tokens]]"
  - "[[Remove card details from Club Console]]"
  - "[[PCI compliance]]"
triage_outcome: new-decision
---

# Security and compliance review, April

Attendees: Bea Fontaine, Tomasz Wielgosz, Gareth Pryce, Priya Raman

- Annual PCI DSS assessment is due November 2026. Today we are on the full SAQ-D because Club Console shows last-4 and expiry, and the refund screen lets staff key a card number.
- Payment provider tokens (`vault_token`) already cover the Fan App and web checkout.

**Decision:** we hold card data only as payment provider tokens. No PAN, no expiry stored or shown anywhere in our systems. Club Console refunds go through token references.

Work
- NWA-338: strip card fields from Club Console screens and exports.
- Bea to confirm the reduced questionnaire with the assessor.

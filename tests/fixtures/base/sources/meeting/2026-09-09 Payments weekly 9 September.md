---
id: 01M2374T60NEFMKCYK0TSX65QS
type: source
kind: meeting
title: Payments weekly 9 September
created: 2026-09-09
updated: 2026-09-09
source_id: mtg-2026-09-09-payments-weekly
dedupe_key: "meeting:mtg-2026-09-09-payments-weekly"
url: "https://notes.northwind-arena.example/meetings/2026-09-09-payments-weekly"
captured_at: "2026-09-09T10:30:00.000Z"
captured_by: manual
why: Payments weekly status
triage: linked
linked_to:
  - "[[Duplicate charges on renewal retry]]"
  - "[[Payment provider failover options]]"
  - "[[Add a secondary acquirer for matchday failover]]"
  - "[[Renewal reminder emails]]"
  - "[[Stored card auto-renewal]]"
triage_outcome: update-work-item
---

# Payments weekly, 9 September

Attendees: Tomasz Wielgosz, Gareth Pryce, Aoife Brennan, Daniel Okafor, Bea Fontaine

- NWA-311 (double charges): fix in review. Refund list prepared: 41 members, £18,450 total. Refunds go out once the fix is live.
- NWA-298 (stored card auto-renew): consent screen done. Reusing `vault_token` works in the provider sandbox.
- NWA-305 (reminder emails): still blocked. Copy sent to Kingsport FC marketing on 28 August, no answer.
- Failover: after NWA-277 in March and the provider's 504 storm on 2 September (11 minutes), Gareth wants options for a second acquirer. New research ticket NWA-345.
- Tomasz's proposal: route matchday card traffic to a secondary acquirer when the primary's error rate is over 5% for 2 minutes. **Proposed, not decided**: needs a cost estimate and Bea's PCI view.

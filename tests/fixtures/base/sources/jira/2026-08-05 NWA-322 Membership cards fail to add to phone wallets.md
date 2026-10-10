---
id: 01KZ8P0P104YJBMXSG4AMDEXCX
type: source
kind: jira
title: NWA-322 Membership cards fail to add to phone wallets
created: 2026-08-05
updated: 2026-08-05
source_id: NWA-322
dedupe_key: "jira:NWA-322"
url: "https://jira.northwind-arena.example/browse/NWA-322"
captured_at: "2026-08-05T13:10:00.000Z"
captured_by: manual
why: Wallet pass bug
triage: linked
linked_to:
  - "[[Membership cards fail to add to phone wallets]]"
triage_outcome: new-work-item
---

**NWA-322** · Bug · Priority: High · Status: Done
Reporter: Kwame Mensah (Harbour Athletic) · Assignee: Jamal Whitfield · Components: fan-app, membership-svc

**Description**
Since 3 August, "Add to wallet" for the digital membership card fails with `PASS_SIGNING_FAILED` for Harbour Athletic members.

**Comments**
- 2026-08-06 Jamal Whitfield: the pass-signing certificate for Harbour Athletic expired on 2 August. Renewal requested.
- 2026-08-12 Jamal Whitfield: new certificate deployed; adds work again. Added certificate expiry to the cert monitor (30-day warning).

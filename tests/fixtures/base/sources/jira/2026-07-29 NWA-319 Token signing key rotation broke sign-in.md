---
id: 01KYPZ68B04N2J5921YC2HGPM0
type: source
kind: jira
title: NWA-319 Token signing key rotation broke sign-in
created: 2026-07-29
updated: 2026-07-29
source_id: NWA-319
dedupe_key: "jira:NWA-319"
url: "https://jira.northwind-arena.example/browse/NWA-319"
captured_at: "2026-07-29T11:20:00.000Z"
captured_by: manual
why: Sign-in incident ticket
triage: linked
linked_to:
  - "[[Signing key rotation sign-in incident]]"
triage_outcome: new-work-item
---

**NWA-319** · Incident · Priority: Highest · Status: Done
Reporter: Mei Lin Zhou · Components: auth-legacy, ticketing-svc, membership-svc

**Description**
At 06:00 on 29 July the scheduled signing key rotation ran on auth-legacy. ticketing-svc and membership-svc cache the JWKS for 24h, so they rejected every token signed with the new key with `401 invalid_signature` for 41 minutes, until the caches were flushed by hand.

**Resolution**
- JWKS cache TTL down to 10 minutes; services refetch on an unknown `kid`.
- Rotation now publishes the new key 48h before signing with it.

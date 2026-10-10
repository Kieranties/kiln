---
id: 01KYPQ42M0FKQ950NTMHBVFSBK
type: work
kind: incident
title: Signing key rotation sign-in incident
status: done
created: 2026-07-29
updated: 2026-08-05
aliases:
  - NWA-319
  - key rotation outage
  - invalid_signature incident
summary: For 41 minutes on 29 July fans could not sign in or open tickets because services rejected tokens signed with a newly rotated key.
keywords:
  - JWKS
  - kid
  - 401 invalid_signature
anchors:
  - "[[Identity]]"
  - "[[Ticketing]]"
  - "[[Memberships]]"
sources:
  - "[[NWA-319 Token signing key rotation broke sign-in]]"
confidence: verbatim
project: "[[Identity Platform Migration]]"
ticket: NWA-319
last_checkpoint: 2026-08-05
---

## Summary
Scheduled signing key rotation on auth-legacy at 06:00. ticketing-svc and membership-svc cached the key set for 24 hours and rejected new tokens with `401 invalid_signature`.

## Checkpoints
- 2026-07-29: caches flushed by hand at 06:41.
- 2026-08-05: fixes deployed.

## Open items

## Outcome
JWKS cache 10 minutes, refetch on unknown `kid`, new keys published 48 hours before use. Same rules written into [[Identity provider OIDC integration spec]] for the new provider.

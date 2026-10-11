---
id: 01KWHB2TA06NWYW9W0QZS85KJ5
type: reference
kind: spec
title: Identity provider OIDC integration spec
status: active
created: 2026-07-02
updated: 2026-08-05
aliases:
  - Keystone spec
  - IdP integration guide
summary: "How services and apps integrate with the new identity provider: flows, token lifetimes, key rotation and claims."
anchors:
  - "[[Identity]]"
  - "[[Fan App]]"
  - "[[Club Console]]"
sources:
  - "[[Identity migration planning]]"
  - "[[NWA-319 Token signing key rotation broke sign-in]]"
confidence: verbatim
url: "https://wiki.northwind-arena.example/identity/oidc-integration"
---

## Key points
- Apps: authorization code with PKCE. Services: client credentials.
- Access tokens 1 hour; Fan App refresh tokens 14 days, rotating.
- Services cache JWKS for at most 10 minutes and refetch on unknown `kid` (lesson from NWA-319).
- Claims: `sub`, `club_id`, `roles`, `member_tier`.

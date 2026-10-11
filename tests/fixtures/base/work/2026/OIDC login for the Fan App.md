---
id: 01KWEW9EQ0Z185FB982DF5MAKR
type: work
kind: feature
title: OIDC login for the Fan App
status: active
created: 2026-07-01
updated: 2026-09-25
aliases:
  - NWA-330
  - Fan App OIDC
  - app sign-in migration
summary: Switch Fan App sign-in from auth-legacy session cookies to the new identity provider using authorization code with PKCE.
anchors:
  - "[[Fan App]]"
  - "[[Identity]]"
sources:
  - "[[Identity migration planning]]"
confidence: verbatim
project: "[[Identity Platform Migration]]"
ticket: NWA-330
last_checkpoint: 2026-09-25
---

## Summary
Owner: [[Jamal Whitfield]]. Spec: [[Identity provider OIDC integration spec]]. Keeps the 14-day rotating refresh tokens from [[Rotate Fan App refresh tokens with a 14-day lifetime]].

## Checkpoints
- 2026-07-01: started.
- 2026-08-14: sign-in and token refresh working against staging behind flag `fanapp.oidc_login`.
- 2026-09-25: silent migration of existing sessions designed: exchange the auth-legacy refresh token once for an IdP token.

## Open items
- Build the one-time token exchange endpoint
- Test refresh token reuse detection on old app versions
- Plan the staged rollout by club

## Outcome

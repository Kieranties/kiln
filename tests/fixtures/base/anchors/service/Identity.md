---
id: 01KES325G0BRSXDP7X23ZXMB8J
type: anchor
kind: service
title: Identity
status: active
created: 2026-01-12
updated: 2026-09-30
aliases:
  - identity-svc
  - sign-in
  - login
  - SSO
summary: "Identity handles sign-in for fans and club staff; it is moving from the in-house auth-legacy system to a new OIDC identity provider."
keywords:
  - auth-legacy
  - OIDC
  - tokens
  - password reset
anchors:
  - "[[Northwind Arena]]"
sources:
  - "[[Identity steering group January]]"
  - "[[Identity migration planning]]"
  - "[[NWA-341 Password reset links expire before they arrive]]"
confidence: verbatim
---

## Summary
2026-09-30: mid-migration ([[Identity Platform Migration]]). Staff accounts are moving first. Password reset emails arriving late is the main fan-facing problem.

## Facts
- Old system: `auth-legacy` (in-house, session cookies, patched in April to issue refresh tokens).
- New system: OIDC identity provider at `idp.northwind-arena.example`.
- Tech lead: [[Mei Lin Zhou]]. Security: [[Bea Fontaine]].
- Fan App tokens: 1-hour access tokens, 14-day rotating refresh tokens.
- Reset links: single-use, 15 minutes (`identity.reset.token_ttl=900`).

## Known issues
- [[Password reset links expire too early]]

## Decisions
- [[Rotate Fan App refresh tokens with a 14-day lifetime]]
- [[Password reset links stay valid for 15 minutes]]
- [[Limit the passkeys pilot to staff accounts]]
- [[Migrate Club Console staff accounts before fan accounts]]

## Open work
- [[OIDC login for the Fan App]]
- [[Move Club Console staff accounts to the new identity provider]]
- [[Password reset links expire too early]]

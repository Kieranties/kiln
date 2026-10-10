---
id: 01KWCMDMZ0HX6S6WJSY4VKBSY8
type: project
title: Identity Platform Migration
status: active
created: 2026-06-30
updated: 2026-09-30
aliases:
  - Keystone
  - IdP migration
  - auth-legacy retirement
summary: Moves all staff and fan sign-in from the in-house auth-legacy system to a new OIDC identity provider, so auth-legacy can be switched off by 31 March 2027.
anchors:
  - "[[Identity]]"
  - "[[Fan App]]"
  - "[[Club Console]]"
sources:
  - "[[Identity migration planning]]"
  - "[[Passkeys research readout]]"
confidence: verbatim
---

## Goal
Retire `auth-legacy` by **31 March 2027**. Every Club Console user and every Fan App user signs in through the new OIDC provider (`idp.northwind-arena.example`). Codename Keystone.
Tech lead: [[Mei Lin Zhou]]. Delivery: [[Nora Kestrel]].

## Status
2026-09-30: **green**. Staff migration batch 1 (Kingsport FC, 228 accounts) done on 22 September. Fan App OIDC sign-in in development behind a flag. Passkeys pilot for staff starts after staff migration finishes.

## History
- 2026-06-15: passkeys research done; pilot limited to staff ([[Limit the passkeys pilot to staff accounts]]).
- 2026-06-30: plan agreed; staff first ([[Migrate Club Console staff accounts before fan accounts]]).
- 2026-07-22: refresh token rules settled for the Fan App ([[Rotate Fan App refresh tokens with a 14-day lifetime]]).
- 2026-07-29: signing key rotation incident on auth-legacy ([[Signing key rotation sign-in incident]]) strengthens the case for moving off it.
- 2026-09-22: staff batch 1 migrated.

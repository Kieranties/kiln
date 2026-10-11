---
id: 01KES0C3K06SY6PVCR9MEK8A56
type: anchor
kind: product
title: Fan App
status: active
created: 2026-01-12
updated: 2026-08-12
aliases:
  - fan-app
  - NWA app
  - the mobile app
summary: The Fan App is the mobile app fans use to buy and show tickets, hold their digital membership card and manage their account.
anchors:
  - "[[Northwind Arena]]"
sources:
  - "[[Identity steering group July]]"
  - "[[NWA-322 Membership cards fail to add to phone wallets]]"
confidence: verbatim
---

## Summary
2026-08-12: white-labelled per club (Vale Rovers theme added for go-live). Sign-in is moving to OIDC; wallet passes fixed after the Harbour certificate expiry.

## Facts
- Lead mobile engineer: [[Jamal Whitfield]].
- Tickets are shown as rotating QR codes; offline display is supported for tickets already downloaded.
- Membership cards can be added to phone wallets.
- Biometric unlock since the April release.

## Known issues
- More frequent sign-ins since April (see [[Rotate Fan App refresh tokens with a 14-day lifetime]]).

## Decisions
- [[Rotate Fan App refresh tokens with a 14-day lifetime]]

## Open work
- [[OIDC login for the Fan App]]

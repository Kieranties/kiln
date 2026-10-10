---
id: 01KESENW10ZAQKAGXMABTAC3ZX
type: anchor
kind: product
title: Club Console
status: active
created: 2026-01-12
updated: 2026-09-30
aliases:
  - console
  - club admin portal
  - backoffice
summary: Club Console is the web back office club staff use for refunds, member lookups, event setup and reports.
anchors:
  - "[[Northwind Arena]]"
sources:
  - "[[Security and compliance review April]]"
  - "[[Identity migration planning]]"
confidence: verbatim
---

## Summary
2026-09-30: about 640 staff accounts. Being moved to the new identity provider first, and card fields are being removed for PCI scope.

## Facts
- Used by box office, membership and finance staff at each club.
- Staff sessions last 8 hours.
- Refunds are issued from here.

## Known issues
- Still shows last-4 and expiry on the refund screen until [[Remove card details from Club Console]] lands.

## Decisions
- [[Migrate Club Console staff accounts before fan accounts]]
- [[Limit the passkeys pilot to staff accounts]]

## Open work
- [[Move Club Console staff accounts to the new identity provider]]
- [[Remove card details from Club Console]]

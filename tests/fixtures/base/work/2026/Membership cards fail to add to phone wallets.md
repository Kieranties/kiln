---
id: 01KZ8SNW10HHVVPC988FHWCFY1
type: work
kind: bug
title: Membership cards fail to add to phone wallets
status: done
created: 2026-08-05
updated: 2026-08-12
aliases:
  - NWA-322
  - wallet pass failure
  - PASS_SIGNING_FAILED
summary: Harbour Athletic members could not add their membership card to a phone wallet because the pass-signing certificate had expired.
anchors:
  - "[[Fan App]]"
  - "[[Memberships]]"
  - "[[Harbour Athletic]]"
sources:
  - "[[NWA-322 Membership cards fail to add to phone wallets]]"
confidence: verbatim
ticket: NWA-322
last_checkpoint: 2026-08-12
---

## Summary
Reported by [[Kwame Mensah]]. Fixed by [[Jamal Whitfield]].

## Checkpoints
- 2026-08-05: raised.
- 2026-08-06: cause found: certificate expired 2 August.
- 2026-08-12: new certificate deployed.

## Open items

## Outcome
Fixed. Certificate expiry added to the cert monitor with a 30-day warning ([[Observability]]).

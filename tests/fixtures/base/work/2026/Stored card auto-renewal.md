---
id: 01KKBPQTV0S3MQSZM9M40PAV9S
type: work
kind: feature
title: Stored card auto-renewal
status: active
created: 2026-03-10
updated: 2026-09-09
aliases:
  - NWA-298
  - auto-renew with saved card
  - card on file renewals
summary: Season ticket holders opt in once and their saved card is charged automatically when the 2027 renewal window opens.
anchors:
  - "[[Memberships]]"
  - "[[Payments]]"
  - "[[Fan App]]"
sources:
  - "[[Renewals project kickoff]]"
  - "[[Payments weekly 9 September]]"
confidence: verbatim
project: "[[Season Ticket Renewals 2027]]"
ticket: NWA-298
last_checkpoint: 2026-09-09
---

## Summary
Members opt in to auto-renew in the [[Fan App]] or on the web. We store the provider token (`vault_token`) only, never card details ([[Hold card data only as payment provider tokens]]). On renewal day `renewal-worker` charges the token; failures follow [[Retry failed renewal payments four times over ten days]].

## Checkpoints
- 2026-03-10: ticket raised after kickoff.
- 2026-06-18: opt-in API (`POST /v1/members/{id}/auto-renew`) done.
- 2026-08-21: retry schedule changed to four attempts over ten days.
- 2026-09-09: consent screen done; token reuse works in the provider sandbox.

## Open items
- Consent wording signed off by both clubs' legal teams
- Card expiry check 30 days before renewal day
- End-to-end UAT once NWA-311 is fixed

## Outcome

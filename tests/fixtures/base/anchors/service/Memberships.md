---
id: 01KERYRTZ017V9T1PWGTGTP39X
type: anchor
kind: service
title: Memberships
status: active
created: 2026-01-12
updated: 2026-09-24
aliases:
  - membership-svc
  - members service
  - season passes
summary: Memberships is the service that holds member records, tiers, season ticket entitlements and renewals, including the nightly renewal-worker job.
keywords:
  - members
  - tiers
  - renewal-worker
  - wallet pass
anchors:
  - "[[Northwind Arena]]"
sources:
  - "[[Renewals project kickoff]]"
  - "[[NWA-347 Mid-season membership tier upgrades]]"
  - "[[NWA-360 Rovers members missing season ticket history]]"
confidence: verbatim
---

## Summary
2026-09-24: carrying most of the [[Season Ticket Renewals 2027]] work (auto-renewal, retries). Two client asks open: Harbour Athletic tier upgrades and Vale Rovers history.

## Facts
- Code: `membership-svc` plus the `renewal-worker` batch job (runs 02:00 UK time).
- Product manager: [[Aoife Brennan]]. Engineering lead: [[Priya Raman]] (shared with Ticketing).
- Digital membership cards are wallet passes, signed per club.
- Publishes `membership.events` on the queue.

## Known issues
- [[Rovers season ticket history and loyalty points missing]]
- Wallet pass certificates expire per club; now monitored after [[Membership cards fail to add to phone wallets]].

## Decisions
- [[Retry failed renewal payments four times over ten days]]

## Open work
- [[Mid-season membership tier upgrades]]
- [[Stored card auto-renewal]]
- [[Rovers season ticket history and loyalty points missing]]

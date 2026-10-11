---
id: 01KES4S3A08Y4X8D7778Y51754
type: anchor
kind: organisation
title: Northwind Arena
status: active
created: 2026-01-12
updated: 2026-10-02
aliases:
  - NWA
  - Northwind
  - the platform
summary: "Northwind Arena is our own company: a sports-tech platform that runs memberships, ticketing, payments and sign-in for professional football clubs."
keywords:
  - platform
  - company
  - clubs
anchors: []
sources:
  - "[[Renewals project kickoff]]"
  - "[[Architecture forum managed queue proposal]]"
  - "[[Identity migration planning]]"
confidence: verbatim
role: self
---

## Summary
2026-10-02: three clubs live on the platform: [[Kingsport FC]], [[Harbour Athletic]] and [[Vale Rovers]] (live since 1 August). Two programmes in flight: [[Season Ticket Renewals 2027]] for the February 2027 renewal window, and [[Identity Platform Migration]] to retire auth-legacy by 31 March 2027.

## Facts
- Services: [[Memberships]], [[Ticketing]], [[Payments]], [[Identity]].
- Products: [[Fan App]] for fans, [[Club Console]] for club staff.
- CTO: [[Gareth Pryce]]. Delivery manager: [[Nora Kestrel]].
- Jira project key: NWA.
- About 74,000 fan accounts and 640 club staff accounts across the three clubs.
- Platform events (`membership.events`, `ticket.events`, `payment.events`) run on the managed message queue since June 2026.

## Known issues
- One payment provider, no failover: two matchday-impacting problems this year (March outage, 2 September 504 storm).
- PCI DSS assessment due November 2026; scope reduction still in progress.

## Decisions
- [[Use the managed message queue for platform events]] (2026-05-12)
- [[Hold card data only as payment provider tokens]] (2026-04-21)
- [[Migrate Club Console staff accounts before fan accounts]] (2026-06-30)

## Open work
- [[Duplicate charges on renewal retry]]
- [[Payment provider failover options]]
- [[Move Club Console staff accounts to the new identity provider]]

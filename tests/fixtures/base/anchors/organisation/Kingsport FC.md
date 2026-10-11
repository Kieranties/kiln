---
id: 01KESEVBT02BG8WZREM577W73W
type: anchor
kind: organisation
title: Kingsport FC
status: active
created: 2026-01-12
updated: 2026-09-09
aliases:
  - Kingsport
  - the Kings
  - KSFC
summary: Kingsport FC is our largest client club, live on memberships, ticketing and payments since 2024, and the main pilot club for automatic season ticket renewal.
anchors:
  - "[[Northwind Arena]]"
sources:
  - "[[Renewals project kickoff]]"
  - "[[Ticketing planning Q3]]"
  - "[[NWA-311 Renewals charged twice after provider timeout]]"
confidence: verbatim
role: client
---

## Summary
2026-09-09: biggest club on the platform. Auto-renewal for 2027 season tickets is being built for them first; UAT is paused after members in the test cohort were charged twice (NWA-311). Dynamic pricing is on hold until their board meets in November.

## Facts
- Ground: Marshfield Road, capacity 31,000. About 22,500 season ticket holders, 38,000 members in total.
- Commercial director: [[Declan Moorcroft]]. Our account manager: [[Rhys Calloway]].
- Board approval needed for any ticket price that moves more than 15% from face value.
- Their marketing team approves all member-facing email copy.

## Known issues
- 41 members in the renewal UAT cohort were charged twice (see [[Duplicate charges on renewal retry]]).
- Reminder email copy has been waiting for approval since 28 August ([[Renewal reminder emails]]).

## Decisions
- [[Pause the dynamic pricing pilot until Kingsport FC board sign-off]]
- [[Season tickets are paid by card only]]

## Open work
- [[Stored card auto-renewal]]
- [[Renewal reminder emails]]
- [[Dynamic pricing pilot]] (paused)

---
id: 01KJW53500E7Z9ZH77FK7ZCV2E
type: project
title: Season Ticket Renewals 2027
status: active
created: 2026-03-04
updated: 2026-10-02
aliases:
  - STR27
  - Renewals 2027
  - auto-renew project
summary: Lets season ticket holders at Kingsport FC and Harbour Athletic renew automatically with a saved card before the 2027 renewal window opens on 1 February 2027.
keywords:
  - renewal window
  - auto-renew
  - renewal-worker
anchors:
  - "[[Kingsport FC]]"
  - "[[Harbour Athletic]]"
  - "[[Memberships]]"
  - "[[Payments]]"
sources:
  - "[[Renewals project kickoff]]"
  - "[[Renewal retry policy review]]"
  - "[[Payments weekly 9 September]]"
confidence: verbatim
---

## Goal
Get 70% of season ticket holders at [[Kingsport FC]] and [[Harbour Athletic]] onto automatic renewal with a stored card before the renewal window opens on **1 February 2027**, and stop the week-one call centre crush (62% renewed by hand last season).
Product owner: [[Aoife Brennan]]. Delivery: [[Nora Kestrel]]. Code: STR27.

## Status
2026-10-02: **amber**. Auto-renew build ([[Stored card auto-renewal]]) is on track, but renewal UAT has been paused since 4 September because the retry path charged 41 test members twice ([[Duplicate charges on renewal retry]]). Reminder emails ([[Renewal reminder emails]]) are blocked on Kingsport FC approving the copy. UAT needs to restart by 1 November to keep the January dry run.

## History
- 2026-03-04: kickoff. Card only ([[Season tickets are paid by card only]]); three retries in a week ([[Retry failed renewal payments three times in one week]]).
- 2026-08-19: retry policy replaced by [[Retry failed renewal payments four times over ten days]].
- 2026-09-02: NWA-311 found in UAT; UAT paused on 4 September.
- 2026-09-09: refunds prepared for 41 members (£18,450).

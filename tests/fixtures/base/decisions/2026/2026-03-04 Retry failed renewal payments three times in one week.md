---
id: 01KJWQD3006WEK582N180P5HZY
type: decision
title: Retry failed renewal payments three times in one week
status: superseded
created: 2026-03-04
updated: 2026-08-19
aliases:
  - three retries rule
  - retry policy v1
summary: "At the renewals kickoff we chose to retry a failed renewal payment three times over seven days; replaced in August."
anchors:
  - "[[Payments]]"
  - "[[Memberships]]"
sources:
  - "[[Renewals project kickoff]]"
confidence: verbatim
decided_on: 2026-03-04
superseded_by:
  - "[[Retry failed renewal payments four times over ten days]]"
project: "[[Season Ticket Renewals 2027]]"
---

## Context
Auto-renewal will produce failed card payments (expired cards, insufficient funds). We need a rule before building [[Stored card auto-renewal]].

## Decision
Retry on day 1, 3 and 7. Then email the member, and release the seat after 14 days.

## Consequences
Superseded on 2026-08-19 by [[Retry failed renewal payments four times over ten days]].

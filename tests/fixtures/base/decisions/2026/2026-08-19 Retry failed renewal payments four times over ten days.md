---
id: 01M0D36EJ04PGFTYWXD8XG0WR2
type: decision
title: Retry failed renewal payments four times over ten days
status: active
created: 2026-08-19
updated: 2026-08-19
aliases:
  - four retries rule
  - retry policy v2
  - renewal dunning schedule
summary: Failed renewal payments are retried up to four times over ten days, each attempt with the same idempotency key, and the seat is held for 21 days.
anchors:
  - "[[Payments]]"
  - "[[Memberships]]"
  - "[[Kingsport FC]]"
sources:
  - "[[Renewal retry policy review]]"
confidence: verbatim
decided_on: 2026-08-19
supersedes:
  - "[[Retry failed renewal payments three times in one week]]"
project: "[[Season Ticket Renewals 2027]]"
---

## Context
Kingsport FC's July instalment data: three retries in a week recover 54% of failed payments; retries near month-end payday do better. Kingsport FC also wants seats held longer.

## Decision
Up to four retries on day 1, 3, 6 and 10, shifted towards month-end. Every attempt sends the same `Idempotency-Key` for the renewal invoice. Seat released after 21 days. Replaces [[Retry failed renewal payments three times in one week]].

## Consequences
renewal-worker changed under [[Stored card auto-renewal]]. The timeout path did not follow the idempotency rule: [[Duplicate charges on renewal retry]].

---
type: reference
kind: thread
status:
created: 2026-10-11
summary: Priya's #payments thread finding that the PayRail account is still on the default 1, 3 and 5-day retry schedule, not the three days decided.
aliases: []
keywords:
  - card retry
tags: []
review:
url:
author: Priya Raman
published: 2026-10-08
projects:
  - "[[Season Ticket Renewals 2027]]"
topics:
  - "[[Renewal payments]]"
work:
  - "[[Add a grace period setting]]"
---
## Gist

In [[Sources/Slack payments thread 2026-10-08|the #payments thread]], [[Priya Raman]] reports that after the 2026-10-06 standup she checked the [[PayRail]] dashboard: the account is still on PayRail's default schedule (retries on days 1, 3 and 5), so retries run five days, not the three decided. The decision stands; the account was never switched to a custom schedule. She will switch it this week, which needs a PayRail config change and a small [[Club Console]] change so it stops waiting for the day-5 webhook. The grace period starts from `payment.retry_exhausted`, so it will start two days earlier, with no change to the setting. Hard declines are never retried. [[Sam Okafor]] asked her to raise a ticket, and she agreed.

The thread is dated "Wednesday 8 October 2026", but 2026-10-08 is a Thursday.

## Why it matters

What is live differs from [[2026-10-05 Retry failed renewals for three days]] and from [[Renewal payments]]. It answers the standup action on how retries and the grace period line up, for [[Vale Rovers]] and [[Add a grace period setting]]. The ticket for the switch is not in the vault yet.

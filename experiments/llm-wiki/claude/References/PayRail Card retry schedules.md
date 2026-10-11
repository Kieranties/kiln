---
type: reference
kind: doc
status:
created: 2026-10-11
summary: PayRail's documentation for automatic card retries on recurring payments, version 3.2, covering declines, schedules, smart timing, webhooks and grace periods.
aliases:
  - Card retry schedules
keywords:
  - card retry
  - soft decline
  - hard decline
tags: []
review:
url: https://docs.payrail.example/recurring/retries
author: PayRail
published: 2026-09-01
projects:
  - "[[Season Ticket Renewals 2027]]"
topics:
  - "[[Renewal payments]]"
work:
  - "[[Add a grace period setting]]"
---
## Gist

[[Sources/PayRail Card retry schedules.pdf|PayRail's docs page]] (version 3.2) explains how [[PayRail]] retries failed recurring card payments. Soft declines are retried; hard declines (lost or stolen card, closed account, fraud) never are, and `payment.retry_exhausted` is sent straight away. The default schedule retries three times, 1, 3 and 5 days after the failure. A custom schedule has 1 to 10 retries within 14 days, and changes apply only to failures from the next day. Smart timing, off by default, may move a retry by up to 24 hours. PayRail does not manage grace periods: start one from `payment.retry_exhausted` in your own system.

## Why it matters

It is the vendor contract behind [[Renewal payments]]. PayRail's default schedule (days 1, 3 and 5) is not the daily-for-three-days schedule in [[2026-10-05 Retry failed renewals for three days]], so that decision needs a custom schedule; which one is live is what [[Priya Raman]] agreed to check. It also says the grace period in [[Add a grace period setting]] is ours to run, starting from `payment.retry_exhausted`, which for a hard decline arrives with no retries at all.

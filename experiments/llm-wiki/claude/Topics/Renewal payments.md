---
type: topic
kind:
status: active
created: 2026-09-15
summary: How season ticket renewal payments are taken and retried when a card fails.
aliases: []
keywords:
  - card retry
  - dunning
tags:
  - payments
review: "Durable facts say failed renewals are retried daily for three days (2026-10-06 standup transcript), but the 2026-10-08 Slack thread says the PayRail account is still on the default schedule of days 1, 3 and 5."
verified: 2026-10-08
topics: []
products:
  - "[[Club Console]]"
---
## Overview

Renewals charge the saved card on the renewal date.

Card payments go through [[PayRail]], which retries a failed recurring payment automatically on a schedule we set. What happens after the last retry, such as a grace period before a seat is released, is ours to run ([[PayRail Card retry schedules|PayRail docs]]).

## Durable facts

- A failed card is retried; each retry is a new charge attempt.
- Each PayRail retry is a new charge attempt and may appear on the supporter's statement as a pending authorisation ([[PayRail Card retry schedules|PayRail docs]]).
- PayRail retries soft declines (insufficient funds, a limit reached, issuer unavailable). It never retries hard declines (lost or stolen card, closed account, fraud) and sends `payment.retry_exhausted` straight away ([[PayRail Card retry schedules|PayRail docs]]; confirmed in the [[2026-10-08 Slack payments thread|Slack thread]]).
- PayRail's default schedule retries three times: 1, 3 and 5 days after the failure. A custom schedule has 1 to 10 retries, all within 14 days, and a change applies only to failures from the next day ([[PayRail Card retry schedules|PayRail docs]]).
- PayRail's smart timing, off by default, may move a retry by up to 24 hours towards a likelier time, never past the schedule's last day ([[PayRail Card retry schedules|PayRail docs]]).
- PayRail does not hold or release anything: a grace period should start from `payment.retry_exhausted` and be managed in our own system ([[PayRail Card retry schedules|PayRail docs]]).
- At [[Vale Rovers]], card failures are more common for phone renewals, where a club staff member enters the card; many older supporters renew this way ([[Vale Rovers — onboarding notes|onboarding notes]]).
- A failed renewal card is retried daily for three days, then the supporter is emailed, as [[2026-10-05 Retry failed renewals for three days|decided on 2026-10-05]] ([[2026-10-06 Renewals standup — transcript|standup transcript]]).
- The grace period before a seat is released is a per-club [[Club Console]] setting, default seven days after the last retry and up to thirty; it was in review on 2026-10-06 ([[2026-10-06 Renewals standup — transcript|standup transcript]]).
- As of 2026-10-08 our PayRail account is still on the default schedule, so in practice retries run for five days; the three-day decision stands but was never configured. Switching needs a PayRail config change and a Club Console change so it stops waiting for the day-5 webhook ([[2026-10-08 Slack payments thread|Slack thread]]).
- The grace period starts from `payment.retry_exhausted`, so a shorter retry schedule starts it earlier, with no change to the setting ([[2026-10-08 Slack payments thread|Slack thread]]).

## Notes

## Sub-topics

![[topic-sub-topics.base]]

## Research

![[topic-research.base]]

## Decisions

![[topic-decisions.base]]

## References

![[topic-references.base]]

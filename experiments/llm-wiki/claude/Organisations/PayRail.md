---
type: organisation
kind: vendor
status: active
created: 2026-10-11
summary: The card payments provider behind our platform, which takes and retries renewal payments for the clubs.
aliases: []
keywords:
  - payments
tags: []
review:
organisations: []
---
## Overview

PayRail takes card payments for our client clubs: [[Vale Rovers]]' payments run through PayRail on our platform account, with weekly payouts to the club ([[Vale Rovers — onboarding notes|onboarding notes]]). It retries failed recurring card payments automatically; how it does so is on [[Renewal payments]] ([[PayRail Card retry schedules|PayRail docs]]).

## Working with them

We configure retries on our platform account, under Settings › Recurring › Retries or with the `retry_schedule` field on the account API, and receive `payment.retry_scheduled`, `payment.retry_succeeded` and `payment.retry_exhausted` webhooks. Their docs are at docs.payrail.example ([[PayRail Card retry schedules|PayRail docs]]).

## Notes

## People

![[organisation-people.base]]

## Products

![[organisation-products.base]]

## Projects

![[organisation-projects.base]]

## Meetings

![[organisation-meetings.base]]

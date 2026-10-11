---
type: work
kind: bug
status: active
created: 2026-10-03
summary: Some renewals are dated a year late when the season crosses a year boundary.
aliases: []
keywords: []
tags: []
review: "Issue 88 says this was fixed by PR 91 and closed on 2026-10-07, with all 312 renewals corrected by the 2026-10-06 nightly batch, but the status is still active. The summary blames the season crossing a year boundary; the issue says nextDate() compares against the season end instead of the renewal window start. Context also says the complaint came during the renewals window, but the Vale Rovers onboarding notes and the 2026-10-06 standup transcript say the window opens on 1 November."
jira:
  - https://jira.northwind-arena.example/browse/NWA-142
github:
  - https://github.example/northwind-arena/club-console/issues/88
  - https://github.example/northwind-arena/club-console/pull/91
priority: high
projects:
  - "[[Season Ticket Renewals 2027]]"
products:
  - "[[Club Console]]"
---
## Context

Found by [[Priya Raman]] from a supporter complaint during the renewals window.

## Checkpoints

- 2026-10-06: cause found in the season end date; fix in review.

## Outcome

## Decisions

![[work-decisions.base]]

## Meetings

![[work-meetings.base]]

## References

![[work-references.base]]

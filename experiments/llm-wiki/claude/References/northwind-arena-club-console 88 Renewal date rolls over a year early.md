---
type: reference
kind: ticket
created: 2026-10-03
summary: The GitHub issue for the renewal date rollover bug, which affected 312 Vale Rovers renewals and was closed by PR 91 on 2026-10-07.
aliases: []
keywords: []
tags: []
review:
url: https://github.example/northwind-arena/club-console/issues/88
author: Priya Raman
published: 2026-10-03
projects:
  - "[[Season Ticket Renewals 2027]]"
topics: []
work:
  - "[[Fix renewal date rollover]]"
  - "[[Send renewal reminder emails]]"
---
## Gist

Renewals created after the season end date get next year's date.

[[Sources/club-console issue 88|The issue]], opened by [[Priya Raman]], says `RenewalSchedule.nextDate()` adds a year whenever the creation date is after the season end date, when it should compare against the renewal window start. A renewal created on 1 October 2026 for a season ending 30 September 2026 showed 1 November 2027 instead of 1 November 2026. 312 [[Vale Rovers]] renewals created since 1 October had the wrong date, in the [[Fan App]] and in the reminder emails. Reminders were not re-sent, because the nightly renewal batch recalculates open renewals. Priya closed it on 7 October: fixed by PR 91, and the 6 October batch corrected all 312.

## Why it matters

Supporters see the wrong renewal date.

The bug is fixed, so [[Fix renewal date rollover]] and the [[Season Ticket Renewals 2027]] current state, which still show it open, are out of date. It also explains the cause differently from the work note's summary.

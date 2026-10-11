---
type: decision
kind:
status: accepted
created: 2026-10-05
summary: Failed renewal payments are retried daily for three days, then the supporter is emailed.
aliases: []
keywords: []
tags: []
review: "Not live yet: the 2026-10-08 Slack thread says the PayRail account is still on the default schedule (days 1, 3 and 5), so retries run five days. Priya says the decision stands and she will switch the account."
decided: 2026-10-05
projects:
  - "[[Season Ticket Renewals 2027]]"
research:
  - "[[2026-10-02 How do card retries affect renewals]]"
supersedes: []
---
## Context

Proposed by [[Priya Raman]]: retries beyond three days recovered almost nothing.

## Decision

Retry daily for three days, then email the supporter.

## Consequences

Fewer duplicate charge attempts.

## Superseded by

![[decision-superseded-by.base]]

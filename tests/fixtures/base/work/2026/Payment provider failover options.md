---
id: 01M22SF690NM03DW7D9N09WKS6
type: work
kind: research
title: Payment provider failover options
status: active
created: 2026-09-09
updated: 2026-09-30
aliases:
  - NWA-345
  - second acquirer research
  - card payment redundancy
summary: Research whether a second card acquirer can take matchday payments when the main payment provider is failing.
anchors:
  - "[[Payments]]"
  - "[[PCI compliance]]"
sources:
  - "[[Payments weekly 9 September]]"
confidence: verbatim
ticket: NWA-345
last_checkpoint: 2026-09-30
---

## Summary
Asked for by [[Gareth Pryce]] after [[Matchday checkout outage 14 March]] and the provider's 504 storm on 2 September. Owner: [[Tomasz Wielgosz]]. Feeds the proposal [[Add a secondary acquirer for matchday failover]].

## Checkpoints
- 2026-09-09: started.
- 2026-09-30: two acquirers shortlisted. Both support network tokens, so stored cards could move without re-collecting card details.

## Open items
- Cost estimate for both shortlisted acquirers
- PCI view from Bea
- Routing rule test in sandbox (error rate over 5% for 2 minutes)

## Outcome

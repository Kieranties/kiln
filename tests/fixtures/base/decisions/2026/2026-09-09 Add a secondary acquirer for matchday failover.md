---
id: 01M237YEG0KDXS34KY0FBWQ3QB
type: decision
title: Add a secondary acquirer for matchday failover
status: proposed
created: 2026-09-09
updated: 2026-09-09
aliases:
  - payment failover proposal
  - backup acquirer
summary: "Proposal to route matchday card payments to a second acquirer when the main provider's error rate stays above 5% for two minutes."
anchors:
  - "[[Payments]]"
sources:
  - "[[Payments weekly 9 September]]"
confidence: verbatim
decided_on: 2026-09-09
---

## Context
Two matchday-impacting payment problems this year: [[Matchday checkout outage 14 March]] and the provider's 504 storm on 2 September.

## Decision
Proposed by [[Tomasz Wielgosz]]: automatic failover to a secondary acquirer on matchdays when the primary's error rate is over 5% for 2 minutes. Not agreed yet.

## Consequences
Needs a cost estimate and a PCI view, both tracked in [[Payment provider failover options]].

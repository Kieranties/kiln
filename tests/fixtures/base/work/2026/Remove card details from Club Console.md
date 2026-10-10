---
id: 01KPTSAS60C81J6DXBGD216CXF
type: work
kind: chore
title: Remove card details from Club Console
status: active
created: 2026-04-22
updated: 2026-09-09
aliases:
  - NWA-338
  - console card field removal
  - PCI scope reduction
summary: Remove every card number and expiry field from Club Console screens and exports so the platform can move to reduced PCI scope.
anchors:
  - "[[Club Console]]"
  - "[[PCI compliance]]"
  - "[[Payments]]"
sources:
  - "[[Security and compliance review April]]"
confidence: verbatim
ticket: NWA-338
last_checkpoint: 2026-09-09
---

## Summary
Follows [[Hold card data only as payment provider tokens]]. Must land before the November assessment. Owner: [[Tomasz Wielgosz]]; review by [[Bea Fontaine]]. Background: [[Club Console PCI scope thread]].

## Checkpoints
- 2026-04-22: started; 14 screens and 3 CSV exports in scope.
- 2026-07-15: member lookup and order screens done.
- 2026-09-09: refund screen rebuilt on token references; in test.

## Open items
- Ship the new refund screen
- Remove card columns from the finance CSV export
- Assessor walkthrough with Bea

## Outcome

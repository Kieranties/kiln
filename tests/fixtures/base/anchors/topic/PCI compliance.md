---
id: 01KPRBGHP0BTG5NSHPBB94ZQRX
type: anchor
kind: topic
title: PCI compliance
status: active
created: 2026-04-21
updated: 2026-09-09
aliases:
  - PCI DSS
  - card data scope
  - SAQ
summary: Our obligations for handling card data, and the work to reduce how much of the platform is in scope before the November 2026 assessment.
anchors:
  - "[[Payments]]"
sources:
  - "[[Security and compliance review April]]"
confidence: verbatim
---

## Summary
2026-09-09: assessment due November 2026. Moving from the full questionnaire to reduced scope depends on Club Console no longer showing card details.

## Facts
- Owner: [[Bea Fontaine]].
- Fan App and web checkout already use provider tokens only.
- Any secondary acquirer must also be token-based to stay in reduced scope.

## Known issues
- Club Console refund screen still lets staff key a card number.

## Decisions
- [[Hold card data only as payment provider tokens]]

## Open work
- [[Remove card details from Club Console]]

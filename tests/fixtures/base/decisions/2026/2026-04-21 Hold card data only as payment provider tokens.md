---
id: 01KPQYXQ20EE002SB6S6B0RKQV
type: decision
title: Hold card data only as payment provider tokens
status: active
created: 2026-04-21
updated: 2026-04-21
aliases:
  - tokenised cards only
  - no stored PAN
summary: "We never store or show card numbers or expiry dates; card data exists only as payment provider tokens."
anchors:
  - "[[Payments]]"
  - "[[PCI compliance]]"
  - "[[Club Console]]"
sources:
  - "[[Security and compliance review April]]"
confidence: verbatim
decided_on: 2026-04-21
---

## Context
Club Console shows last-4 and expiry and lets staff key card numbers for refunds, which keeps the whole platform in full PCI scope.

## Decision
Card data held only as provider tokens (`vault_token`). No PAN or expiry stored or displayed. Refunds use token references.

## Consequences
[[Remove card details from Club Console]] removes card fields from Club Console. Any second acquirer must be token-based.

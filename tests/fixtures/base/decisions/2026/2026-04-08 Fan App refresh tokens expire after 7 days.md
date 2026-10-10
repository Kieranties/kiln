---
id: 01KNPM90Z0K077NXJ15018TH93
type: decision
title: Fan App refresh tokens expire after 7 days
status: superseded
created: 2026-04-08
updated: 2026-07-22
aliases:
  - 7-day refresh tokens
  - session length v2
summary: "In April the Fan App moved to 1-hour access tokens and refresh tokens that expire 7 days after issue; replaced in July."
anchors:
  - "[[Identity]]"
  - "[[Fan App]]"
sources:
  - "[[Identity steering group April]]"
confidence: verbatim
decided_on: 2026-04-08
supersedes:
  - "[[Fan App sign-in sessions last 30 days]]"
superseded_by:
  - "[[Rotate Fan App refresh tokens with a 14-day lifetime]]"
---

## Context
Reports from Kingsport FC of children buying tickets on a parent's account on shared tablets. auth-legacy was patched to issue refresh tokens.

## Decision
1-hour access tokens plus refresh tokens with a fixed 7-day lifetime (not sliding). Replaces [[Fan App sign-in sessions last 30 days]].

## Consequences
Biometric unlock added to the [[Fan App]] to soften extra sign-ins.
Superseded on 2026-07-22 by [[Rotate Fan App refresh tokens with a 14-day lifetime]].

---
id: 01KFDDWJT05DAD9P44S1EB055E
type: decision
title: Fan App sign-in sessions last 30 days
status: superseded
created: 2026-01-20
updated: 2026-04-08
aliases:
  - 30-day sessions
  - session length v1
summary: "In January Fan App sign-in sessions were extended from 24 hours to 30 days; replaced in April by 7-day refresh tokens."
anchors:
  - "[[Identity]]"
  - "[[Fan App]]"
sources:
  - "[[Identity steering group January]]"
confidence: verbatim
decided_on: 2026-01-20
superseded_by:
  - "[[Fan App refresh tokens expire after 7 days]]"
---

## Context
Fans were being signed out on match mornings with a 24-hour session. Kingsport FC forwarded about 60 complaints.

## Decision
Fan App sessions last 30 days (`auth.session.max_age=30d`), revoked on password change or "sign out everywhere". Club Console stays at 8 hours.

## Consequences
Fewer sign-ins on matchday. Long-lived sessions on shared devices became a concern.
Superseded on 2026-04-08 by [[Fan App refresh tokens expire after 7 days]].

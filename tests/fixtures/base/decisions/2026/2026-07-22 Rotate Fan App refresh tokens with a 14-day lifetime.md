---
id: 01KY4HBQZ01B30AF0HWTZHVSR7
type: decision
title: Rotate Fan App refresh tokens with a 14-day lifetime
status: active
created: 2026-07-22
updated: 2026-07-22
aliases:
  - 14-day rotating refresh tokens
  - session length v3
  - refresh token rotation
summary: "Fan App refresh tokens last 14 days and rotate on every use; reusing an old token revokes the whole family."
anchors:
  - "[[Identity]]"
  - "[[Fan App]]"
sources:
  - "[[Identity steering group July]]"
confidence: verbatim
decided_on: 2026-07-22
supersedes:
  - "[[Fan App refresh tokens expire after 7 days]]"
project: "[[Identity Platform Migration]]"
---

## Context
After the 7-day rule, forced sign-ins rose 3.4x and matchday support tickets about opening tickets at the turnstile doubled ([[Hannah Varga]]'s numbers).

## Decision
Refresh tokens get a 14-day lifetime and rotate on every use, with reuse detection. Config `fanapp.refresh.ttl=14d`, `fanapp.refresh.rotate=true`. Replaces [[Fan App refresh tokens expire after 7 days]].

## Consequences
Carried into the new identity provider by [[OIDC login for the Fan App]].

---
id: 01KJA3M4W0EY5FWBDABJ0T0133
type: decision
title: Password reset links stay valid for 15 minutes
status: active
created: 2026-02-25
updated: 2026-02-25
aliases:
  - reset link lifetime
  - reset token TTL
summary: Password reset links are single-use and expire after 15 minutes, following a pen test finding.
anchors:
  - "[[Identity]]"
sources:
  - "[[Identity security review February]]"
confidence: verbatim
decided_on: 2026-02-25
---

## Context
Pen test finding PT-2026-04: reset links lasted 24 hours and could be reused.

## Decision
Single-use links, valid 15 minutes (`identity.reset.token_ttl=900`). Lock sign-in for 15 minutes after 10 failed attempts.

## Consequences
Slow email delivery now makes links expire before fans open them: [[Password reset links expire too early]].

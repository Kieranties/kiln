---
id: 01M3PPGW80ZGF56TVY0VBQ8AY9
type: work
kind: bug
title: Password reset links expire too early
status: blocked
created: 2026-09-29
updated: 2026-09-30
aliases:
  - NWA-341
  - reset emails arrive late
  - expired reset link
summary: "Password reset emails arrive after their 15-minute link has expired because the email provider throttles us; blocked until the provider raises our send rate."
keywords:
  - RESET_TOKEN_EXPIRED
  - notify-svc
anchors:
  - "[[Identity]]"
  - "[[Fan App]]"
sources:
  - "[[NWA-341 Password reset links expire before they arrive]]"
confidence: verbatim
ticket: NWA-341
last_checkpoint: 2026-09-30
---

## Summary
Reset links last 15 minutes ([[Password reset links stay valid for 15 minutes]]). At peak, emails take 10 to 25 minutes because the email delivery provider caps us at 50 messages/second. Fans click and get `RESET_TOKEN_EXPIRED`. Owner: [[Mei Lin Zhou]].

## Checkpoints
- 2026-09-29: raised by fan support.
- 2026-09-30: blocked on provider support case 88213 to raise the send rate. Keeping the 15-minute lifetime.

## Open items
- Provider raises our send rate limit
- Put reset emails in their own high-priority queue in notify-svc
- Check delivery times at peak for one week after the change

## Outcome

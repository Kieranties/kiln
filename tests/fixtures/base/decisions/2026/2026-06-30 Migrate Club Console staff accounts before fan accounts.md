---
id: 01KWC824Q0DX2XD5XFMJ5DAZYH
type: decision
title: Migrate Club Console staff accounts before fan accounts
status: active
created: 2026-06-30
updated: 2026-06-30
aliases:
  - migration order
  - staff before fans
summary: The identity migration moves Club Console staff accounts first, club by club, and fan accounts afterwards.
anchors:
  - "[[Identity]]"
  - "[[Club Console]]"
  - "[[Fan App]]"
sources:
  - "[[Identity migration planning]]"
confidence: verbatim
decided_on: 2026-06-30
project: "[[Identity Platform Migration]]"
---

## Context
About 640 staff accounts against 74,000 fan accounts. Staff use managed browsers, and the passkeys pilot needs them on the new provider.

## Decision
Staff first in three batches (Kingsport FC, Harbour Athletic, Vale Rovers), then fans through [[OIDC login for the Fan App]].

## Consequences
Tracked in [[Move Club Console staff accounts to the new identity provider]].

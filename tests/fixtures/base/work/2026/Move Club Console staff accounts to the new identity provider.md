---
id: 01KWEJCP003S69M0PR98ZVPHQY
type: work
kind: chore
title: Move Club Console staff accounts to the new identity provider
status: active
created: 2026-07-01
updated: 2026-09-22
aliases:
  - NWA-334
  - staff account migration
  - console SSO move
summary: Move about 640 Club Console staff accounts to the new identity provider, one club at a time.
anchors:
  - "[[Club Console]]"
  - "[[Identity]]"
  - "[[Kingsport FC]]"
  - "[[Harbour Athletic]]"
  - "[[Vale Rovers]]"
sources:
  - "[[Identity migration planning]]"
confidence: verbatim
project: "[[Identity Platform Migration]]"
ticket: NWA-334
last_checkpoint: 2026-09-22
---

## Summary
Follows [[Migrate Club Console staff accounts before fan accounts]]. Three batches: Kingsport FC (228 accounts), Harbour Athletic (260), Vale Rovers (152). Each batch: export from auth-legacy, invite email, forced password set on first sign-in. Owner: [[Mei Lin Zhou]].

## Checkpoints
- 2026-07-01: migration script written (`scripts/migrate_staff.ts`).
- 2026-09-22: batch 1, Kingsport FC, migrated: 228 of 228.

## Open items
- Migrate Harbour Athletic staff (batch 2)
- Migrate Vale Rovers staff (batch 3)
- Switch off auth-legacy sign-in for Club Console

## Outcome

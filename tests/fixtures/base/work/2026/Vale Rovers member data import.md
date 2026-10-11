---
id: 01KT3VNCH0VYREFEE415KWS7ZX
type: work
kind: chore
title: Vale Rovers member data import
status: done
created: 2026-06-02
updated: 2026-07-24
aliases:
  - NWA-301
  - Rovers member migration
summary: Imported Vale Rovers members from their old system into Memberships before go-live.
anchors:
  - "[[Vale Rovers]]"
  - "[[Memberships]]"
sources:
  - "[[NWA-301 Import Vale Rovers member records]]"
confidence: verbatim
project: "[[Vale Rovers Onboarding]]"
ticket: NWA-301
last_checkpoint: 2026-07-24
---

## Summary
Owner: [[Hannah Varga]]. Source file `vr_members_2026.csv`.

## Checkpoints
- 2026-06-02: started.
- 2026-06-20: dry run 2: 312 duplicates, 298 merged automatically.
- 2026-07-24: production import finished.

## Open items

## Outcome
18,100 members live. Tiers mapped to `VR-GOLD`, `VR-SILVER`, `VR-JUNIOR`. Season ticket history and loyalty points were not imported (out of scope), which later became [[Rovers season ticket history and loyalty points missing]].

---
id: 01KT4HMGH0WPSN11TP0YFJ9Y8M
type: source
kind: jira
title: NWA-301 Import Vale Rovers member records
created: 2026-06-02
updated: 2026-06-02
source_id: NWA-301
dedupe_key: "jira:NWA-301"
url: "https://jira.northwind-arena.example/browse/NWA-301"
captured_at: "2026-06-02T09:45:00.000Z"
captured_by: manual
why: Rovers member import ticket
triage: linked
linked_to:
  - "[[Vale Rovers member data import]]"
triage_outcome: new-work-item
---

**NWA-301** · Chore · Status: Done · Assignee: Hannah Varga
Components: membership-svc, data-import

**Description**
Import Vale Rovers' member export (`vr_members_2026.csv`) into membership-svc. Merge duplicates by email + date of birth. Map their tiers Gold, Silver and Junior to `VR-GOLD`, `VR-SILVER`, `VR-JUNIOR`.

**Comments**
- 2026-06-20 Hannah Varga: dry run 2: 312 duplicates, 298 merged automatically, 14 left for Lucy's team to check by hand.
- 2026-07-24 Hannah Varga: production import done. 18,100 members live. Spot checks with Lucy all fine.

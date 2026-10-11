---
id: 01KNPQBX10MJES9BQ4A4YJV781
type: source
kind: meeting
title: Identity steering group April
created: 2026-04-08
updated: 2026-04-08
source_id: mtg-2026-04-08-identity-steering
dedupe_key: "meeting:mtg-2026-04-08-identity-steering"
url: "https://notes.northwind-arena.example/meetings/2026-04-08-identity-steering"
captured_at: "2026-04-08T16:00:00.000Z"
captured_by: manual
why: Session length revisited
triage: linked
linked_to:
  - "[[Fan App refresh tokens expire after 7 days]]"
  - "[[Fan App sign-in sessions last 30 days]]"
triage_outcome: supersede
---

# Identity steering group, 8 April

Attendees: Mei Lin Zhou, Bea Fontaine, Gareth Pryce, Jamal Whitfield

- Bea: two reports from Kingsport FC of family accounts on shared tablets where a child bought tickets on a parent's card. A 30-day session with no re-check is too long.
- auth-legacy has been patched to issue refresh tokens (a stopgap until the new identity provider).
- Jamal: biometric unlock in the app can soften more frequent sign-ins.

**Decision:** Fan App moves to 1-hour access tokens plus refresh tokens that expire **7 days** after issue (fixed, not sliding). This replaces the 30-day sessions agreed in January.

Actions: Mei to ship with the April app release; Jamal to add biometric re-unlock; Hannah to watch sign-in volume.

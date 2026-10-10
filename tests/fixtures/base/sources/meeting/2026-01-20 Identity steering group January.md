---
id: 01KFE0C0K07R4V351N8JHWA3R1
type: source
kind: meeting
title: Identity steering group January
created: 2026-01-20
updated: 2026-01-20
source_id: mtg-2026-01-20-identity-steering
dedupe_key: "meeting:mtg-2026-01-20-identity-steering"
url: "https://notes.northwind-arena.example/meetings/2026-01-20-identity-steering"
captured_at: "2026-01-20T16:05:00.000Z"
captured_by: manual
why: Session length decision for the Fan App
triage: linked
linked_to:
  - "[[Fan App sign-in sessions last 30 days]]"
  - "[[Identity]]"
triage_outcome: new-decision
---

# Identity steering group, 20 Jan

Attendees: Mei Lin Zhou, Gareth Pryce, Jamal Whitfield, Bea Fontaine

## Notes
- Fan App sign-in today gets one opaque session cookie from auth-legacy, no refresh token. Max age is 24h (`auth.session.max_age=24h`).
- Kingsport FC has forwarded ~60 complaints since Christmas: fans logged out on the morning of a match and stuck at the gate trying to remember a password.
- Bea is OK with long sessions as long as a password change or "sign out everywhere" revokes them. auth-legacy can do that via the `session_revocations` table.
- Mei: auth-legacy cannot issue refresh tokens at all. Longer term we need a proper OIDC provider. Gareth wants that scoped as its own piece of work.

## Agreed
- Fan App sessions last **30 days**. Revoked on password change and on "sign out everywhere".
- Club Console sessions stay at 8h.

## Actions
- Mei: change `auth.session.max_age` to 30d before the end of January.
- Bea: write up the revocation behaviour for support.
- Gareth: bring a proposal for replacing auth-legacy to the Q2 planning.

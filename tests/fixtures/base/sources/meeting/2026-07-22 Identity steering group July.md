---
id: 01KY5B7CB02F6SBY3C98BBN72F
type: source
kind: meeting
title: Identity steering group July
created: 2026-07-22
updated: 2026-07-22
source_id: mtg-2026-07-22-identity-steering
dedupe_key: "meeting:mtg-2026-07-22-identity-steering"
url: "https://notes.northwind-arena.example/meetings/2026-07-22-identity-steering"
captured_at: "2026-07-22T16:00:00.000Z"
captured_by: manual
why: Refresh token lifetime changed again
triage: linked
linked_to:
  - "[[Rotate Fan App refresh tokens with a 14-day lifetime]]"
  - "[[Fan App refresh tokens expire after 7 days]]"
triage_outcome: supersede
---

# Identity steering group, 22 July

Attendees: Mei Lin Zhou, Bea Fontaine, Jamal Whitfield, Hannah Varga

- Hannah: since the 7-day refresh tokens, forced sign-ins are up 3.4x. Matchday support tickets "can't open my tickets at the turnstile" doubled.
- Bea is fine with longer lifetimes if stolen tokens can be detected.

**Decision:** refresh tokens get a **14-day** lifetime and rotate on every use. Reusing an old refresh token revokes the whole token family. This replaces the April 7-day rule.
Config: `fanapp.refresh.ttl=14d`, `fanapp.refresh.rotate=true`.

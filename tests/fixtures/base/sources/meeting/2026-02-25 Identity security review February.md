---
id: 01KJA2RNZ0G5CMT9B7DQWSS9CA
type: source
kind: meeting
title: Identity security review February
created: 2026-02-25
updated: 2026-02-25
source_id: mtg-2026-02-25-identity-security-review
dedupe_key: "meeting:mtg-2026-02-25-identity-security-review"
url: "https://notes.northwind-arena.example/meetings/2026-02-25-identity-security-review"
captured_at: "2026-02-25T14:00:00.000Z"
captured_by: manual
why: Pen test follow-up on password resets
triage: linked
linked_to:
  - "[[Password reset links stay valid for 15 minutes]]"
  - "[[Identity]]"
triage_outcome: new-decision
---

# Identity security review, February

Attendees: Bea Fontaine, Mei Lin Zhou, Sofia Marchetti

Pen test finding PT-2026-04 (medium): password reset links are valid for 24 hours and can be used more than once.

Agreed
- Reset links become single-use and expire after **15 minutes**: `identity.reset.token_ttl=900`.
- Lock sign-in for 15 minutes after 10 failed attempts.
- Error shown on an expired link: `RESET_TOKEN_EXPIRED`, with a button to send a new one.

Mei to ship in the March release. Sofia to add regression tests.

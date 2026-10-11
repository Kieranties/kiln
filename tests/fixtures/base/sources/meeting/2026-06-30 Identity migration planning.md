---
id: 01KWCKSGE0WD1FKC9F5RKB1TA9
type: source
kind: meeting
title: Identity migration planning
created: 2026-06-30
updated: 2026-06-30
source_id: mtg-2026-06-30-identity-migration-planning
dedupe_key: "meeting:mtg-2026-06-30-identity-migration-planning"
url: "https://notes.northwind-arena.example/meetings/2026-06-30-identity-migration-planning"
captured_at: "2026-06-30T15:00:00.000Z"
captured_by: manual
why: Identity migration order
triage: linked
linked_to:
  - "[[Migrate Club Console staff accounts before fan accounts]]"
  - "[[Move Club Console staff accounts to the new identity provider]]"
  - "[[OIDC login for the Fan App]]"
  - "[[Identity Platform Migration]]"
triage_outcome: new-decision
---

# Identity migration planning (Keystone)

Attendees: Mei Lin Zhou, Nora Kestrel, Jamal Whitfield, Priya Raman, Bea Fontaine

- New OIDC identity provider at `idp.northwind-arena.example` is up in staging.
- Target: retire auth-legacy by **31 March 2027**.
- About 640 Club Console staff accounts across the three clubs; about 74,000 fan accounts.

**Decision:** Club Console staff accounts move first, club by club, then fans. Smaller population, managed devices, and it lines up with the passkeys pilot.

Tickets
- NWA-334: staff migration in batches by club.
- NWA-330: Fan App sign-in through OIDC (authorization code + PKCE).

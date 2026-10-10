---
id: 01KGHSF2Q0TNG759CXMGS0S46T
type: source
kind: meeting
title: Architecture forum event bus options
created: 2026-02-03
updated: 2026-02-03
source_id: mtg-2026-02-03-arch-forum-event-bus
dedupe_key: "meeting:mtg-2026-02-03-arch-forum-event-bus"
url: "https://notes.northwind-arena.example/meetings/2026-02-03-arch-forum-event-bus"
captured_at: "2026-02-03T15:30:00.000Z"
captured_by: manual
why: Event bus choice
triage: linked
linked_to:
  - "[[Run a self-hosted event broker for platform events]]"
  - "[[Build self-hosted event broker cluster]]"
triage_outcome: new-decision
---

# Architecture forum: event bus options

Attendees: Gareth Pryce, Daniel Okafor, Priya Raman, Tomasz Wielgosz, Mei Lin Zhou

Problem: membership-svc, ticketing-svc and payments-svc call each other's webhooks directly. Renewals need fan-out (a renewal touches membership, ticket entitlement, payment, email). We keep losing webhook calls when a consumer is mid-deploy.

Options
1. Keep point-to-point webhooks, add a retry table. Cheap, but the coupling stays.
2. Self-hosted event broker, 3 brokers on our own VMs, run by Danny's platform team.
3. Managed message queue from our cloud provider.

Discussion
- Peak volume estimate for a derby on-sale: ~2.1M events in a day.
- Tomasz worried about per-message pricing of option 3 at that peak, and lock-in.
- Danny has run brokers before; thinks 3 nodes + 7-day retention is manageable.

Decision: option 2. Topics `membership.events`, `ticket.events`, `payment.events`. Retention 7 days. Platform team operates it.

Actions
- Danny: raise NWA-205 for the build, target end of March.
- Priya: define the event envelope (`event_id`, `type`, `occurred_at`, `club_id`).

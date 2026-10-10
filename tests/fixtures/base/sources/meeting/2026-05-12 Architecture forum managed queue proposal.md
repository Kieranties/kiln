---
id: 01KRDQWGP0X28BQ56C93P535N5
type: source
kind: meeting
title: Architecture forum managed queue proposal
created: 2026-05-12
updated: 2026-05-12
source_id: mtg-2026-05-12-arch-forum-managed-queue
dedupe_key: "meeting:mtg-2026-05-12-arch-forum-managed-queue"
url: "https://notes.northwind-arena.example/meetings/2026-05-12-arch-forum-managed-queue"
captured_at: "2026-05-12T15:30:00.000Z"
captured_by: manual
why: Event bus decision reversed
triage: linked
linked_to:
  - "[[Use the managed message queue for platform events]]"
  - "[[Run a self-hosted event broker for platform events]]"
  - "[[Build self-hosted event broker cluster]]"
triage_outcome: supersede
---

# Architecture forum: managed queue proposal

Attendees: Gareth Pryce, Daniel Okafor, Priya Raman, Tomasz Wielgosz, Hannah Varga

Three months into NWA-205:
- Two broker disk-full incidents (24 March, 30 April). Danny is spending about 40% of his time on the cluster.
- Cross-zone replication still not done.

Cost model redone with real volumes: ~2.1M events on a derby day, about £410/month on the managed queue. That is less than one engineer-week.

**Decision:** platform events move to the managed message queue. NWA-205 is abandoned. Topic names stay. Consumers are at-least-once and dedupe on `event_id`. This replaces the February decision to run our own broker.

Actions
- Danny: migrate producers and consumers by end of June.
- Hannah: switch the analytics export to the queue's export.
- Priya: write it up for the engineering blog.

---
id: 01M4K5JXY0920B28QWF9RF3ANR
type: source
kind: jira
title: NWA-371 Fan App crashes when opening tickets offline
created: 2026-10-10
updated: 2026-10-10
source_id: NWA-371
dedupe_key: "jira:NWA-371"
url: "https://jira.northwind-arena.example/browse/NWA-371"
captured_at: "2026-10-10T11:15:00.000Z"
captured_by: manual
why: New matchday bug
triage: pending
---

**NWA-371** · Bug · Priority: Highest · Status: Open
Reporter: Fan support · Components: fan-app

**Description**
Since app version 6.4.0 (released 7 October), opening a downloaded match ticket with no signal crashes the app as the ticket screen loads (`NullPointerException in TicketQrView.render`). Crash rate was 3.1% of sessions at the turnstiles for Saturday's Kingsport FC home game; stewards let fans in with paper backups.
Online, tickets open fine.

---
id: 01M25PVF90T9XPPYWREF6M29KW
type: source
kind: jira
title: NWA-347 Mid-season membership tier upgrades
created: 2026-09-10
updated: 2026-09-10
source_id: NWA-347
dedupe_key: "jira:NWA-347"
url: "https://jira.northwind-arena.example/browse/NWA-347"
captured_at: "2026-09-10T09:15:00.000Z"
captured_by: manual
why: Tier upgrade request
triage: linked
linked_to:
  - "[[Mid-season membership tier upgrades]]"
triage_outcome: new-work-item
---

**NWA-347** · Story · Status: In Progress
Requester: Kwame Mensah (Harbour Athletic) · Assignee: Priya Raman · Components: membership-svc, payments-svc, fan-app

**Description**
Members should be able to upgrade from Standard to Premium during the season and pay the difference.
Harbour Athletic wants the price prorated by **remaining home fixtures**, not by days left in the season.

**Acceptance criteria**
- Upgrade available in the Fan App and in Club Console.
- Price = (Premium - Standard) x remaining home fixtures / total home fixtures, rounded to the nearest £1.
- Upgrade takes effect for the next home fixture.

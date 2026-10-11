---
id: 01M3PYFCS0ZBPNRCSGXBBN6KBM
type: source
kind: jira
title: NWA-341 Password reset links expire before they arrive
created: 2026-09-29
updated: 2026-09-29
source_id: NWA-341
dedupe_key: "jira:NWA-341"
url: "https://jira.northwind-arena.example/browse/NWA-341"
captured_at: "2026-09-29T14:25:00.000Z"
captured_by: manual
why: Reset link bug
triage: linked
linked_to:
  - "[[Password reset links expire too early]]"
triage_outcome: new-work-item
---

**NWA-341** · Bug · Priority: High · Status: Blocked
Reporter: Fan support · Assignee: Mei Lin Zhou · Components: identity-svc, notify-svc

**Description**
Since mid-September password reset emails take 10 to 25 minutes to arrive at peak times. The email delivery provider throttles us at 50 messages/second. With the 15-minute token lifetime many links are already expired when fans click them (`RESET_TOKEN_EXPIRED`).

**Comments**
- 2026-09-30 Mei Lin Zhou: blocked on the email provider raising our send rate (support case 88213). Not changing the token lifetime, that was a pen test fix.

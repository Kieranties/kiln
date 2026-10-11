northwind-arena/club-console · Issue #88
Renewal date rolls over a year early
https://github.example/northwind-arena/club-console/issues/88
Opened by Priya Raman on 3 October 2026 · Labels: bug, renewals · Closed by #91

## Description

Renewals created after a club's season end date are given next year's renewal date instead of this year's.

## Steps to reproduce

1. Set a club's season end date to 30 September 2026.
2. Create a renewal on 1 October 2026.
3. The renewal date shows 1 November 2027. It should be 1 November 2026.

## Cause

`RenewalSchedule.nextDate()` adds a year whenever the creation date is after the season end date. It should compare against the renewal window start, not the season end.

## Impact

Vale Rovers only so far: 312 renewals created since 1 October have the wrong date. Supporters see the wrong date in the Fan App and in the reminder emails.

---

**Sam Okafor** commented on 3 October 2026

Do we need to re-send reminder emails to the 312?

**Priya Raman** commented on 4 October 2026

No. The nightly renewal batch recalculates dates for open renewals, so they correct themselves the night after the fix ships. I'll check the count after the batch runs.

**Priya Raman** commented on 7 October 2026

Fixed by #91. The nightly batch on 6 October corrected all 312.

#payments · thread · Wednesday 8 October 2026
Exported from Slack.

Priya Raman — 10:12
heads up on renewal retries. I checked the PayRail dashboard after Monday's standup. We're still on PayRail's *default* retry schedule, which retries on day 1, 3 and 5 after the failure. So in practice it's five days, not the three we decided last week 😬

Sam Okafor — 10:15
oh. so the three day decision isn't what's live?

Priya Raman — 10:16
correct. the decision stands, we just never switched the account to a custom schedule. I'll do that this week. needs a config change in PayRail and a small change in the Club Console so it stops waiting for the day 5 webhook

Sam Okafor — 10:18
does that change the grace period maths for Vale Rovers?

Priya Raman — 10:21
grace period starts from `payment.retry_exhausted`, so it just moves earlier by two days once we switch. nothing to change in the setting itself

Priya Raman — 10:22
also worth knowing: hard declines (stolen card, closed account) are never retried by PayRail, whatever the schedule. those go straight to retry_exhausted

Sam Okafor — 10:24
👍 can you raise a ticket so it's on the board?

Priya Raman — 10:25
will do

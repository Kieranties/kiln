<%* const kind = await tp.system.suggester(["feature","bug","chore","incident","task"], ["feature","bug","chore","incident","task"]) -%>
---
type: work
kind: <% kind %>
status: backlog
created: <% tp.date.now("YYYY-MM-DD") %>
summary:
aliases: []
keywords: []
tags: []
review:
jira: []
github: []
priority:
projects: []
products: []
---
## Context

## Checkpoints

## Outcome

## Decisions

![[work-decisions.base]]

## Meetings

![[work-meetings.base]]

## References

![[work-references.base]]

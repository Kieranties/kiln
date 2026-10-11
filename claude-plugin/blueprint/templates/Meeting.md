<%* const kind = await tp.system.suggester(["standup","workshop"], ["standup","workshop"]) -%>
---
type: meeting
kind: <% kind %>
status:
created: <% tp.date.now("YYYY-MM-DD") %>
summary:
aliases: []
keywords: []
tags: []
review:
date: <% tp.file.title.slice(0, 10) %>
attendees: []
projects: []
organisations: []
---
## Notes

## My notes

## Actions

## Decisions

## Work raised

![[meeting-work-raised.base]]

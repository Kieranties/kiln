<%* const kind = await tp.system.suggester(["client","vendor","partner","self"], ["client","vendor","partner","self"]) -%>
---
type: organisation
kind: <% kind %>
status: active
created: <% tp.date.now("YYYY-MM-DD") %>
summary:
aliases: []
keywords: []
tags: []
review:
organisations: []
---
## Overview

## Working with them

## Notes

## People

![[organisation-people.base]]

## Products

![[organisation-products.base]]

## Projects

![[organisation-projects.base]]

## Meetings

![[organisation-meetings.base]]

<%*
const yesterday = moment(tp.file.title, "YYYY-MM-DD").subtract(1, "day").format("YYYY-MM-DD");
const tomorrow = moment(tp.file.title, "YYYY-MM-DD").add(1, "day").format("YYYY-MM-DD");
-%>
---
type: daily
kind:
status:
created: <% tp.date.now("YYYY-MM-DD") %>
summary:
aliases: []
keywords: []
tags: []
review:
date: <% tp.file.title %>
---
[[Daily/<% yesterday %>|← yesterday]] · [[Daily/<% tomorrow %>|tomorrow →]]

## Schedule

## What changed

## Scratch

## Reflection

## Captures

![[daily-captures.base]]

## Work touched

![[daily-work-touched.base]]

## Log

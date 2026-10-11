---
id: 01KWM1HHF0CH727A24SN74G34G
type: reference
kind: post
title: Moving platform events to the managed queue
status: active
created: 2026-07-03
updated: 2026-07-03
aliases:
  - managed queue blog post
  - event bus write-up
summary: Engineering blog post on why we gave up running our own event broker and moved platform events to a managed queue.
anchors:
  - "[[Northwind Arena]]"
sources:
  - "[[Architecture forum managed queue proposal]]"
confidence: verbatim
url: "https://engineering.northwind-arena.example/posts/moving-to-a-managed-queue"
---

## Key points
- Written by [[Priya Raman]].
- Covers the two disk-full incidents, the cost model and the at-least-once consumer pattern.

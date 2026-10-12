---
type: kiln-type
name: topic
folder: Topics
template: Topic.md
naming: title
icon: lucide-book-open
color: "#f1fa8c"
statuses:
  - active
  - archived
properties:
  verified: date
  topics: links
  products: links
kinds: {}
sections:
  - Overview
  - Durable facts
  - Notes
views:
  Sub-topics:
    type: topic
    via: topics
  Research:
    type: research
    via: topics
  Decisions:
    type: decision
    via: link
  References:
    type: reference
    via: topics
---
Knowledge about something: how it works and how to handle it, written to outlive the work that prompted it. Research builds topic hubs; a sub-topic names its hub in `topics`.

`verified` is the date the claims were last checked against their live sources. Leave it empty for topics about my own practices.

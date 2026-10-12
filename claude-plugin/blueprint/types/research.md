---
type: kiln-type
name: research
folder: Research
template: Research.md
icon: lucide-flask-conical
color: "#bd93f9"
statuses:
  - open
  - answered
properties:
  question: text
  topics: links
  projects: links
kinds: {}
sections:
  - Question
  - Brief
  - Findings
  - Sources
views:
  Work raised:
    type: work
    via: link
  Decisions:
    type: decision
    via: research
---
A question answered on a date, such as where our own system diverges from a documented contract. It records findings and does not fix them: each finding becomes a work item.

Durable knowledge it uncovers goes on a topic.

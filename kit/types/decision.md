---
type: kiln-type
name: decision
folder: Decisions
template: Decision.md
icon: lucide-gavel
color: "#ffb86c"
statuses:
  - proposed
  - accepted
  - superseded
properties:
  decided: date
  projects: links
  research: links
  supersedes: links
kinds: {}
sections:
  - Context
  - Decision
  - Consequences
views:
  Superseded by:
    type: decision
    via: supersedes
---
One decision, linked to the projects it belongs to and the research behind it. When a later decision replaces it, the new one lists it in `supersedes` and this one becomes `superseded`.

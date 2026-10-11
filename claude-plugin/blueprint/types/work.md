---
type: kiln-type
name: work
folder: Work
template: Work.md
icon: lucide-square-check
color: "#8be9fd"
statuses:
  - backlog
  - active
  - blocked
  - review
  - done
  - abandoned
properties:
  jira: list
  github: list
  priority: text
  projects: links
  products: links
kinds:
  feature:
    icon: lucide-sparkles
  bug:
    icon: lucide-bug
    color: "#ff5555"
  chore:
    icon: lucide-hammer
  incident:
    icon: lucide-siren
    color: "#ff5555"
  task:
    icon: lucide-circle-check
sections:
  - Context
  - Checkpoints
  - Outcome
views:
  Decisions:
    type: decision
    via: link
  Meetings:
    type: meeting
    via: link
  References:
    type: reference
    via: work
---
A piece of work: a feature, bug, chore or incident, or a personal task. The ticket is the team's record; this note is mine, so `jira` and `github` link to the tickets, issues and PRs rather than copying them.

The status is the card's column on the board. Checkpoints are dated lines saying where things stand.

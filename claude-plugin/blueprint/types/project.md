---
type: kiln-type
name: project
folder: Projects
template: Project.md
naming: title
icon: lucide-rocket
color: "#a371f9"
statuses:
  - shaping
  - active
  - closing
  - done
  - abandoned
properties:
  organisations: links
  products: links
  people: links
kinds: {}
sections:
  - Goal
  - Current state
  - Scope
  - Done when
views:
  Board:
    type: work
    via: projects
  Decisions:
    type: decision
    via: projects
  Meetings:
    type: meeting
    via: projects
  Research:
    type: research
    via: projects
  References:
    type: reference
    via: projects
---
A named, finite outcome. If it ends, it is a project; if it persists, it is a product, topic, organisation or person.

The Board view is the project's own kanban of its work.

---
type: kiln-type
name: person
folder: People
template: Person.md
naming: title
icon: lucide-user
color: "#50fa7b"
statuses:
  - active
  - archived
properties:
  role: text
  email: text
  organisations: links
kinds: {}
sections:
  - About
  - Notes
views:
  Projects:
    type: project
    via: people
  Work:
    type: work
    via: link
  Meetings:
    type: meeting
    via: attendees
  Decisions:
    type: decision
    via: link
---
Someone I work with. About says what their role is and what they own.

Create one when a person comes up again, so meetings, projects and work can link to them.

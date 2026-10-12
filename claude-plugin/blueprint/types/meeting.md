---
type: kiln-type
name: meeting
folder: Meetings
template: Meeting.md
icon: lucide-users
color: "#50fa7b"
statuses: []
properties:
  date: date
  attendees: links
  projects: links
  organisations: links
kinds:
  standup:
    icon: lucide-message-circle
  workshop:
    icon: lucide-presentation
sections:
  - Notes
  - My notes
  - Actions
  - Decisions
views:
  Work raised:
    type: work
    via: link
---
One meeting. Notes holds what was synced or captured; My notes is mine. Actions become work items and decisions become decision notes, each linking back here.

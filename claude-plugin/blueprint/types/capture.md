---
type: kiln-type
name: capture
folder: Inbox
template: Capture.md
naming: date-title
icon: lucide-inbox
color: "#ffb86c"
statuses:
  - inbox
  - filed
properties:
  captured: datetime
  from: text
  url: text
kinds: {}
sections: []
views: {}
---
Anything captured, before triage decides what it is. Triage either converts it in place into another type, or adds it to existing notes and sets it to `filed`.

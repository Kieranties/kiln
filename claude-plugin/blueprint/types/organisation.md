---
type: kiln-type
name: organisation
folder: Organisations
template: Organisation.md
icon: lucide-building
color: "#6272a4"
statuses:
  - active
  - archived
properties:
  organisations: links
kinds:
  client:
    icon: lucide-building-2
    color: "#ff79c6"
  vendor:
    icon: lucide-package
    color: "#69c8db"
  partner:
    icon: lucide-handshake
    color: "#ffb86c"
  self:
    icon: lucide-landmark
    color: "#a371f9"
sections:
  - Overview
  - Working with them
  - Notes
views:
  People:
    type: person
    via: organisations
  Products:
    type: product
    via: organisations
  Projects:
    type: project
    via: organisations
  Meetings:
    type: meeting
    via: organisations
---
A company or team: a client, a vendor, a partner, or my own organisation (`self`). The `organisations` property names a parent organisation when there is one.

Create one when an organisation is mentioned often enough to need its people, products, projects and meetings in one place.

---
type: kiln-properties
# Every note carries these, in this order
shared:
  - type
  - kind
  - status
  - created
  - summary
  - aliases
  - keywords
  - tags
  - review
# Any note may carry these: a capture converted to another type keeps them
optional:
  - captured
  - from
  - url
properties:
  # Shared by every type
  type: { icon: lucide-shapes }
  kind: { icon: lucide-tag }
  status: { icon: lucide-circle-dot }
  created: { icon: lucide-calendar-plus }
  summary: { icon: lucide-text }
  aliases: { icon: lucide-at-sign }
  keywords: { icon: lucide-key-round }
  tags: { icon: lucide-tags }
  review: { icon: lucide-flag, color: "#ff5555" }
  # Relationships: shown with the icon and colour of the type they link to
  organisations: { links: organisation }
  people: { links: person }
  attendees: { links: person }
  products: { links: product }
  topics: { links: topic }
  projects: { links: project }
  work: { links: work }
  research: { links: research }
  supersedes: { links: decision }
  # Each type's own
  role: { icon: lucide-briefcase }
  email: { icon: lucide-mail }
  url: { icon: lucide-link }
  verified: { icon: lucide-badge-check }
  jira: { icon: lucide-ticket }
  github: { icon: lucide-github }
  priority: { icon: lucide-signal }
  question: { icon: lucide-circle-help }
  decided: { icon: lucide-calendar-check }
  date: { icon: lucide-calendar }
  author: { icon: lucide-pen-line }
  published: { icon: lucide-calendar }
  captured: { icon: lucide-clock }
  from: { icon: lucide-log-in }
---
Every property in the vault, with the icon Iconic shows beside it.

A relationship has no icon of its own: it takes the icon and colour of the type it links to, so `projects` shows the project's rocket and `attendees` the person icon. Add a property here when a type definition adds one.

`shared` lists the properties every note carries, in template order. `optional` lists the ones any note may carry, so a capture converted to another type keeps `captured`, `from` and `url`.

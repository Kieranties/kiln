---
type: kiln-type
name: product
folder: Products
template: Product.md
naming: title
icon: lucide-box
color: "#69c8db"
statuses:
  - active
  - archived
properties:
  url: text
  organisations: links
kinds:
  app:
    icon: lucide-smartphone
  service:
    icon: lucide-server
  tool:
    icon: lucide-wrench
  platform:
    icon: lucide-layers
sections:
  - Overview
  - Facts
  - Known issues
views:
  Projects:
    type: project
    via: products
  Work:
    type: work
    via: products
  Decisions:
    type: decision
    via: link
  Topics:
    type: topic
    via: products
---
Anything named that I use or build: an app, a service, a tool or a platform. The `organisations` property says whose it is, so the Fan App is my organisation's and Gmail is Google's.

Knowledge about how something works belongs on a topic, which links to the product.

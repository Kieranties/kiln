---
type: kiln-type
name: daily
folder: Daily
template: Daily.md
naming: date
icon: lucide-sun
color: "#f1fa8c"
statuses: []
properties:
  date: date
kinds: {}
sections:
  - Schedule
  - What changed
  - Scratch
  - Reflection
  - Log
last: Log
views:
  Captures:
    type: capture
    via: created
  Work touched:
    type: work
    via: mtime
---
The day's log, written by me and by Claude. Scratch is for quick free-form notes; Log is timestamped lines (`- HH:mm text`) and is always the last section, so new lines are appended to the end of the file.

Once its day is over, a daily note is left as the record of that day.

---
status: proposed
---

# Claude creates a note with `obsidian create` and the whole note

Claude never creates a note by writing a new file: with Templater's trigger on, Templater merges its folder template over a properties-only note and runs any `<%` it finds, so captured text could run as code. Claude creates a note with `obsidian create`, passing the whole note, filled in from the type's template, and never `<%`. In the T2 trial (#80) this gave the same note as a QuickAdd choice, opened nothing, showed no dialog, and behaved the same with the trigger on or off. Proposed until #127 lands.

## Considered options

- **A QuickAdd choice per kind, run headless.** The earlier direction, and how the previous vault worked. It opens the note it creates and depends on the choice never prompting. QuickAdd's choices now serve the owner instead, as commands that can open the note.
- **Writing the file directly.** Ruled out for the Templater reason above.

---
status: accepted
---

# Type definitions are the single source of truth

Each type has one type definition, a note in the blueprint's `types/` folder that a vault holds as `_kiln/types/<type>.md`. Its properties give the folder, naming rule, icon, colour, statuses, properties, kinds, sections and views, and its body says in prose what the type is for. Everything else in the blueprint (Templater templates, Iconic rules, Bases views, QuickAdd choices, Obsidian settings) is written from the definitions, and the tests check every blueprint file against them. One readable definition per type keeps adding a type cheap, for the owner and for Claude, and gives the note check something to read.

## Consequences

- Change a definition, then everything written from it. The blueprint tests name anything out of step.
- Code that needs a type's shape (the note check, setup, generated docs) reads the definitions; it never hard-codes a type.
- A vault reads its own copies in `_kiln/`, so it can have types of its own.

---
name: kiln-ingest
description: Compile one raw source into the kiln vault's notes, in the kit's shapes. A draft for the #74 experiment, not yet a kiln skill.
---

# kiln ingest (draft)

Read one raw source and write what it says into the vault's notes, so a person reading in Obsidian finds it where they would look. The kit is the schema: its type definitions say what each note is and which properties and sections it has.

## Before writing

1. **Read the kit.** `_kiln/types/*.md` (in this experiment, `kit/types/` in the repo) and `_kiln/README.md`'s Conventions. Each definition's body says when to create a note of that type.
2. **Read the source in full.** Raw sources sit in `Sources/` and are never edited, renamed or moved.
3. **Find what the vault already holds.** For every person, organisation, product and subject the source names, look for an existing note by file name, `aliases` and `summary` across all type folders. Treat an alias or an obvious short form ("Rovers") as the same entity. Never create a second note for something that has one.
4. **Plan the writes** as a short list: the reference note, each note to update and which section, each note to create and why its definition says to create it.

## What to write

**One reference note per source**, in `References/`, named with the source's own title (with the kit's file-name rules). `kind` is the closest reference kind. Gist says what the source says in a few sentences; Why it matters says what it changes for the vault's projects and topics. Link the raw file in Gist: `[[Sources/<file>|the transcript]]`. Fill `author`, `published` and the `projects`, `topics` and `work` it bears on.

**Persisting notes** (`person`, `organisation`, `product`, `topic`): add what the source teaches that will still be true after the work ends.

- Person: About says their role and what they own. Create a person note when someone comes up in more than one source, or owns something the vault tracks.
- Organisation: Overview says what they are to us; Working with them says how we deal with them, and who.
- Product: Overview says what it is for; Facts are short, durable statements; Known issues are open problems with a link to their work item.
- Topic: Overview explains the subject; Durable facts hold claims that outlive the work. Set `verified` to the date of the newest source checked against.

**Notes about work and time** (`project`, `work`, `meeting`, `decision`, `research`, `daily`): do not rewrite their prose. They are records. If a source changes what one says, set its `review` to the reason and say so in the log.

## How to write

- **Properties only from the definition,** with the shared ones. Never add a key. Relationships are lists of links.
- **`summary` first.** One or two sentences that say what the note is without opening it. Update it when the note's meaning changes.
- **Sections from the template, in its order.** No title heading; Obsidian shows the file name.
- **Short prose, plain words.** A section is a few sentences or a few bullets. Write for a person skimming in Obsidian.
- **Links go in the sentence.** "Owns the [[Renewal payments]] retry policy", not a list of related notes.
- **Every claim says where it came from.** Each new paragraph or fact links the reference note it came from, in the sentence: "PayRail retries on days 1, 3 and 5 by default ([[PayRail Card retry schedules|PayRail docs]])."
- **Contradictions keep both sides.** When a source disagrees with the vault, write both claims with their sources, and set `review` on the note that holds the older claim, saying what disagrees with what.
- **`## Notes` is the owner's.** Never write in it, on any note. Leave it empty if it is empty.
- **Writes are targeted.** Change only the keys and sections you mean to change. Leave everything else byte for byte, including the embedded views.
- **Archive, never delete.** Never delete or move a note.
- **Aliases.** When a source uses another name for an entity ("VRFC"), add it to that note's `aliases`.

## After writing

Append one line per source to the `## Log` of today's daily note (create it from the Daily template if it does not exist): `- HH:mm Ingested [[<reference note>]]: created [[A]], [[B]]; updated [[C]], [[D]]; flagged [[E]] for review`.

Then report the same list to the owner, with anything you were unsure about.

# How notes are shaped

The blueprint is kiln's vault structure: what kinds of notes exist, how each one looks and how they link, so that notes are easy to find and read in Obsidian. It is configuration over community plugins, not code ([ADR 0009](../adr/0009-the-blueprint-builds-on-five-community-plugins.md)). Current direction, refined with use.

## Types and kinds

Every note is an entity with a **type** (the `type` property) and optionally a **kind** within it (`kind`). The type decides the folder, template, properties, icon, styling and views; a kind can override any of them. Each type has one **type definition**, the single source of truth that everything else in the blueprint is written from ([ADR 0004](../adr/0004-type-definitions-are-the-source-of-truth.md)). The definitions are in `claude-plugin/blueprint/types/`, and a vault holds its own copies in `_kiln/types/`.

The starting set, by how long its entities live:

| Lifespan | Types |
|---|---|
| **Persists** | `organisation`, `person`, `product`, `topic` |
| **Ends** | `project`, `work` |
| **A moment** | `research`, `decision`, `meeting`, `daily`, `reference` |
| **Until triaged** | `capture` |

A `product` is anything named that I use or build; its `organisations` link says whose it is. A `topic` holds knowledge about something, and topic hubs from research live there. Meetings, daily notes and references have no `status`: once they have happened there is nothing to track.

## Captures

A capture's nature is unknown when it arrives: it may become a reference, a task, a decision or a fact on an existing note.

- One note per capture. The inbox is a view of captures waiting for triage.
- **It becomes one new thing:** triage converts the capture in place. It sets the type and kind, moves the note to that type's folder and adds the template's sections. `captured`, `from` and `url` stay on the note. One note throughout, so links survive.
- **It belongs to existing notes:** triage adds it there and sets the capture's status to `filed`. The capture is kept.
- Quick thoughts can start as daily log lines. End of day turns the ones that need action into captures.

## Tasks

Personal tasks are notes (`work`, kind `task`), so they appear as cards on the board. Checklist tasks inside notes made it hard to see where things were.

## Folders and file names

One folder per type, named for a reader: `Organisations`, `People`, `Products`, `Topics`, `Projects`, `Work`, `Research`, `Decisions`, `Meetings`, `Daily`, `References`, and `Inbox` for captures. No year subfolders and no subject folders: a project's page groups its entities through views.

The file name is the title I read and link:

| Entities | File name | Example |
|---|---|---|
| Persist or end | The name | `Fan App.md`, `Season Ticket Renewals 2027.md` |
| Moments | Date first | `2026-10-11.md`, `2026-10-11 Club Console standup.md` |
| References | The source's own title | `NWA-142 Renewal emails fail for Vale Rovers.md` |

Characters that break links are replaced, so every name stays linkable.

## Properties

Every note carries the shared properties, listed in the blueprint's `properties.md`, and may carry `captured`, `from` and `url`:

| Property | Holds |
|---|---|
| `type`, `kind` | What the entity is |
| `status` | Where it stands. Values depend on the type |
| `created` | Date created. A property, because sync tools change file dates |
| `summary` | Enough to know what the note is without opening it: a sentence or a short paragraph, never an essay |
| `aliases` | Other **names** for the same thing. Obsidian uses them for linking and the quick switcher |
| `keywords` | **Search terms** that are not the name and not obvious from the text (`IAP`, `RTDN` on a billing topic) |
| `tags` | **Shared categories** from a small set, for browsing and filtering (`payments`) |
| `review` | The reason a note needs my review, as text. Empty when it needs none. Feeds the Needs review view |

There is no `id` (the note's name is its identity) and no `updated` (views read the file's modified date).

## Relationships

- **They point up the chain.** A note lists what it belongs to: a work item its `projects`, a meeting its `attendees` and `projects`, a decision its `projects` and `research`.
- **Views show the reverse.** A project page lists its work, meetings and decisions through embedded views, not stored lists. Each link is written once.
- **Named after the target type** (`organisations`, `people`, `products`, `topics`, `projects`, `research`, `references`), and always a list of links. Two are named for the role instead: `attendees` (people at a meeting) and `supersedes` (the decisions a decision replaces).
- **Link before a note exists.** Any named thing can be linked (`[[Fan App]]`) before its note exists, and Obsidian shows the existing links once it is created. A note is created when the thing earns a page with a type, icon and views.

## The page

| Part | What it is |
|---|---|
| **Title** | Obsidian's inline title, which is the file name. No `# heading`, so the title shows once |
| **Properties** | Hidden in the document, read and edited in the file properties view in the right sidebar |
| **Body** | Prose sections specific to the type. The first section is the readable lead, the long form of `summary` |
| **Related** | Embedded Bases views at the bottom, under plain headings, filtered to this note |

- **Work statuses are the board's columns.**
- **`jira` and `github`** on a work item are separate lists of links: one work item can have a Jira ticket, a GitHub issue and several PRs.
- **`verified`** on a topic is the date its claims were last checked against their live sources. It matters for topics built from outside documentation, which drifts.
- **Topic sub-notes** are topics with a parent in `topics`; the hub lists them in its Sub-topics view.
- **The daily note** opens with `← yesterday · tomorrow →` links. **Log is always the last section,** so a log line from me or from Claude is appended to the end of the file.

## Home and the board

| View | Shows | Form |
|---|---|---|
| **Home** (`Home.md`) | Today's daily note, the inbox, active projects, notes needing review, a link to the board | A note with embedded views, the vault's start page |
| **Board** | Every work item that isn't abandoned, as a kanban with one column per status, each card showing its project. Personal tasks sit with other work. Done items untouched for 14 days are hidden | A Base, opened as a tab |
| **Inbox** | Captures waiting for triage, newest first | A Base, on Home |
| **Needs review** | Notes with `review` set, with the reason | A Base, on Home |

Each project page embeds the board filtered to that project. The board is Bases' built-in kanban layout, which groups by one real property, so dragging a card changes the note's `status`. Both boards list every live status, so empty columns stay and `abandoned` stays off.

## What makes it read well

- **Capitals on screen, lowercase in notes.** A CSS snippet (`kiln.css`) shows property names, values and board columns with capitals, and views get readable column headers. Notes keep lowercase names and values, so filters and Claude are unaffected.
- **Icons everywhere.** Each type folder shows its type's icon in place of the folder arrow, and Home and the Board have their own. Every property has an icon; a relationship takes the icon and colour of the type it links to.
- **File properties in the right sidebar,** added by setup.
- **The blueprint's own templates are notes too,** so views that match on type alone leave out `_kiln`.

## Later

An Obsidian plugin, if kiln grows one, would add what configuration can't: adding a type in one step, icons beside links, and custom views such as the inbox and the project page.

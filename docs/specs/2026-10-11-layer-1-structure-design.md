# Layer 1: structure

Status: **built and checked** (2026-10-11), as the blueprint in `claude-plugin/blueprint/` (the kit until #105). Nothing here is final.

Layer 1 of the [vision](../vision.md): the vault structure, so that entities are easy to find and read in Obsidian. It covers the flows Browse (5) and Add a type or kind (12) in [kiln user flows](2026-10-11-user-flows.md), and the shapes every later layer writes into.

Approach: configuration first (vision P5). Type definitions, templates, properties and Bases views, plus a few community plugins. kiln plugin code comes after the migration slice.

## Decided

### Types and kinds

Every note is an entity with a **type** (`type` property) and optionally a **kind** within it (`kind` property). The type decides the template, properties, icon, styling and views; a kind can override any of them.

Starting set:

| Type | Kinds | Lifespan | What it is |
|---|---|---|---|
| `organisation` | client, vendor, partner, self | persists | A company or team |
| `person` | | persists | Someone I work with |
| `product` | app, service, tool, platform | persists | Anything named that I use or build. An `organisation` link says whose it is: the Fan App is Northwind Arena's, Gmail is Google's |
| `topic` | | persists | Knowledge about something: how it works, how to handle it. Topic hubs from research live here |
| `project` | | ends | A named, finite outcome |
| `work` | feature, bug, chore, incident, task | ends | A piece of work. `task` is a personal task, a card on the board |
| `research` | | a moment | A question answered on a date |
| `decision` | | a moment | One decision, linked from the project and to the research behind it |
| `meeting` | standup, workshop, ... | a moment | One meeting |
| `daily` | | a moment | The day's log |
| `reference` | doc, thread, spec, code, dashboard, post, sheet, slides, video, ticket | a moment | Something brought in from outside |
| `capture` | | until triaged | Anything captured, before triage decides what it is |

Not carried over from the previous vault: `roadmap` (two notes; can return through flow 12) and `workshop` as a type (now a kind of meeting).

### Captures

A capture's nature is unknown when it arrives: it may become a reference, a task, a decision or a fact on an existing note.

- One note per capture. The inbox is a view of captures waiting for triage.
- **It becomes one new thing:** triage converts the capture in place. It sets the type and kind, moves the note to that type's folder and adds the template's sections. `captured`, `from` and `url` stay on the note. One note throughout, so links survive.
- **It belongs to existing notes:** triage adds it there and sets the capture's status to `filed`. The capture is kept.
- Quick thoughts can start as daily log lines. End of day turns the ones that need action into captures.

### Tasks

Personal tasks are notes (`work`, kind `task`), so they appear as cards on the board. Checklist tasks inside notes made it hard to see where things were. A dedicated tasks plugin is a candidate for later kiln code.

### Folders and file names

One folder per type, named for a reader: `Organisations`, `People`, `Products`, `Topics`, `Projects`, `Work`, `Research`, `Decisions`, `Meetings`, `Daily`, `References`, and `Inbox` for captures. No year subfolders and no subject folders: a project's page groups its entities through views.

The file name is the title I read and link:

| Entities | File name | Example |
|---|---|---|
| Persist or end | The name | `Fan App.md`, `Season Ticket Renewals 2027.md` |
| Moments | Date first | `2026-10-11.md`, `2026-10-11 Club Console standup.md`, `2026-10-11 Use a single event bus.md` |
| References | The source's own title | `NWA-142 Renewal emails fail for Vale Rovers.md` |

Characters that break links (`#`, `^`, `[`, `]`, `|`) are replaced in file names (the problem kiln#70 found).

### Properties

Shared by every type. The list lives in `properties.md` (`shared`), with `captured`, `from` and `url` optional on every type (`optional`):

| Property | Holds |
|---|---|
| `type`, `kind` | What the entity is |
| `status` | Where it stands. Values depend on the type |
| `created` | Date created. A property, because sync tools change file dates |
| `summary` | Enough to know what the note is without opening it: a sentence or a short paragraph, never an essay |
| `aliases` | Other **names** for the same thing. Obsidian uses them for linking and the quick switcher |
| `keywords` | **Search terms** that are not the name and not obvious from the text (`IAP`, `RTDN` on a billing topic). Specific to the note |
| `tags` | **Shared categories** from a small set, for browsing and filtering (`payments`) |
| `review` | The reason a note needs my review, as text. Empty when it needs none. Feeds the "Needs review" view |

Relationships:

- **They point up the chain.** A note lists what it belongs to: a work item its `projects`, a meeting its `attendees` and `projects`, a decision its `projects` and `research`.
- **Views show the reverse.** A project page lists its work, meetings and decisions through embedded views, not stored lists. Each link is written once.
- **Named after the target type** (`organisations`, `people`, `products`, `topics`, `projects`, `research`, `references`), and always a list of links. Two are named for the role instead: `attendees` (people at a meeting) and `supersedes` (the decisions a decision replaces).

Dropped from v1: `id` (the note's name is its identity), `confidence` (never drove an action), `sources` (now the `references` relationship), `updated` (views read the file's modified date).

### Page layout

| Part | What it is |
|---|---|
| **Title** | Obsidian's inline title, which is the file name. No `# heading`, so the title shows once |
| **Properties** | Hidden in the document. Read and edited in the right sidebar when needed |
| **Body** | Prose sections specific to the type. The first section is the readable lead, the long form of `summary` |
| **Related** | Embedded Bases views at the bottom, under plain headings, filtered to this note (`this.file`) |

### Each type's page

Shared properties are not repeated. Relationship properties are in *italics*.

| Type | Its own properties | `status` | Body sections | Related views |
|---|---|---|---|---|
| organisation | *organisations* (parent) | active, archived | Overview · Working with them · Notes | People · Products · Projects · Meetings |
| person | role, email, *organisations* | active, archived | About (role, what they own) · Notes | Projects · Work · Meetings · Decisions |
| product | url, *organisations* | active, archived | Overview · Facts · Known issues | Projects · Work · Decisions · Topics |
| topic | verified (date), *topics* (parent), *products* | active, archived | Overview · Durable facts · Notes | Sub-topics · Research · Decisions · References |
| project | *organisations*, *products*, *people* | shaping, active, closing, done, abandoned | Goal · Current state · Scope · Done when | Board (its work) · Decisions · Meetings · Research · References |
| work | jira, github, priority, *projects*, *products* | backlog, active, blocked, review, done, abandoned | Context · Checkpoints (dated) · Outcome | Decisions · Meetings · References |
| research | question, *topics*, *projects* | open, answered | Question · Brief · Findings · Sources | Work raised · Decisions that cite it |
| decision | decided (date), *projects*, *research*, *supersedes* | proposed, accepted, superseded | Context · Decision · Consequences | Superseded by |
| meeting | date, *attendees*, *projects*, *organisations* | | Notes (synced) · My notes · Actions · Decisions | Work raised |
| daily | date | | Schedule · What changed · Scratch · Reflection · Log | Captures and work touched that day |
| reference | url, author, published, *projects*, *topics*, *work* | | Gist · Why it matters | |
| capture | captured (date and time), from, url | inbox, filed | Free text | |

- **Moments** (meeting, daily, reference) have no `status`: once they have happened there is nothing to track.
- **`jira` and `github`** are separate lists of links. One work item can have a Jira ticket, a GitHub issue and several PRs. Other systems get their own property when needed.
- **Work statuses are the board's columns.**
- **`verified`** on a topic is the date its claims were last checked against their live sources (flow 11). It matters for topics built from outside documentation, which drifts. Empty for topics about my own practices.
- **Topic sub-notes** are topics with a parent in *topics*. The hub lists them in its Sub-topics view.
- **The daily note** opens with `← yesterday · tomorrow →` links. **Log is always the last section,** so a log line from me (QuickAdd) or from Claude is appended to the end of the file. Scratch is for free-form quick notes; Log is timestamped lines.

### Standalone views

| View | Shows | Form |
|---|---|---|
| **Home** (`Home.md` at the vault root) | Today's daily note, inbox count, active projects, notes needing review, a link to the board | A note with embedded views, set as the vault's start page |
| **Board** | Every work item that is not abandoned, as a kanban: one column per work status, each card showing its project. Personal tasks sit with other work. Done items modified more than 14 days ago are hidden | A Base, opened as a tab |
| **Inbox** | Captures with `status: inbox`, newest first | A Base, embedded on Home |
| **Needs review** | Notes with `review` set, with the reason | A Base, embedded on Home |

- Each project page embeds the board filtered to that project: the local board per project.
- **The board uses Bases' built-in kanban layout** (Obsidian 1.14), not a community plugin. It groups by one property, with no rows (swimlanes). Dragging a card to another column updates that property in the note, so the board groups by `status`, a real property; grouping by a formula would lock the cards. Narrowing to one project happens on the project page. Rows by project, if missed, are a kiln plugin job.
- **This is a starting point.** Board views will be tightened with use, such as dedicated boards for a project.

### Type definitions and how they are applied

Each type has a **definition note** in the vault, `_kiln/types/<type>.md`. Its properties define the folder, naming rule, icon, colour, statuses, properties, kinds (with icon or colour overrides), body sections and related views. Its body explains in prose what the type is for and when to use it. `naming` is how a note's file name is formed: `title`, `date`, `date-title` or `source-title`. `last`, where a type has one, names a section that must stay last, as Log does for the daily note. Definitions are the single source of truth, readable in Obsidian and by Claude.

```yaml
---
type: kiln-type
name: product
folder: Products
naming: title
icon: lucide-box
color: "#69c8db"
statuses: [active, archived]
properties: { url: text, organisations: links }
kinds:
  app: { icon: lucide-smartphone }
  service: { icon: lucide-server }
  tool: {}
  platform: {}
sections: [Overview, Facts, Known issues]
views: [Projects, Work, Decisions, Topics]
---
Anything named that I use or build. The organisations link says whose it is.
```

At layer 1, **Claude applies the definitions** to the configuration. There is no kiln code yet:

| Target | What Claude writes |
|---|---|
| **Templater** | A template per type in `_kiln/templates/`, with its properties and sections |
| **Iconic** | A file rule per type, and per kind where it overrides the icon, matched on `property:type` and `property:kind`. Safe to write with Obsidian open: Iconic reloads its settings when the file changes on disk (`onExternalSettingsChange`). Avoid editing icons in Iconic's own settings at the same time, since the last save wins |
| **Bases** | Each type's related views, and the standalone views |
| **QuickAdd** | Capture to the inbox, log to daily, and one choice per kind (generated by setup) that Claude runs to create notes |
| **Obsidian settings** | Template folder, new-file locations, properties hidden in the document, `_kiln/` excluded from search |

Adding a type (flow 12) at layer 1 means editing or adding a definition, then having Claude apply it. The kiln plugin makes that one step later.

### The blueprint

The repo holds the blueprint under `claude-plugin/blueprint/`, inside kiln's Claude plugin: the type definitions, templates and view files. It is structure only, with no knowledge. A vault is set up by copying the blueprint into the vault as `_kiln/` and having Claude apply it.

Community plugins in the blueprint: **Iconic** (icons), **Templater** (templates), **QuickAdd** (capture and log), **Homepage** (open on `Home.md`). The board uses Bases' built-in kanban.

Obsidian has no built-in way to install a set of plugins together. The blueprint ships the plugins' **settings**, not their code: the `community-plugins.json` entries and our settings for each plugin. Setting up a vault:

1. Install the four plugins from Obsidian's community plugin browser, then close Obsidian.
2. `/kiln:setup` copies the blueprint in as `_kiln/` and applies the definitions and plugin settings, from any Claude session.
3. Open Obsidian and check the result.

Obsidian must be closed for setup because QuickAdd and Homepage read their settings only at start-up. Iconic and Templater reload theirs when the file changes (`onExternalSettingsChange`), and templates and views are plain files, so re-applying later changes those with Obsidian open, and the rest waits for it to close.

Later, the kiln plugin can check for the plugins it relies on and offer to install any that are missing.

### After layer 1: the kiln plugin

The kiln Obsidian plugin starts after the migration slice, once real content has proved the shapes. Its jobs, in order:

1. Generate the configuration from the type definitions, so adding a type is one step.
2. Later: icons beside links, from the type definitions. Iconic does not decorate links, and a fork of Iconic is not worth tracking. Contributing link icons to Iconic upstream is worth a look first.
3. Later: custom views, such as the inbox and the project page.

### Found in the first test vault

Building the kit (now the blueprint) and checking it in Obsidian 1.14.4 added these decisions:

- **Board columns stay when empty.** Both boards list every live status in `groupOrder`, which also fixes their order and keeps `abandoned` off.
- **Capitals on screen, lowercase in notes.** A blueprint CSS snippet (`kiln.css`) shows property names, values and board columns with capitals. View columns get readable headers through `displayName`. Notes keep lowercase names and values, so filters and Claude are unaffected.
- **Icons everywhere.** Each type folder shows its type's icon in place of the folder arrow (Iconic's minimal folder icons). Home and the Board have their own icons. Every property has an icon, listed in the blueprint's `properties.md`; a relationship takes the icon and colour of the type it links to.
- **File properties in the right sidebar.** Setup adds the file properties view to the right sidebar in `workspace.json`, with Obsidian closed.
- **Templater's trigger is per device.** "Trigger Templater on new file creation" lives in Obsidian's local storage, not in Templater's settings file, so the owner turns it on once per device.
- **Blueprint templates are notes too.** Views that match on type alone (Inbox, Board) leave out `_kiln`.
- **Getting started is about your own vault.** The Northwind Arena sample is a separate page, for a trial vault.

### Linking before a note exists

Any named thing can be linked (`[[Fan App]]`) before its note exists. Obsidian shows the existing links once the note is created. A note is created when the thing earns a page with a type, icon and views.


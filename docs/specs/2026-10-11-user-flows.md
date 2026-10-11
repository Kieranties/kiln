# kiln user flows

Status: **draft, exploring** (2026-10-11). Nothing here is final.

## Why this document exists

KB core v1 built an engine before the experience, and its notes were shaped for Claude rather than for a person. The [revised vision](../vision.md) puts Obsidian first, then Claude, then everything else:

- **Obsidian is where knowledge is read and browsed.** It is the main surface.
- **Claudian** (Claude in an Obsidian side panel) is how Claude is reached while reading.
- **Herdr** is where work runs: a workspace per batch of work, Claude sessions and worktrees in its tabs.

This document draws the flows from the user's side ("I do X, I see Y"), and ends with the agreed story order.

Every diagram sets a light theme and a light panel, so it reads the same in a dark or light viewer.

## Lanes

| Lane | What it is |
|---|---|
| **Me** | The owner |
| **Obsidian** | The vault on screen: notes, embedded Bases views, the daily note |
| **Claude** | Claudian inside Obsidian, or a Claude session in a Herdr tab. Same skills either way |
| **Herdr** | Workspaces: tabs, Claude sessions, worktrees |
| **Vault** | The markdown files on disk, with kiln's templates, views and checks |
| **External** | Jira, GitHub, Slack, mail, calendar, meeting notes, the web |

## Map

How the flows hand off to each other. Numbers match the sections below.

```mermaid
%%{init: {"theme": "default"}}%%
flowchart LR
    subgraph card[" "]
        subgraph arrive[Things arrive]
            EXT[Tickets, PRs, threads, mail]
            MTG[Meetings]
            ME[My thoughts and links]
            SES[Claude session outcomes]
        end
        EXT -->|1 Capture| INBOX[(Inbox)]
        ME -->|1 Capture| INBOX
        SES -->|1 Capture| INBOX
        MTG -->|3 Meeting| MNOTE[Meeting note] --> INBOX
        INBOX -->|2 Triage| VAULT[(Projects, work items,<br/>topics, people)]
        RES[11 Research] -->|knowledge for later decisions| VAULT
        VAULT -->|5 Browse| OBS[Read in Obsidian:<br/>notes and the board]
        TYPES[12 Add a kind] -.->|new shapes| VAULT
        VAULT -->|6 Ask| ANS[Answer with links]
        VAULT -->|7 Start work| WS[Herdr workspace]
        WS -->|8 Checkpoint| VAULT
        WS -->|9 Close-out| VAULT
        EXT -->|10 Follow up and refresh| VAULT
        DAY[4 Daily rhythm] -.->|morning and evening| VAULT
        DAY -.-> INBOX
    end
    style card fill:#fafafa,stroke:#bbbbbb
```

## 1. Capture

**Trigger:** something turns up anywhere. **Result:** it is in one inbox, and I trust it will be dealt with. "Single process to input, launch from anywhere."

```mermaid
%%{init: {"theme": "default", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    participant Me
    participant O as Obsidian
    participant C as Claude
    participant V as Vault
    participant X as External
    rect rgb(250, 250, 250)
        alt From any Claude session (Claudian or Herdr)
            Me->>C: capture this (text, link, ticket key, session outcome)
            opt It is a reference
                C->>X: fetch the item through a connector
                X-->>C: title, status, gist
            end
            C->>V: add to the inbox (source, why)
            V-->>C: inbox item
        else Typing while reading
            Me->>O: add a line to today's daily log
            Note over O: picked up by end of day (flow 4)
        end
        V-->>O: inbox view shows the new item
    end
```

Open questions:

- Is the daily note's log a capture surface, as it was in the previous vault?
- Do captured sources live in the visible tree, or somewhere out of sight with only the inbox view showing them?
- Should capture offer to file straight away when the target is obvious, or always go through triage?

## 2. Triage

**Trigger:** the inbox has items, or end of day. **Result:** every item is filed to a note I can find, or dismissed.

```mermaid
%%{init: {"theme": "default", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    participant Me
    participant O as Obsidian
    participant C as Claude
    participant V as Vault
    rect rgb(250, 250, 250)
        Me->>O: open the inbox view
        Me->>C: triage
        C->>V: read the inbox, find related notes per item
        C-->>Me: a batch of proposals<br/>(link to note, new work item, new project,<br/>new topic or person, add task, research, dismiss)
        Me->>C: approve or edit
        C->>V: create and update notes, mark items triaged
        V-->>O: notes updated, inbox shrinks
        Me->>O: follow links to check the filed notes
    end
```

Open questions:

- Triage can create anything, including a new topic, person or project.
- Where does a task go? The previous vault had a board per project for personal tasks.
- Is "review needed" still a flag, or does triage simply ask when it is unsure?

## 3. Meeting

**Trigger:** a meeting happens. **Result:** a meeting note linked to its people and project, with actions and decisions filed.

```mermaid
%%{init: {"theme": "default", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    participant Me
    participant O as Obsidian
    participant C as Claude
    participant V as Vault
    participant X as External
    rect rgb(250, 250, 250)
        X->>O: meeting transcript and summary arrive (sync plugin or capture)
        Me->>C: process this meeting
        C->>V: find attendees, project, topics
        C-->>Me: proposed links, actions, decisions
        Me->>C: approve or edit
        C->>V: link people and project, add tasks and work items, record decisions
        V-->>O: meeting appears on the project and person pages
    end
```

Open questions:

- Is a meeting note a source (machine-owned) or mine to annotate? Probably both: synced content plus my section.
- Keep the meeting sync plugin writing into the vault, or capture meetings by reference?

## 4. Daily rhythm

**Trigger:** start and end of the working day. **Result:** in the morning I know what is on and what changed. Through the day the daily note is a running log, written by me and by Claude. In the evening nothing is left loose and I know where I stopped.

Agreed:

- **The daily note is a log, not a task list.** Copying task lists forward each morning was not useful. Status lives on the board (flow 5), across all projects or one.
- **Both of us write to it.** I add lines as I go. Claude sessions (Claudian or Herdr) add lines too: started X, PR opened, decided Y.
- **It is frozen once the day is over,** by convention rather than enforcement. Claude and I simply don't write to a past daily note. It stays as the record of that day.

```mermaid
%%{init: {"theme": "default", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    participant Me
    participant O as Obsidian
    participant C as Claude
    participant H as Herdr
    participant V as Vault
    participant X as External
    rect rgb(250, 250, 250)
        rect rgb(228, 236, 248)
            Note over Me,X: Start of day (manual or scheduled)
            Me->>C: start of day
            C->>X: calendar, messages needing me, changes to tracked tickets and PRs
            C->>V: today's daily note: schedule, messages, what changed, link to the board
        end
        rect rgb(228, 236, 248)
            Note over Me,X: During the day
            Me->>O: add log lines as I go
            C->>V: Claudian adds log lines
            H->>V: Herdr sessions add log lines
            Me->>O: check status on the board, not in the daily note
        end
        rect rgb(228, 236, 248)
            Note over Me,X: End of day
            Me->>C: end of day
            C->>V: notes changed today, today's log
            C-->>Me: proposed links for loose log lines, inbox to triage (flow 2)
            Me->>C: approve, write a short reflection
            C->>V: checkpoint open work items, record where I stopped
        end
        Note over O,V: After the day, the daily note is frozen
    end
```

Open questions:

- What earns a log line from Claude, so the log stays readable?
- Is Resume simply start of day, or also "resume this work item" from its note?

## 5. Browse

**Trigger:** I open a project, work item, topic or person in Obsidian, or the board. **Result:** the page tells me the current state and shows everything related, without asking Claude. The board shows status across projects.

Current direction: the board is a kanban view over a Base (the previous vault used the Kanban Bases View community plugin), not kiln code.

```mermaid
%%{init: {"theme": "default", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    participant Me
    participant O as Obsidian
    participant V as Vault
    rect rgb(250, 250, 250)
        Me->>O: open a project note
        O-->>Me: title, goal, current state in prose
        O-->>Me: embedded views: work items, tasks, meetings,<br/>decisions, research, people, recent sources
        Me->>O: follow a link to a work item or topic
        opt Status across projects
            Me->>O: open the board
            O-->>Me: kanban of work items by status,<br/>all projects or filtered to one
            Me->>O: move a card to change its status
            O->>V: status saved in the note
        end
        opt I edit a note by hand
            Me->>O: change text or properties
            O->>V: file saved
        end
    end
```

Open questions:

- What must each kind show at a glance? (This becomes the note-shape work.)
- Hand edits are normal. What checks a note's shape after I edit it?
- Is there a home note: what is active, inbox count, today?
- What are the board's columns, and are personal tasks cards alongside work items?

## 6. Ask

**Trigger:** a question while reading or working. **Result:** an answer with links I can click into Obsidian.

```mermaid
%%{init: {"theme": "default", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    participant Me
    participant O as Obsidian
    participant C as Claude
    participant V as Vault
    participant X as External
    rect rgb(250, 250, 250)
        Me->>C: what did we decide about X? (from Claudian, with the open note as context)
        C->>V: find notes by name, links and text, and read them
        opt Not held locally
            C->>X: read live
        end
        C-->>Me: answer citing links
        Me->>O: click a link, read the note
        opt The answer is worth keeping
            Me->>C: keep this
            C->>V: capture, or update the note directly
        end
    end
```

Agreed: Claudian passes the open note as context, so a question asked while reading starts from that note.

## 7. Start work

**Trigger:** I decide to work on something. **Result:** a Herdr workspace where Claude already holds the context, with the right worktrees, and the work item knows where its work is running.

Agreed: work can also start outside Obsidian, from any terminal or Herdr tab in any folder. Claude must still find the vault from there.

```mermaid
%%{init: {"theme": "default", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    participant Me
    participant O as Obsidian
    participant C as Claude
    participant H as Herdr
    participant V as Vault
    rect rgb(250, 250, 250)
        alt From a work item note
            Me->>C: start this (from the note in Obsidian)
        else Outside Obsidian, in any folder
            Me->>C: start work on X (in a terminal or Herdr tab)
            C->>V: find the vault, find the work item
        else Ad hoc, nothing exists yet
            Me->>C: start work on X
            C->>V: create the work item
        end
        C->>V: gather context: work item, project, topics,<br/>research, decisions, ticket snapshot, repos
        C->>H: create workspace tab, worktrees per repo
        H->>H: Claude session starts with that context
        C->>V: work item: workspace link, status active
        V-->>O: work item note shows the running workspace
    end
```

Open questions:

- Who launches Herdr from Obsidian: Claudian calling the Herdr CLI, or an Obsidian command?
- One workspace can hold several work items ("a batch of work: a ticket and sub-tasks, or an ad hoc change across repos"). How is that chosen at start?
- Where do the repos come from: links on the project or work item?

## 8. Work and checkpoint

**Trigger:** progress inside a workspace. **Result:** the work item always says where things stand, even if the workspace is abandoned.

```mermaid
%%{init: {"theme": "default", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    participant Me
    participant O as Obsidian
    participant H as Herdr
    participant V as Vault
    participant X as External
    rect rgb(250, 250, 250)
        Me->>H: work with Claude in the workspace
        H->>X: branches, PRs, ticket updates (approved by me)
        loop At meaningful moments (PR opened, decision made, blocked, session ends)
            H->>V: checkpoint: progress, decisions, links to PRs
        end
        V-->>O: work item shows the latest checkpoint
        Me->>O: glance at the work item from anywhere
    end
```

Open questions:

- Automatic (hook on session end or compaction) or explicit? How to avoid noise?
- Decisions made in a workspace: on the work item, the project, or both?

## 9. Close-out

**Trigger:** a piece of work finishes, found by me or by a scheduled sweep. **Result:** knowledge flows up, and the project and topic notes stay current.

```mermaid
%%{init: {"theme": "default"}}%%
flowchart TB
    subgraph card[" "]
        TRIG[Manual, or a scheduled sweep<br/>finds merged PRs and closed tickets] --> WT
        WT[Worktree closes:<br/>merged or abandoned] -->|that piece of work is done| WS
        WS[Workspace closes] -->|findings, decisions, state| WI[Work item]
        WI -->|work item closes: outcome, lessons| PR[Project]
        PR -->|project closes: it is done| DR{Distil review}
        DR -->|durable facts, gotchas, people| TOP[Topics, products, people]
        DR -->|narrative and why| PR
        DR -->|loose ends| NEW[New work items]
        ME((Me)) -.->|approve or edit| DR
    end
    style card fill:#fafafa,stroke:#bbbbbb
```

Open questions:

- Does each step propose a review list, or only the project close?
- Does a work item mirror its ticket's status, and close when the ticket closes?
- Does a scheduled run only queue proposals for me, or apply the safe ones?

## 10. Follow up and refresh

**Trigger:** something external changes, or I need to act outwards. Refresh runs on touch, on a schedule, or when I ask. **Result:** my notes show the current state, and nothing goes out without my approval.

```mermaid
%%{init: {"theme": "default", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    participant Me
    participant O as Obsidian
    participant C as Claude
    participant V as Vault
    participant X as External
    rect rgb(250, 250, 250)
        alt On touch
            C->>V: read a note with a stale snapshot
            C->>X: refresh
            C->>V: update the snapshot
        else Scheduled sweep, start of day, or I ask
            C->>X: changes to tickets and PRs on open work items
            C->>V: update snapshots, what changed in the daily note
        end
        opt Act outwards
            C-->>Me: draft a comment, transition or reply
            Me->>C: approve
            C->>X: send
            C->>V: log it on the work item
        end
    end
```

Open questions:

- What runs the schedule: a Claude scheduled task, Windows Task Scheduler with `claude -p`, or n8n?
- Are background feeders (n8n) still wanted for capture, or is a scheduled sweep enough for now?

## 11. Research

**Trigger:** a question I will need answered before a decision, or an investigation that needs grounding. **Result:** durable knowledge in the vault, written to outlive the work that prompted it, that later decisions cite.

Two shapes, both from the previous vault:

- **Topic knowledge:** how something works in the world, such as a vendor API, a protocol or a product. A topic hub with focused notes that each answer one question (payloads, handling contract, lifecycle, operations), and a reference note per source read. Not tied to one client or integration.
- **Current-state research:** a question about our own systems, checked against that topic knowledge ("where does our integration diverge from the documented contract, and what is the blast radius?"). A research note with the question and findings. It records and does not fix: each finding becomes a work item.

```mermaid
%%{init: {"theme": "default", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    participant Me
    participant O as Obsidian
    participant C as Claude
    participant V as Vault
    participant X as External
    rect rgb(250, 250, 250)
        rect rgb(228, 236, 248)
            Note over Me,X: Research
            Me->>C: research X (the question, and why it matters)
            C->>V: what do we already hold on X? topics, research, decisions
            C->>X: scoping search: docs, specs, repos
            C-->>Me: plan: topic hub and notes, references, research note
            Me->>C: approve or edit
            C->>X: read sources
            C->>V: create or update the topic, references and research note,<br/>linked to the project that asked
            opt Current-state findings
                C->>V: each finding becomes a work item
            end
            V-->>O: topic hub with its notes and references
        end
        rect rgb(228, 236, 248)
            Note over Me,X: Weeks later: a decision
            Me->>C: we need to decide Y
            C->>V: searching the vault finds the topic and research
            C-->>Me: options grounded in the research, with links
            Me->>C: decide
            C->>V: decision cites the topic and research
        end
        opt The topic is old
            C->>X: re-check claims against live sources
            C->>V: update the topic, with a verified-on date
        end
    end
```

Open questions:

- Topic hubs split into notes by question, as in the previous vault, or one long note?
- A reference note per source, or a source list on the topic?
- Does a topic carry a verified-on date, and does start of day flag stale ones?
- Long research as its own Herdr workspace, or inline in Claudian?

## 12. Add a kind

**Trigger:** I need a kind of note that does not exist yet (a runbook, an RFC, a vendor), or Claude notices notes that keep taking the same shape. **Result:** the new kind has a template, its own icon and styling, views, and the rest of the process knows it: Claude's skills, triage and the checks.

v1 fixed its types in code. The previous vault made new kinds easy but nothing checked them. This flow wants both: easy to add, and fully hooked in.

Agreed: every note is an entity of one kind. See [entities and kinds](../vision.md#entities-and-kinds).

```mermaid
%%{init: {"theme": "default", "sequence": {"mirrorActors": false}}}%%
sequenceDiagram
    participant Me
    participant O as Obsidian
    participant C as Claude
    participant V as Vault
    rect rgb(250, 250, 250)
        alt I ask
            Me->>C: add a kind: runbook
        else Claude spots a pattern
            C-->>Me: these notes look like a new kind, add it?
        end
        C-->>Me: proposed definition: name, fields, sections,<br/>folder, icon, colour, views
        Me->>C: approve or edit
        C->>V: add the kind definition to the vault
        V->>O: template, icon and styling, views, from the definition
        Note over C,V: skills, templates and checks know the kind
        Me->>O: new note from the template, with its icon and views
    end
```

Open questions:

- Where does a kind definition live? Probably in the vault itself, as a note I can read and edit in Obsidian.
- How are icons and styling applied: an icon plugin, a CSS snippet keyed on the kind property, or both?
- What does "hooked in" include: template, views, triage outcome, which fields are hidden, check rules?
- At layer 1 this is configuration (a definition plus generated template, CSS and views). A kiln plugin takes it over later.

## Story order

Agreed 2026-10-11. Each step makes something usable in Obsidian.

| Step | Flows | Delivers |
|---|---|---|
| 1 | Note shapes, Add a kind (12), Browse (5) | Notes that read well, kinds that are easy to add, the board |
| 1a | Migration slice | One real project with its topics, people and meetings, moved by hand into the new shapes to test them on real content |
| 2 | Capture (1), Triage (2) | Reshaped to write the new shapes, including new topics, people and projects |
| 3 | Research (11) | Knowledge brought in for later decisions |
| 4 | Ask (6) | From Claudian, starting from the open note |
| 5 | Daily rhythm (4), Meeting (3) | The daily log written by both of us, frozen after its day |
| 6 | Start work (7), Work and checkpoint (8) | Herdr workspaces, from Obsidian or any folder |
| 7 | Close-out (9), Follow up and refresh (10) | Scheduled or manual |
| 8 | Migration | The rest of the previous vault |

## Not drawn yet

- **Hand-over and export:** bundle a project or topic into a zip or PDF to share (the previous vault's `dump`).
- **Projects:** shaping a new project, and its lifecycle (shaping, active, closing, closed).
- **Multiple bases:** work and personal, and which base a session uses.

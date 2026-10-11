# Layer 1 Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the kiln kit (type definitions, Templater templates, Bases views, plugin settings) in `kit/`, prove it consistent with tests, and apply it to a fresh test vault with Northwind Arena content.

**Architecture:** The kit is configuration, not code. Type definitions in `kit/types/` are the single source of truth. Every other kit file (templates, views, settings fragments) is written from them by hand (Claude). A vitest suite under `tests/kit/` checks every kit file against the definitions, and checks a Northwind Arena example vault against both. Applying the kit to a vault is a documented procedure in `kit/README.md`, done by Claude with Obsidian closed. `kit/GETTING-STARTED.md` walks the owner from an empty folder to a checked vault.

**Tech Stack:** Obsidian 1.14+ (Bases, built-in kanban), Iconic, Templater, QuickAdd, Homepage. Tests: vitest and `yaml` (both already in the repo), TypeScript ESM.

**Spec:** [docs/specs/2026-10-11-layer-1-structure-design.md](../specs/2026-10-11-layer-1-structure-design.md). Context: [vision](../vision.md), [user flows](../specs/2026-10-11-user-flows.md).

## Global Constraints

- Obsidian 1.14 or later (Bases' built-in kanban layout, view type `kanban`).
- Plugin versions the settings are written for: Iconic 1.1.10, Templater 2.25.0, QuickAdd 2.22.0, Homepage 4.4.4.
- No real knowledge anywhere: all content is the fictional Northwind Arena (clubs Kingsport FC, Harbour Athletic, Vale Rovers; URLs on `.example`). Paths in docs are examples such as `D:\tmp\kiln-layer1`.
- Leave `src/`, `plugin/` and their existing tests unchanged.
- Notes have no `# heading`: the inline title is the file name.
- Relationship properties are always lists of wikilinks, written `"[[Name]]"`, even with one entry.
- File names contain none of `#`, `^`, `[`, `]`, `|`, `/`, `\`, `:`.
- Dates are `YYYY-MM-DD`; date-times are `YYYY-MM-DDTHH:mm`.
- The daily note's last section is `## Log`. Log lines are `- HH:mm text`.
- Icons are Lucide names prefixed `lucide-`. Colours are `#rrggbb`.
- Before pushing: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`.

## Review Focus

1. **A relationship written as a single string, not a list** (`projects: "[[X]]"`): a person would expect the note still to appear in views. The kit prevents it: templates and examples always use lists. Pinned in Task 2 (templates) and Task 6 (examples).
2. **A title with link-breaking characters** (a GitHub key `northwind-arena/club-console#88`): the file name must still be linkable. Pinned in Task 6 with an example reference named `northwind-arena-club-console 88 ...`.
3. **"Log to daily" when today's daily note does not exist yet:** a person expects a full daily note with the line under `## Log`, not a bare file. Pinned in Task 5 (QuickAdd creates the file from the Daily template).
4. **A note whose kind has no icon of its own, or has no kind:** a person expects the type's icon. Pinned in Task 5 (every type has a type-only Iconic rule, after its kind rules).
5. **A personal task with no project:** a person expects it on the board. Pinned in Task 4 (the board has no filter on `projects`) and Task 6 (an example task with no project).

---

## File Structure

```
kit/
  README.md                     what the kit is; setup; adding or changing a type; conventions
  GETTING-STARTED.md            from an empty folder to a checked vault
  types/<type>.md               12 definitions (copied to the vault as _kiln/types/)
  templates/<Type>.md           12 Templater templates (_kiln/templates/)
  views/<type>-<view>.base      related views, one Base per view (_kiln/views/)
  views/inbox.base, needs-review.base, active-projects.base, today.base
  root/Home.md, root/Board.base copied to the vault root
  settings/
    app.json                    keys merged into .obsidian/app.json
    types.json                  .obsidian/types.json (property types)
    daily-notes.json            .obsidian/daily-notes.json
    core-plugins.json           keys merged into .obsidian/core-plugins.json
    community-plugins.json      entries merged into .obsidian/community-plugins.json
    plugins/iconic.json         { fileRules } merged into Iconic's data.json
    plugins/templater.json      keys merged into Templater's data.json
    plugins/quickadd.json       { choices } merged into QuickAdd's data.json
    plugins/homepage.json       Homepage's data.json
tests/kit/
  load.ts                       loadKit(): parsed definitions, templates, views, settings
  definitions.test.ts, templates.test.ts, views.test.ts, settings.test.ts, examples.test.ts
tests/fixtures/layer1/          Northwind Arena example vault content, in vault folders
```

Settings are fragments: applying one sets the listed keys and replaces array entries whose `id` (or `folder` for Templater) the kit owns, keeping everything else.

---

### Task 1: Type definitions

**Files:**
- Create: `tests/kit/load.ts`, `tests/kit/definitions.test.ts`
- Create: `kit/types/{organisation,person,product,topic,project,work,research,decision,meeting,daily,reference,capture}.md`
- Create: `kit/README.md` (sections: What the kit is · Conventions; setup comes in Task 5)

**Interfaces:**
- Produces: `loadDefinitions(): Definition[]` in `tests/kit/load.ts`, where

```ts
type PropType = 'text' | 'date' | 'datetime' | 'number' | 'links' | 'list';
type ViewDef = { type: string; via: string }; // via: a relationship property on `type`, or 'link' for file.hasLink(this.file)
type Definition = {
  name: string; folder: string; template: string; // template: file name in kit/templates, e.g. 'Work.md'
  icon: string; color: string;
  statuses: string[];             // [] for moments
  properties: Record<string, PropType>;
  kinds: Record<string, { icon?: string; color?: string }>;
  sections: string[];
  views: Record<string, ViewDef>; // heading -> what it lists
  body: string;                   // prose after the frontmatter
};
```

This extends the spec's example definition: `views` names what each view lists (`type`) and how it finds it (`via`), so the Base files can be checked against the definition.

- [ ] **Step 1: Write `definitions.test.ts`**

Tests and their assertions:
- `has exactly the twelve starting types`: names equal `organisation, person, product, topic, project, work, research, decision, meeting, daily, reference, capture`.
- `every definition is complete`: `folder`, `template`, `icon` matching `/^lucide-[a-z0-9-]+$/`, `color` matching `/^#[0-9a-f]{6}$/`, non-empty `sections`, non-empty `body`, every property type in `PropType`.
- `folders match the spec`: `Organisations, People, Products, Topics, Projects, Work, Research, Decisions, Meetings, Daily, References, Inbox` in type order.
- `statuses match the spec`: organisation, person, product, topic `[active, archived]`; project `[shaping, active, closing, done, abandoned]`; work `[backlog, active, blocked, review, done, abandoned]`; research `[open, answered]`; decision `[proposed, accepted, superseded]`; capture `[inbox, filed]`; meeting, daily, reference `[]`.
- `kinds match the spec`: organisation `client, vendor, partner, self`; product `app, service, tool, platform`; work `feature, bug, chore, incident, task`; meeting `standup, workshop`; reference `doc, thread, spec, code, dashboard, post, sheet, slides, video, ticket`; others none.
- `properties and sections match the spec table`: each type's own properties and sections as in the spec's "Each type's page" table. Relationships are `links`; `jira`, `github` are `list`; `verified`, `decided`, `date` are `date`; `captured` is `datetime`.
- `views point at real relationships`: every `views[*].type` is a defined type, and `via` is `'link'` or a property of type `links` on that type. The one exception is `daily`, whose views match on dates: `via` is `created` or `mtime` (see Step 4).
- `shared property names are not redefined`: no definition lists `type, kind, status, created, summary, aliases, keywords, tags, review`.

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run tests/kit/definitions.test.ts` fails: `kit/types` missing.

- [ ] **Step 3: Implement `loadDefinitions()`** — read `kit/types/*.md`, split frontmatter with the `yaml` package, keep the body.

- [ ] **Step 4: Write the 12 definitions** with the spec's values and these icons and colours:

| Type | Icon, colour | Kind overrides |
|---|---|---|
| organisation | building, #6272a4 | client building-2 #ff79c6 · vendor package #69c8db · partner handshake #ffb86c · self landmark #a371f9 |
| person | user, #50fa7b | |
| product | box, #69c8db | app smartphone · service server · tool wrench · platform layers |
| topic | book-open, #f1fa8c | |
| project | rocket, #a371f9 | |
| work | square-check, #8be9fd | feature sparkles · bug bug #ff5555 · chore hammer · incident siren #ff5555 · task circle-check |
| research | flask-conical, #bd93f9 | |
| decision | gavel, #ffb86c | |
| meeting | users, #50fa7b | standup message-circle · workshop presentation |
| daily | sun, #f1fa8c | |
| reference | bookmark, #6272a4 | doc file-text · thread messages-square · spec file-code · code code · dashboard gauge · post newspaper · sheet sheet · slides presentation · video video · ticket ticket |
| capture | inbox, #ffb86c | |

Views (`via` is the property on the listed type, or `link`):
- organisation: People (person, organisations) · Products (product, organisations) · Projects (project, organisations) · Meetings (meeting, organisations)
- person: Projects (project, people) · Work (work, link) · Meetings (meeting, attendees) · Decisions (decision, link)
- product: Projects (project, products) · Work (work, products) · Decisions (decision, link) · Topics (topic, products)
- topic: Sub-topics (topic, topics) · Research (research, topics) · Decisions (decision, link) · References (reference, topics)
- project: Board (work, projects) · Decisions (decision, projects) · Meetings (meeting, projects) · Research (research, projects) · References (reference, projects)
- work: Decisions (decision, link) · Meetings (meeting, link) · References (reference, work)
- research: Work raised (work, link) · Decisions (decision, research)
- decision: Superseded by (decision, supersedes)
- meeting: Work raised (work, link)
- daily: Captures (capture, created) · Work touched (work, mtime). These two are date matches, not relationships: allow `via` values `created` and `mtime` for `daily` only, and say so in the test.

Each body: two to four sentences on what the type is for and when to use it, from the spec.

- [ ] **Step 5: Write `kit/README.md`** sections "What the kit is" and "Conventions": file naming (replace `#`, `^`, `[`, `]`, `|` with a space and `/`, `\`, `:` with `-`, then collapse spaces), relationships point up and are lists, moments are date-first, log line format.

- [ ] **Step 6: Run, expect PASS** — `npx vitest run tests/kit/definitions.test.ts`.

- [ ] **Step 7: Commit** — `git add kit tests/kit && git commit -m "feat(kit): add the twelve type definitions"`

---

### Task 2: Templates

**Files:**
- Create: `kit/templates/{Organisation,Person,Product,Topic,Project,Work,Research,Decision,Meeting,Daily,Reference,Capture}.md`
- Create: `tests/kit/templates.test.ts`
- Modify: `tests/kit/load.ts` (add `loadTemplates()`)

**Interfaces:**
- Consumes: `loadDefinitions()`.
- Produces: `loadTemplates(): Map<string, { frontmatterKeys: string[]; frontmatterRaw: string; headings: string[]; embeds: string[]; text: string }>` keyed by template file name.
- Produces: the view file name rule `viewFile(type, heading) = \`${type}-${slug(heading)}.base\``, `slug` = lower case, spaces to `-` (`Work raised` → `work-raised`). Export `viewFile` from `load.ts`.

- [ ] **Step 1: Write `templates.test.ts`**
- `every definition has its template` (`def.template` exists).
- `frontmatter has the shared and own properties`: keys equal the shared nine plus `Object.keys(def.properties)`, in that order.
- `type is fixed and status defaults to the first status`: `type: <name>`; `status` is `statuses[0]`, absent for moments.
- `relationships are written as lists`: every `links` and `list` property and `aliases`, `keywords`, `tags` is `[]` (Review Focus 1).
- `created uses Templater's date`: `created: <% tp.date.now("YYYY-MM-DD") %>`.
- `body is the sections then the views`: `## ` headings equal `def.sections` followed by `Object.keys(def.views)`; under each view heading the only content is `![[<viewFile>]]`.
- `no title heading`: no line starts with `# `.
- `kind is chosen when the type has kinds`: the template contains a `tp.system.suggester` call listing exactly the kind names; types without kinds have `kind:` empty and no suggester.
- `daily keeps Log last and links its neighbours`: Daily's last heading is `Log`; it contains `[[<% yesterday %>|← yesterday]] · [[<% tomorrow %>|tomorrow →]]` computed from `tp.file.title` (as the previous vault's template did); `date` is `<% tp.file.title %>`.
- `capture records when it arrived`: `captured: <% tp.date.now("YYYY-MM-DDTHH:mm") %>`.

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `loadTemplates()` and `viewFile()`.** Read frontmatter keys line by line (`/^([a-z_]+):/`) rather than with the `yaml` package, because Templater tags are not valid YAML.
- [ ] **Step 4: Write the 12 templates.**
- [ ] **Step 5: Run, expect PASS.**
- [ ] **Step 6: Commit** — `git commit -m "feat(kit): add a Templater template per type"`

---

### Task 3: Related views

**Files:**
- Create: one `kit/views/<viewFile>.base` per view in the definitions (30 files)
- Create: `tests/kit/views.test.ts`; Modify: `tests/kit/load.ts` (add `loadBase(file): unknown`)

**Interfaces:**
- Consumes: `loadDefinitions()`, `viewFile()`.

Filter rule for each view (`type` and `via` from the definition):

```yaml
filters:
  and:
    - type == "<type>"
    - <via>.contains(this)          # via is a relationship
    - file.hasLink(this.file)       # via is 'link' (instead of the line above)
    - created == this.date          # daily Captures
    - file.mtime.date() == this.date  # daily Work touched
```

Each Base has one `table` view named after the heading, with `order: [file.name, kind, status, summary]` (drop `kind` or `status` where the listed type has none). The project's Board is a `kanban` view grouped by `status` (see Task 4 for the grouping keys).

- [ ] **Step 1: Write `views.test.ts`**
- `every view in a definition has its Base file` and `no Base file is unused`.
- `each Base filters on the listed type and its relationship`: the `and` list contains `type == "<type>"` and the exact `via` line above.
- `each Base parses and has one view` named after the heading.
- `the project board is a kanban grouped by status`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Write the Base files.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(kit): add each type's related views"`

---

### Task 4: Home, Board and the standalone views

**Files:**
- Create: `kit/root/Home.md`, `kit/root/Board.base`
- Create: `kit/views/{inbox,needs-review,active-projects,today}.base`
- Modify: `tests/kit/views.test.ts`

- [ ] **Step 1: Add tests**
- `board shows all live work as a kanban by status`: view `type: kanban`, grouped by `status`, filters exactly:

```yaml
filters:
  and:
    - type == "work"
    - status != "abandoned"
    - or:
        - status != "done"
        - file.mtime > now() - "14 days"
```

and no filter mentions `projects` (Review Focus 5). Card properties include `projects`.
- `inbox lists captures waiting for triage`: `type == "capture"` and `status == "inbox"`. Newest first: the sort is set through the Group or sort menu in Obsidian during Task 7 and copied back, because the sort key is not documented.
- `needs review lists notes with a reason`: `review != ""` (any type), showing `review`.
- `active projects`: `type == "project"`, `status == "active"`.
- `today`: `type == "daily"`, `date == today()`.
- `home embeds today, inbox, active projects and needs review, and links the board`: `Home.md` has headings Today · Inbox · Active projects · Needs review, each embedding its Base, and a `[[Board.base|Board]]` link. No title heading.

- [ ] **Step 2: Run, expect FAIL.** **Step 3: Write the files.** **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(kit): add Home, the board and the standalone views"`

---

### Task 5: Settings and the apply procedure

**Files:**
- Create: everything under `kit/settings/` (see File Structure)
- Create: `tests/kit/settings.test.ts`
- Modify: `kit/README.md` (add "Setting up a vault" and "Adding or changing a type")

**Interfaces:**
- Consumes: `loadDefinitions()`.

Values:
- `app.json`: `propertiesInDocument: "hidden"`, `showInlineTitle: true`, `newFileLocation: "folder"`, `newFileFolderPath: "Inbox"`, `newLinkFormat: "shortest"`, `alwaysUpdateLinks: true`, `userIgnoreFilters: ["_kiln/"]`.
- `types.json`: `{ "types": { ... } }` with `links` and `list` → `multitext`, `date` → `date`, `datetime` → `datetime`, `number` → `number`, `text` → `text`; plus `created: date`, `aliases: aliases`, `tags: tags`, `keywords: multitext`, `review: text`, `summary: text`, `status: text`, `type: text`, `kind: text`.
- `daily-notes.json`: `folder: "Daily"`, `format: "YYYY-MM-DD"`, `template: ""` (Templater's folder template fills it; a core template would run before Templater).
- `core-plugins.json`: `bases`, `daily-notes`, `properties`, `backlink`, `switcher`, `global-search`, `file-explorer`, `command-palette` true; `templates` false.
- `community-plugins.json`: `["iconic", "templater-obsidian", "quickadd", "homepage"]`.
- `plugins/iconic.json`: `{ "fileRules": [...] }`. Per type: one rule per kind with its own icon or colour, then one type rule. Rule shape as Iconic 1.1.10 writes it: `{ id, name, category: "rule", iconDefault: "lucide-file", icon, color, match: "all", conditions: [{ source: "property:type", operator: "is", value }, …kind condition], enabled: true }`. Ids `kiln-<type>` and `kiln-<type>-<kind>`; a kind rule without its own colour uses the type's colour.
- `plugins/templater.json`: `templates_folder: "_kiln/templates"`, `trigger_on_file_creation_mode: "folder"`, `folder_templates`: one `{ folder, template: "_kiln/templates/<Template>" }` per type.
- `plugins/quickadd.json`: `{ "choices": [...] }` with two choices, ids `kiln-capture` and `kiln-log`:
  - "Capture to inbox": a Template choice, template `_kiln/templates/Capture.md`, folder `Inbox`, file name `{{DATE:YYYY-MM-DD}} {{VALUE:Capture}}`.
  - "Log to daily": a Capture choice to `Daily/{{DATE:YYYY-MM-DD}}.md`, format `- {{DATE:HH:mm}} {{VALUE:Log}}`, `insertAfter: { enabled: true, after: "## Log", insertAtEnd: true, createIfNotFound: true, createIfNotFoundLocation: "bottom" }`, `createFileIfItDoesntExist: { enabled: true, createWithTemplate: true, template: "_kiln/templates/Daily.md" }`.
- `plugins/homepage.json`: the shape the previous vault used, with `value: "Home"`, `kind: "File"`, `openOnStartup: true`, `openWhenEmpty: true`.

- [ ] **Step 1: Write `settings.test.ts`**
- `every type has an icon rule after its kind rules`: for each definition, rule `kiln-<type>` exists with the type's icon and colour, and every `kiln-<type>-<kind>` rule comes before it (Review Focus 4).
- `kind rules exist exactly for kinds with their own icon or colour`.
- `every folder has its template`: `folder_templates` covers each definition's folder with its template.
- `every property has a type`: `types.json` covers every property in every definition, plus the shared ones.
- `log to daily appends under Log and creates a full daily` (Review Focus 3): the `kiln-log` choice values above.
- `capture to inbox uses the capture template in Inbox`.
- `community plugins are the four`.
- [ ] **Step 2: Run, expect FAIL.** **Step 3: Write the settings.** **Step 4: Run, expect PASS.**
- [ ] **Step 5: Write the README procedures.** "Setting up a vault": install the four plugins from the community browser and close Obsidian; create the type folders; copy `kit/types`, `kit/templates`, `kit/views` and the README to `_kiln/`; copy `kit/root/*` to the vault root; merge each settings fragment (keys set, kit-owned array entries replaced, others kept); open Obsidian and check. "Adding or changing a type": edit or add the definition, update its template, views, Iconic rules, Templater folder entry and `types.json`, run `npx vitest run tests/kit`, then copy the changed files in. Iconic and Templater pick up settings changes with Obsidian open; QuickAdd and Homepage need Obsidian closed.
- [ ] **Step 6: Commit** — `git commit -m "feat(kit): add plugin settings and the apply procedure"`

---

### Task 6: Northwind Arena example vault

**Files:**
- Create: `tests/fixtures/layer1/<Folder>/<note>.md` for the notes below
- Create: `tests/kit/examples.test.ts`

Notes (one project and everything around it):

| Folder | Note | Points to |
|---|---|---|
| Organisations | Northwind Arena (self), Vale Rovers (client) | |
| People | Priya Raman | Northwind Arena |
| Products | Club Console (app) | Northwind Arena |
| Topics | Renewal payments | Club Console |
| Projects | Season Ticket Renewals 2027 (active) | Vale Rovers, Club Console, Priya Raman |
| Work | Fix renewal date rollover (bug, active; one `jira` and two `github` links) | the project, Club Console |
| Work | Book the stadium walkthrough (task, backlog, **no project**) | |
| Research | 2026-10-02 How do card retries affect renewals (answered) | the project, Renewal payments |
| Decisions | 2026-10-05 Retry failed renewals for three days (accepted) | the project, the research |
| Meetings | 2026-10-06 Renewals standup (standup) | Priya Raman, the project |
| Daily | 2026-10-06 | log lines in `- HH:mm text` form, Log last |
| References | northwind-arena-club-console 88 Renewal date rolls over a year early (ticket) | the bug |
| Inbox | 2026-10-06 Ask Priya about grace periods (inbox) | |

Bodies are short prose under the type's sections, with the view headings and embeds exactly as in the templates.

- [ ] **Step 1: Write `examples.test.ts`**
- `every note matches its definition`: `type` is defined; the note sits in the type's folder; `status` is in its statuses (absent for moments); `kind` is one of its kinds or empty; every property is shared or the type's own.
- `relationships are lists of links that resolve` to example notes (Review Focus 1).
- `file names are linkable`: no `#`, `^`, `[`, `]`, `|`, `:` (Review Focus 2).
- `moments are named date first`.
- `the daily note ends with its log`.
- `a personal task needs no project` (Review Focus 5): the task has `projects: []`.
- `examples and kit contain no denylisted names`: same check as `tests/unit/fixtures.test.ts`, over `kit/` and `tests/fixtures/layer1/`, skipped with the same message when `tests/fixtures/denylist.txt` is absent.
- [ ] **Step 2: Run, expect FAIL.** **Step 3: Write the notes.** **Step 4: Run, expect PASS.**
- [ ] **Step 5: Run everything** — `npm run format:check && npm run lint && npm run typecheck && npm test`, all pass.
- [ ] **Step 6: Commit** — `git commit -m "test(kit): add a Northwind Arena example vault"`

---

### Task 7: Getting started guide

**Files:**
- Create: `kit/GETTING-STARTED.md`
- Modify: `kit/README.md` (link the guide at the top)

The guide takes the owner from an empty folder to a working, checked vault. Every command works in both Bash and pwsh. It does not replace `docs/getting-started.md`, which still describes v1 and is linked from the v1 README.

Sections:
1. **What you need:** Obsidian 1.14 or later, Claude Code, a clone of the kiln repo.
2. **Make an empty vault:** create a folder (example `D:\tmp\kiln-layer1`), open it as a vault in Obsidian, turn on community plugins, install and enable Iconic, Templater, QuickAdd and Homepage, close Obsidian.
3. **Apply the kit:** start `claude` in the kiln repo and give it this prompt, with the folder filled in:

   ```text
   Set up the kiln kit in <vault folder> by following "Setting up a vault" in kit/README.md exactly.
   Then copy the Northwind Arena examples from tests/fixtures/layer1 into it.
   Report each file you wrote and each setting you merged.
   ```

   The examples are optional: leave out the second line for an empty kit.
4. **Check it:** the checklist (moved here from Task 8, so there is one copy): Home, icons, properties, project page and board, the standalone board, the other pages' views, capture, log to daily, new notes.
5. **Try the flows:** capture a thought, log a line, start a project and add a task, drag a card.
6. **Add a type:** the "Adding or changing a type" procedure, as a prompt to Claude.
7. **Start again:** close Obsidian and delete the folder. Nothing outside it changes.

- [ ] **Step 1: Write the guide.** Every instruction is one action with a visible result.
- [ ] **Step 2: Check it against the kit:** every file, setting and plugin it names exists in `kit/`, and the checklist covers Review Focus 1 to 5.
- [ ] **Step 3: Commit** — `git commit -m "docs(kit): add a getting started guide for an empty folder"`

---

### Task 8: Apply to a test vault and check in Obsidian

This task needs the owner at Obsidian. It runs `kit/GETTING-STARTED.md` from an empty folder, so it also tests the guide. Claude prepares; the owner checks.

- [ ] **Step 1 (owner):** Section 2 of the guide.
- [ ] **Step 2 (Claude):** Section 3 of the guide, with the examples.
- [ ] **Step 3 (owner):** Section 4 of the guide: open the vault and work through the checklist, which covers:
  - Home opens on start-up; Today, Inbox, Active projects and Needs review show the example notes.
  - Every note shows its type's icon and colour in the file explorer and tabs; the bug and the client show their kind icons; a note with no kind shows the type icon.
  - Properties are hidden in notes and visible in the right sidebar with the right widgets (dates, lists).
  - The project page's views list its work, decisions, meetings, research and references; its board shows the bug; dragging the bug to `review` changes its `status`.
  - Board shows both work items, including the task with no project; columns are in status order.
  - Person, product, topic, research, decision and meeting pages list what links to them; the daily note's Captures and Work touched views show the 2026-10-06 notes.
  - "Capture to inbox" creates a capture in `Inbox` that appears on Home, with the template applied once (QuickAdd and Templater's Inbox folder template must not both insert it).
  - A new note from the command palette or a link to a missing note lands in `Inbox` as a capture.
  - "Log to daily" appends `- HH:mm text` at the end of today's daily note, creating it from the template when missing.
  - A new note in `Projects` gets the Project template; a new `Work` note asks for its kind.
- [ ] **Step 4 (Claude):** Fix the guide wherever a step was unclear or wrong. For anything Obsidian had to fix by hand (for example kanban column order or a sort set through the Group menu, which Obsidian writes into the Base file), copy the file Obsidian wrote back into `kit/`, update the tests if the shape changed, and re-run `npx vitest run tests/kit`.
- [ ] **Step 5 (Claude):** Record what was found in the spec's Decided sections where it changes a decision. Add the kit, its getting started guide, the layer 1 design and this plan to `CLAUDE.md`'s "Start here".
- [ ] **Step 6: Commit** — `git commit -m "feat(kit): apply fixes from the first test vault"`

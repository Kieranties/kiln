# Try the sample

The sample is a fictional project, with one note of every type around it, so you can see the whole blueprint working before adding anything of your own. It belongs to Northwind Arena, an invented sports-tech platform, and its client club Vale Rovers.

Use a separate trial vault, so the sample never mixes with your own notes.

## 1. Make a trial vault

1. Follow [Getting started](./getting-started.md) **sections 1 and 2 only**, with a new empty folder, for example `D:\tmp\kiln-sample`. Keep the trial vault open in Obsidian: Claude installs the plugins through it, then asks you to close it.
2. Come back here instead of going on to Getting started section 3. Start Claude in any folder (`claude`) and give it this prompt, with your trial folder filled in:

   ```text
   /kiln:setup <trial vault folder> with the Northwind Arena sample
   ```

   It installs any missing plugins, as Getting started section 3 describes, applies the blueprint and adds the sample: the notes in `tests/fixtures/sample` in the kiln repo, at the same version as your Claude plugin. It fetches them from GitHub, so it needs a connection.

3. Open Obsidian on the trial vault and carry on with section 3 below. The right sidebar shows **File properties**; if it doesn't, open the command palette (Ctrl+P, or Cmd+P on a Mac), search for **properties** and choose **Show file properties**.

## 2. What's in it

| Note | Type | What it shows |
|---|---|---|
| Season Ticket Renewals 2027 | project | The project page: its board, decisions, meetings, research and references |
| Fix renewal date rollover | work (bug) | A work item with Jira and GitHub links |
| Add a grace period setting · Send renewal reminder emails | work (feature) | Work in review and done, so the board has more columns |
| Book the stadium walkthrough | work (task) | A personal task with no project |
| Northwind Arena · Vale Rovers | organisation | My organisation (self) and a client |
| Priya Raman | person | A person page, built from links to her |
| Club Console | product | An app and the work on it |
| Renewal payments | topic | Knowledge, with its research |
| 2026-10-02 How do card retries affect renewals | research | A question answered on a date |
| 2026-10-05 Retry failed renewals for three days | decision | A decision citing its research |
| 2026-10-06 Renewals standup | meeting | A standup with its attendee |
| 2026-10-06 | daily | A daily note with a log |
| northwind-arena-club-console 88 Renewal date rolls over a year early | reference | A GitHub issue, named so it stays linkable |
| 2026-10-06 Ask Priya about grace periods | capture | Something waiting in the inbox |

## 3. Look around

Open Obsidian. Work through the list; each line is one thing to look at.

**Home and icons**

- [ ] Home's Inbox lists *Ask Priya about grace periods*; Active projects lists *Season Ticket Renewals 2027*. Nothing from `_kiln` is listed.
- [ ] Every note in the file explorer has its type's icon and colour: a rocket for the project, a book for the topic, a sun for the daily note.
- [ ] Kinds show their own icon: *Vale Rovers* (client) and *Fix renewal date rollover* (bug, in red).
- [ ] *Renewal payments* (a topic, which has no kinds) shows the topic icon.

**The project**

- [ ] Open *Season Ticket Renewals 2027*. In the file properties view, dates show a date picker and `organisations`, `products` and `people` show as lists of links.
- [ ] At the bottom, its views list its work, decision, meeting, research and reference.
- [ ] Its Board shows three cards: *Fix renewal date rollover* (active), *Add a grace period setting* (review) and *Send renewal reminder emails* (done). Drag the bug to **review**: its `status` changes to `review`.
- [ ] Open the **Board** from Home. It shows those three and *Book the stadium walkthrough* in Backlog. Every column is there, in order (Backlog, Active, Blocked, Review, Done), including the empty Blocked column.

**Other pages**

- [ ] *Priya Raman* lists the project and the standup (through their properties), and the bug and the decision (because their text links to her).
- [ ] *Club Console* lists the project, the work on it and the *Renewal payments* topic.
- [ ] *Renewal payments* lists the research. *2026-10-02 How do card retries affect renewals* lists the decision that cites it.
- [ ] The bug's References view lists *northwind-arena-club-console 88 Renewal date rolls over a year early*, and the link opens it.
- [ ] The daily note *2026-10-06* shows the capture under Captures. Its Log is the last section, and its yesterday and tomorrow links point into `Daily`.

Tell Claude about anything that doesn't match, with the line it failed on.

## 4. When you're done

Close Obsidian and delete the trial vault folder. Setup also recorded the trial vault in `~/.kiln/config.json` (on Windows, `.kiln` is in your home folder). Once the folder is gone, kiln says so and offers your other vaults, or you can delete its line from that file.

# Try the sample

The sample is a fictional project, with one note of every type around it, so you can see the whole kit working before adding anything of your own. It belongs to Northwind Arena, an invented sports-tech platform, and its client club Vale Rovers.

Use a separate trial vault, so the sample never mixes with your own notes.

## 1. Make a trial vault

Follow [Getting started](GETTING-STARTED.md) sections 1 to 3 with a new empty folder, for example `D:\tmp\kiln-sample`. In section 3, use this prompt instead:

```text
Set up the kiln kit in <trial vault folder> by following "Setting up a vault" in kit/README.md exactly.
Then copy the Northwind Arena sample from tests/fixtures/layer1 into it.
Report each file you wrote and each setting you merged.
```

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

- [ ] Open *Season Ticket Renewals 2027*. In the properties view, dates show a date picker and `organisations`, `products` and `people` show as lists of links.
- [ ] At the bottom, its views list its work, decision, meeting, research and reference.
- [ ] Its Board shows three cards: *Fix renewal date rollover* (active), *Add a grace period setting* (review) and *Send renewal reminder emails* (done). Drag the bug to **review**: its `status` changes to `review`.
- [ ] Open the **Board** from Home. It shows those three and *Book the stadium walkthrough* in backlog. Columns run in status order (backlog, active, review, done); if they don't, set the order with the Group menu and tell Claude, so the order can be saved into the kit.

**Other pages**

- [ ] *Priya Raman* lists the project and the standup (through their properties), and the bug and the decision (because their text links to her).
- [ ] *Club Console* lists the project, the work on it and the *Renewal payments* topic.
- [ ] *Renewal payments* lists the research. *2026-10-02 How do card retries affect renewals* lists the decision that cites it.
- [ ] The bug's References view lists *northwind-arena-club-console 88 Renewal date rolls over a year early*, and the link opens it.
- [ ] The daily note *2026-10-06* shows the capture under Captures. Its Log is the last section, and its yesterday and tomorrow links point into `Daily`.

Tell Claude about anything that doesn't match, with the line it failed on.

## 4. When you're done

Close Obsidian and delete the trial vault folder. Nothing outside it was changed.

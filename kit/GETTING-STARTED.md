# Getting started with the kiln kit

This guide takes you from an empty folder to a working vault built from the kiln kit, then checks it. It takes about fifteen minutes. Claude does the copying and settings; you do the parts in Obsidian.

The commands work in both Bash and PowerShell.

## 1. What you need

- **Obsidian 1.14 or later.** Check in Settings → About. The board needs Bases' built-in kanban, added in 1.14.
- **Claude Code** (`claude --version`).
- **A clone of the kiln repo:**

  ```bash
  git clone https://github.com/Kieranties/kiln.git
  ```

## 2. Make an empty vault

1. Create an empty folder, for example `D:\tmp\kiln-layer1`.
2. In Obsidian, choose **Open folder as vault** and pick the folder.
3. Go to Settings → Community plugins and select **Turn on community plugins**.
4. Select **Browse** and install and enable each of these: **Iconic**, **Templater**, **QuickAdd**, **Homepage**.
5. In Settings → Templater, turn on **Trigger Templater on new file creation**. Templater keeps this switch on your device rather than in the vault, so the kit can't set it for you. Without it, new notes get no template.
6. **Close Obsidian.** QuickAdd and Homepage only read their settings when Obsidian starts, so the kit must be applied while it is closed.

## 3. Apply the kit

Start Claude in the kiln repo:

```bash
cd kiln
claude
```

Give it this prompt, with your folder filled in:

```text
Set up the kiln kit in <vault folder> by following "Setting up a vault" in kit/README.md exactly.
Then copy the Northwind Arena examples from tests/fixtures/layer1 into it.
Report each file you wrote and each setting you merged.
```

The examples are a fictional project with one note of every type. Leave out the second line for an empty kit.

## 4. Check it

Open Obsidian. Work through the list; each line is one thing to look at.

**Home and icons**

- [ ] Obsidian opens on **Home**. Inbox lists the capture *Ask Priya about grace periods*; Active projects lists *Season Ticket Renewals 2027*.
- [ ] Every note in the file explorer has its type's icon and colour: a rocket for the project, a book for the topic, a sun for the daily note.
- [ ] Kinds show their own icon: *Vale Rovers* (client) and *Fix renewal date rollover* (bug, in red).
- [ ] *Renewal payments* (a topic, which has no kinds) shows the topic icon.

**Notes**

- [ ] Open *Season Ticket Renewals 2027*. There is no title heading in the text, and no properties block: properties are in the properties view in the right sidebar (search the command palette for "properties" if it isn't open).
- [ ] In the sidebar, dates show a date picker and `projects`, `people` and the other relationships show as lists of links.
- [ ] At the bottom, the project's views list its work, decisions, meetings, research and references.

**Boards**

- [ ] The project's Board shows three cards: *Fix renewal date rollover* (active), *Add a grace period setting* (review) and *Send renewal reminder emails* (done). Drag the bug to **review**: its `status` property changes to `review`.
- [ ] Open the **Board** from Home. It shows those three and *Book the stadium walkthrough* in backlog, a personal task with no project. Columns run in status order (backlog, active, review, done); if they don't, set the order with the Group menu and tell Claude, so the order can be saved into the kit.
- [ ] Neither Board nor Home's Inbox lists anything from `_kiln` (the kit's templates).

**Other pages**

- [ ] *Priya Raman* lists the project and the standup (through their properties), and the bug and the decision (because their text links to her).
- [ ] *Club Console* lists the project, the bug and the *Renewal payments* topic.
- [ ] *Renewal payments* lists the research. *2026-10-02 How do card retries affect renewals* lists the decision that cites it.
- [ ] The bug's References view lists *northwind-arena-club-console 88 Renewal date rolls over a year early*, and the link opens it.
- [ ] The daily note *2026-10-06* shows the capture under Captures. Its Log is the last section.

**Creating notes**

- [ ] Run **QuickAdd: Capture to inbox** from the command palette and type a few words. A capture appears in `Inbox` with its properties filled in once (not twice), and Home's Inbox lists it.
- [ ] Run **QuickAdd: Log to daily** and type a line. Today's daily note is created from the template, with yesterday and tomorrow links, and your line is the last line of the file as `- HH:mm your text`. Run it again: the second line goes below the first.
- [ ] Create a new note in `Projects`: it gets the project's properties and sections.
- [ ] Create a new note in `Work`: Templater asks for its kind.
- [ ] Create a note with **New note**: it lands in `Inbox` as a capture.
- [ ] Mark a note for review by typing a reason in its `review` property: it appears under Needs review on Home. Clear the reason and it disappears.

Tell Claude about anything that doesn't match, with the line it failed on.

## 5. Try the flows

- **Capture a thought:** QuickAdd: Capture to inbox.
- **Log your day:** QuickAdd: Log to daily, as often as you like. Use the Scratch section for anything longer.
- **Start a project:** a new note in `Projects`, then work items in `Work` that list it in `projects`. Watch them appear on its Board.
- **Move work:** drag cards on the Board.

## 6. Add a type

Give Claude a prompt like this:

```text
Add a "runbook" type to the kiln kit: a how-to for operating a product, with sections Purpose, Steps and Rollback, linked to products.
Follow "Adding or changing a type" in kit/README.md, then apply it to <vault folder>.
```

## 7. Start again

Close Obsidian and delete the vault folder. Nothing outside it was changed.

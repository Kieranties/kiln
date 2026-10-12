# Getting started with the kiln blueprint

This guide sets up your vault with the kiln blueprint, from an empty folder, then walks you through your first notes. It takes about fifteen minutes. Claude does the copying and settings; you do the parts in Obsidian.

Want to look around before adding anything of your own? [Try the sample](TRY-THE-SAMPLE.md) loads a fictional project into a trial vault.

## 1. What you need

- **Obsidian 1.14 or later.** Check in Settings → About. The board needs Bases' built-in kanban, added in 1.14.
- **Claude Code** (`claude --version`).
- **Node 24** (`node --version`). Setup runs a small Node script. Without Node, Claude follows the steps by hand, more slowly.
- **The kiln plugin for Claude Code.** Install it once, as [the README says](https://github.com/Kieranties/kiln#install). It carries the blueprint, so you need no copy of the kiln repo.

## 2. Make your vault

1. Create an empty folder for your vault, for example `D:\notes`.
2. In Obsidian, choose **Open folder as vault** and pick the folder.
3. Go to Settings → Community plugins and select **Exit restricted mode**. (Before Obsidian 1.14.4, the button was **Turn on community plugins**.)
4. Select **Browse** and install each of these: **Iconic**, **Templater**, **QuickAdd**, **Homepage**. Installing does not turn a plugin on.
5. Back in Settings → Community plugins, find each of the four under **Installed plugins** and switch it on.
6. **Optional:** in Settings → Templater, turn on **Trigger Templater on new file creation**. It gives notes you create by hand in a type's folder their template. Templater keeps this switch on your device, so the blueprint can't set it. Claude doesn't need it: it creates notes through QuickAdd.
7. **Close Obsidian.** QuickAdd and Homepage only read their settings when Obsidian starts. If you use Run in Background, use its tray icon's **Close Vault**: quitting only hides Obsidian.

## 3. Apply the blueprint

Start Claude in any folder (`claude`) and give it this prompt, with your folder filled in:

```text
/kiln:setup <vault folder>
```

Claude checks the four plugins, shows what it will change, and asks before changing any setting of yours (a new vault has none). It applies the blueprint, records the vault so Claude finds it from any folder, and offers to let Claude write to the vault without asking each time.

## 4. Check it

Open Obsidian.

- [ ] Obsidian opens on **Home**, with Today, Inbox, Active projects and Needs review, all empty.
- [ ] The right sidebar shows **File properties**. Notes keep their properties out of the text, so this is where you read and edit them; it follows whichever note is open. If it isn't there, open the command palette (Ctrl+P, or Cmd+P on a Mac), search for **properties** and choose **Show file properties**.
- [ ] The file explorer has a folder per type (`Projects`, `Work`, `Inbox` and the rest) and a `_kiln` folder holding the blueprint. Each folder shows its type's icon and colour in place of the `>` arrow.

## 5. Your first notes

Each step is something you'll do every day. Check the result as you go.

**Capture something**

- [ ] Run **QuickAdd: Capture to inbox** from the command palette and type a few words. A note appears in `Inbox` with an inbox icon, and Home's Inbox lists it.
- [ ] Open it: there is no properties block in the text. Its properties show in the file properties view in the right sidebar, filled in once. They read with capitals, as **Type: Capture** and **Status: Inbox**, although the note stores them in lowercase. Each property has an icon; relationships such as `projects` show the icon and colour of the type they link to.
- [ ] Create a note with **New note**: it lands in `Inbox` as a capture too.

**Log your day**

- [ ] Run **QuickAdd: Log to daily** and type a line. Today's daily note is created in `Daily` from the template, with yesterday and tomorrow links, and your line is the last line of the file as `- HH:mm your text`.
- [ ] Run it again: the second line goes below the first. Home's Today lists the daily note.
- [ ] Click **tomorrow →**: it creates tomorrow's daily note in `Daily`, not a capture.

**Start a project**

Creating a note in a folder needs Templater's trigger (section 2, step 6). Without it, ask Claude to create the note, or run **QuickAdd: Run QuickAdd** and choose **New project**.

- [ ] Create a note in `Projects`: it gets the project's properties and the sections Goal, Current state, Scope and Done when, with a rocket icon. Set its `status` to `active`: Home's Active projects lists it.
- [ ] Create a note in `Work`: Templater asks for its kind. Choose **task**, and in its `projects` property link your project.
- [ ] The project's Board shows the task in **Backlog**, with every column (Backlog, Active, Blocked, Review, Done) there even when empty. Drag the task to **Active**: its `status` changes to `active`.
- [ ] Open the **Board** from Home: it shows the task. A task with no project shows here too.

**Flag something for review**

- [ ] Type a reason in any note's `review` property: it appears under Needs review on Home. Clear the reason and it disappears.

Tell Claude about anything that doesn't match, with the line it failed on.

## 6. Next steps

- **Keep up with kiln:** after [updating the plugin](https://github.com/Kieranties/kiln#update), run `/kiln:setup` again. It updates what the new blueprint changed and keeps your own edits, asking when both changed.
- **Try the sample:** [Try the sample](TRY-THE-SAMPLE.md) shows every type and view with a fictional project, in a separate trial vault.
- **Add a type:** a new type changes the blueprint itself, so it's done in the kiln repo: [Adding or changing a type](README.md#adding-or-changing-a-type). Then run `/kiln:setup` to apply it.
- **How the blueprint works:** [The kiln blueprint](README.md) covers the types, conventions and how the blueprint is applied.

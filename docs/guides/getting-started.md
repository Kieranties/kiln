# Getting started

This guide sets up your vault with the kiln blueprint, from an empty folder, then walks you through your first notes. It takes about fifteen minutes. Claude does the copying and settings; you do the parts in Obsidian.

Want to look around before adding anything of your own? [Try the sample](./try-the-sample.md) loads a fictional project into a trial vault.

## 1. What you need

- **Obsidian 1.14 or later.** Check in Settings → About. The board needs Bases' built-in kanban, added in 1.14.
- **Claude Code** (`claude --version`), on the same computer as Obsidian. Setup installs **Claudian**, which runs it in a panel inside Obsidian. Claudian works only in Obsidian's desktop app.
- **Node 24** (`node --version`). Setup runs a small Node script. Without Node, Claude follows the steps by hand, more slowly.
- **kiln's Claude plugin.** [Install it](./install.md) once. It carries the blueprint, so you need no copy of the kiln repo. If you install it during a Claude session, run `/reload-plugins` or start a new session before `/kiln:setup` exists.

## 2. Make your vault

1. Create an empty folder for your vault, for example `D:\notes`.
2. In Obsidian, choose **Open folder as vault** and pick the folder, and keep it open: Claude installs the blueprint's plugins through Obsidian in section 3.
3. In Settings → General, check **Command line interface** is on. It lets Claude install the plugins. Turning it on takes effect in terminals you start afterwards, so start Claude in a new one.

**Without the Obsidian CLI,** install the five plugins yourself. In Settings → Community plugins, select **Exit restricted mode** (before Obsidian 1.14.4, the button was **Turn on community plugins**). Select **Browse** and install **Iconic**, **Templater**, **QuickAdd**, **Homepage** and **Claudian**, then switch each on under **Installed plugins**: installing doesn't turn a plugin on. Choose the Claudian by Yishen Tu: several other plugins have similar names.

## 3. Apply the blueprint

Start Claude in any folder (`claude`) and give it this prompt, with your folder filled in:

```text
/kiln:setup <vault folder>
```

Claude checks the five plugins. If any is missing, it installs and switches them on through the Obsidian CLI. That turns off restricted mode, so community plugins can run, and downloads each plugin from Obsidian's community directory, so Claude asks first. Claudian is the one Obsidian staff haven't reviewed: it runs Claude Code inside Obsidian, with your vault as its working folder.

Then Claude asks you to **close Obsidian**, because QuickAdd and Homepage only read their settings when Obsidian starts. If you use Run in Background, use its tray icon's **Close Vault**: quitting only hides Obsidian.

Claude shows what it will change, and asks before changing any setting of yours (a new vault has none). It applies the blueprint, records the vault so Claude finds it from any folder, and offers to let Claude write to the vault without asking each time.

It also suggests turning on **Trigger Templater on new file creation**, in Obsidian's Settings → Templater. That's optional: it gives notes you create by hand in a type's folder their template. Templater keeps this switch on your device, so the blueprint can't set it. Claude doesn't need it: it creates notes through QuickAdd.

## 4. Check it

Open Obsidian.

- [ ] Obsidian opens on **Home**, with Today, Inbox, Active projects and Needs review, all empty.
- [ ] The right sidebar shows **File properties**. Notes keep their properties out of the text, so this is where you read and edit them; it follows whichever note is open. If it isn't there, open the command palette (Ctrl+P, or Cmd+P on a Mac), search for **properties** and choose **Show file properties**.
- [ ] The file explorer has a folder per type (`Projects`, `Work`, `Inbox` and the rest) and a `_kiln` folder holding the blueprint. Each folder shows its type's icon and colour in place of the `>` arrow.
- [ ] Open Claudian: **Open Claudian** in the left ribbon, or **Claudian: Open chat view** from the command palette. Ask it to run `/kiln:check`. It reports on your vault and finds no problems; it only reads, so it's safe to try. If `/kiln:check` isn't offered, turn on Settings → Claudian → Providers → **Load user Claude Code settings**, which lets Claudian load kiln, then start a new chat.

## 5. Your first notes

Each step is something you'll do every day. Check the result as you go.

**Capture something**

- [ ] Run **QuickAdd: Capture to inbox** from the command palette and type a few words. A note appears in `Inbox` with an inbox icon, and Home's Inbox lists it.
- [ ] Open it: there is no properties block in the text. Its properties show in the file properties view in the right sidebar, filled in once. They read with capitals, as **Type: Capture** and **Status: Inbox**, although the note stores them in lowercase. Each property has an icon; relationships such as `projects` show the icon and colour of the type they link to.
- [ ] Create a note with **New note**: it lands in `Inbox` as a capture too. Notes you create by hand need Templater's trigger (section 3); without it, ask Claude to create the note.

**Log your day**

- [ ] Run **QuickAdd: Log to daily** and type a line. Today's daily note is created in `Daily` from the template, with yesterday and tomorrow links, and your line is the last line of the file as `- HH:mm your text`.
- [ ] Run it again: the second line goes below the first. Home's Today lists the daily note.
- [ ] Click **tomorrow →**: it creates tomorrow's daily note in `Daily`, not a capture.

**Start a project**

Creating a note in a folder needs Templater's trigger (section 3). Without it, ask Claude to create the note, or run **QuickAdd: Run QuickAdd** and choose **New project**.

- [ ] Create a note in `Projects`: it gets the project's properties and the sections Goal, Current state, Scope and Done when, with a rocket icon. Set its `status` to `active`: Home's Active projects lists it.
- [ ] Create a note in `Work`: Templater asks for its kind. Choose **task**, and in its `projects` property link your project.
- [ ] The project's Board shows the task in **Backlog**, with every column (Backlog, Active, Blocked, Review, Done) there even when empty. Drag the task to **Active**: its `status` changes to `active`.
- [ ] Open the **Board** from Home: it shows the task. A task with no project shows here too.

**Flag something for review**

- [ ] Type a reason in any note's `review` property: it appears under Needs review on Home. Clear the reason and it disappears.

Tell Claude about anything that doesn't match, with the line it failed on.

## 6. Next steps

- **Keep up with kiln:** after [updating the Claude plugin](./install.md#update), run `/kiln:setup` again. It updates what the new blueprint changed and keeps your own edits, asking when both changed. A kiln file you deleted stays deleted; ask Claude if you want it back.
- **Try the sample:** [Try the sample](./try-the-sample.md) shows every type and view with a fictional project, in a separate trial vault.
- **Add a type:** a new type changes the blueprint itself, so it's done in the kiln repo: [Adding or changing a type](../reference/blueprint.md#adding-or-changing-a-type). A change you make in a checkout reaches your vault only when Claude runs with the Claude plugin loaded from that checkout, for example `claude --plugin-dir D:/src/kiln/claude-plugin` and then `/kiln:setup`. Otherwise it applies once the change is in the installed Claude plugin, after a release and `claude plugin update kiln@kiln`.
- **How the blueprint works:** [How notes are shaped](../concepts/notes.md) explains the types and why they look as they do, and [the blueprint reference](../reference/blueprint.md) has its conventions and how it is applied.

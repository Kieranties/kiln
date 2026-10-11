# Getting started with the kiln kit

This guide sets up your vault with the kiln kit, from an empty folder, then walks you through your first notes. It takes about fifteen minutes. Claude does the copying and settings; you do the parts in Obsidian.

The commands work in both Bash and PowerShell.

Want to look around before adding anything of your own? [Try the sample](TRY-THE-SAMPLE.md) loads a fictional project into a trial vault.

## 1. What you need

- **Obsidian 1.14 or later.** Check in Settings → About. The board needs Bases' built-in kanban, added in 1.14.
- **Claude Code** (`claude --version`).
- **The kiln plugin for Claude Code.** It carries the kit, so you need no copy of the kiln repo. Install it once:

  ```bash
  claude plugin marketplace add Kieranties/kiln --sparse .claude-plugin kit
  claude plugin install kiln@kiln
  ```

  `claude plugin list` then shows `kiln@kiln`. To get kit updates as they land, run `/plugin` in Claude, open **Marketplaces**, choose **kiln** and select **Enable auto-update**. [The kiln plugin](README.md#the-kiln-plugin) has the details.

## 2. Make your vault

1. Create an empty folder for your vault, for example `D:\notes`.
2. In Obsidian, choose **Open folder as vault** and pick the folder.
3. Go to Settings → Community plugins and select **Exit restricted mode**. (Before Obsidian 1.14.4, the button was **Turn on community plugins**.)
4. Select **Browse** and install each of these: **Iconic**, **Templater**, **QuickAdd**, **Homepage**. Installing does not turn a plugin on.
5. Back in Settings → Community plugins, find each of the four under **Installed plugins** and switch it on.
6. In Settings → Templater, turn on **Trigger Templater on new file creation**. Templater keeps this switch on your device rather than in the vault, so the kit can't set it for you. Without it, new notes get no template.
7. **Close Obsidian.** QuickAdd and Homepage only read their settings when Obsidian starts, so the kit must be applied while it is closed.

## 3. Apply the kit

Start Claude in any folder:

```bash
claude
```

Give it this prompt, with your folder filled in:

```text
Set up the kiln kit in <vault folder>.
```

Claude checks the four plugins are installed and asks you to confirm that Obsidian is closed and Templater's trigger is on. Then it copies the kit in as `_kiln`, merges the settings and reports each file it wrote and each setting it changed.

## 4. Check it

Open Obsidian.

- [ ] Obsidian opens on **Home**, with Today, Inbox, Active projects and Needs review, all empty.
- [ ] The right sidebar shows **File properties**. Notes keep their properties out of the text, so this is where you read and edit them; it follows whichever note is open. If it isn't there, open the command palette (Ctrl+P, or Cmd+P on a Mac), search for **properties** and choose **Show file properties**.
- [ ] The file explorer has a folder per type (`Projects`, `Work`, `Inbox` and the rest) and a `_kiln` folder holding the kit. Each folder shows its type's icon and colour in place of the `>` arrow.

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

- [ ] Create a note in `Projects`: it gets the project's properties and the sections Goal, Current state, Scope and Done when, with a rocket icon. Set its `status` to `active`: Home's Active projects lists it.
- [ ] Create a note in `Work`: Templater asks for its kind. Choose **task**, and in its `projects` property link your project.
- [ ] The project's Board shows the task in **Backlog**, with every column (Backlog, Active, Blocked, Review, Done) there even when empty. Drag the task to **Active**: its `status` changes to `active`.
- [ ] Open the **Board** from Home: it shows the task. A task with no project shows here too.

**Flag something for review**

- [ ] Type a reason in any note's `review` property: it appears under Needs review on Home. Clear the reason and it disappears.

Tell Claude about anything that doesn't match, with the line it failed on.

## 6. Next steps

- **Try the sample:** [Try the sample](TRY-THE-SAMPLE.md) shows every type and view with a fictional project, in a separate trial vault.
- **Keep up with the kit:** when the plugin updates, ask Claude to `Re-apply the kiln kit to <vault folder>`. It copies in what changed and merges the settings again.
- **Add a type:** a new type changes the kit itself, so this one is done in a clone of the kiln repo. Start Claude there and give it a prompt like this:

  ```text
  Add a "runbook" type to the kiln kit: a how-to for operating a product, with sections Purpose, Steps and Rollback, linked to products.
  Follow "Adding or changing a type" in kit/README.md, then apply it to <vault folder>.
  ```

- **How the kit works:** [The kiln kit](README.md) covers the types, conventions and how the kit is applied.

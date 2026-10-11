# Experiment: LLM-written knowledge

Status: **closed** (2026-10-11). The Claude side ran once; the plugin side was not run (see below). The first step of [#74](https://github.com/Kieranties/kiln/issues/74); the findings so far are in [LLM-written knowledge that reads well](../../docs/specs/2026-10-11-llm-written-knowledge.md).

The question: given the same raw sources, which writes notes that read better in Obsidian, the karpathywiki plugin or Claude following the kit? All data is Northwind Arena, never the real vault.

## Inputs

Both sides start from the same vault: the [layer 1 sample](../../tests/fixtures/layer1) plus the five raw sources in [`tests/fixtures/sources`](../../tests/fixtures/sources), placed in a `Sources/` folder. They are ingested one at a time, in this order:

| # | Source | What it tests |
|---|---|---|
| 1 | `Vale Rovers onboarding notes.md` | A doc. New aliases for an existing note ("Rovers", "VRFC"); two new contacts, one of whom recurs |
| 2 | `2026-10-06 Renewals standup transcript.md` | A meeting transcript, beside an existing meeting note. New people (Sam Okafor, Tom Ellis); the grace period default |
| 3 | `club-console issue 88.md` | A ticket, which already has a reference note. Updating rather than duplicating |
| 4 | `PayRail Card retry schedules.pdf` | A vendor PDF. A new organisation and product; durable topic facts; non-Markdown input |
| 5 | `Slack payments thread 2026-10-08.md` | A thread that contradicts the sample's decision (retries run five days, not three) |

## Claude side

Run in a Claude session with the draft skill [`kiln-ingest/SKILL.md`](kiln-ingest/SKILL.md) as its only writing guidance. The output is the vault in [`claude/`](claude/). Its git history shows the change: the commit that adds it is the starting state, and the next commit is the ingest.

## Plugin side

**Not run.** The plugin needs its own model API key and cannot use a Claude subscription, which was a deciding point against it. The steps are kept in case it is revisited.

1. Make a trial vault and load the sample, as in [Try the sample](../../kit/TRY-THE-SAMPLE.md).
2. Copy `tests/fixtures/sources/*` into the trial vault's `Sources/` folder.
3. Install **Karpathy LLM Wiki** (`karpathywiki`) from Community plugins. Set a provider and key; keep the wiki folder as `wiki` and the output language English. Record the plugin version and model here.
4. Ingest the five sources one at a time, in the order above.
5. Copy the trial vault's `wiki/` folder into [`plugin/`](plugin/) and commit it. It is Northwind Arena only, so it is safe to commit.

## Reading side by side

Open each pair in Obsidian and record what you find for each question.

| Question | What to look at |
|---|---|
| Can I tell what the note is from its top? | The `summary` and the first section |
| Does it read as prose, or as a dump? | Section length; link lists against links in sentences |
| Can I see where a claim came from without leaving the sentence? | Links to reference notes, footnotes, quote blocks |
| Is everything about Vale Rovers in one place? | Whether "Rovers" and "VRFC" went to the existing note |
| Did it create notes for the right things? | Sam Okafor and Tom Ellis (recur); Mira Chen (once); PayRail |
| Did it notice the contradiction, and could I act on it? | Three days in the decision and research against five days live |
| Is anything there that is only for the machine? | Frontmatter beyond the type definition, hidden markers |
| What did it leave alone? | `## Notes`, the decision and meeting notes, the raw sources |

## Results

### Claude side, first run (2026-10-11)

One fresh session, the draft skill and nothing else; about five minutes for all five sources. `git diff 1122f27 -- experiments/llm-wiki/claude` shows the whole ingest: 9 notes created, 9 changed, 346 lines added, 7 removed. The raw sources are byte for byte unchanged.

**What it got right**

- **The structure holds.** Frontmatter only from the definitions, sections in template order, no title heading, every link resolves, no link-only lists, `## Notes` left empty everywhere.
- **No duplicates.** Issue 88 already had a reference note, so it filled that in rather than creating a second. "VRFC" went onto Vale Rovers as an alias.
- **The right new notes.** Tom Ellis and Sam Okafor (each in several sources), PayRail as a vendor, the Fan App. Mira Chen, named once, got no note.
- **Every new claim is sourced** in its sentence, to a reference note.
- **It found the contradiction** and set `review` on the decision and the topic, with a reason that says what disagrees with what. It also caught four discrepancies it was not set up to find: a work item still `active` though its issue is closed, a project's "one bug open", a send date, and two wrong weekdays in the sources (an accident in the fixtures, kept so both sides see the same input).
- **The daily log** has one readable line per source, saying what was created, updated and flagged.

**What reads badly**

- **It adds, and never consolidates.** "Writes are targeted" was read as "append only". Renewal payments' Durable facts grew from one bullet to eleven, and the original "each retry is a new charge attempt" now sits beside a near copy. Vale Rovers keeps "The newest of the three client clubs" above a long new paragraph that says it better.
- **The contradiction reads as two facts.** "Retried daily for three days" and "in practice five days" are separate bullets, eight lines apart. A reader wants one statement of the current state: decided three, live five, until the switch.
- **Citations are heavy.** `([[Vale Rovers — onboarding notes|onboarding notes]])` ends four bullets in a row. One citation per paragraph, or per run of facts from the same source, would read better.
- **Review is noisy.** Five of eighteen notes are flagged. One flag, a send date that is "Friday" in a transcript, is not worth my time.
- **It guessed pronouns** ("He prefers a weekly call") that no source gave.

**What the skill needs** (the session's own list of 19 judgement calls, condensed)

1. **A consolidation step:** after adding to a section, rewrite that section to read as one piece, merge near copies, and keep each claim's citation. Targeted still means "only the sections I touched".
2. **Contradictions as current state:** one statement of what is true now and what was decided, with both sources, plus `review`.
3. **Reference names:** the source's own title can collide with the raw file's name, and transcripts and threads have no useful title. A rule such as "a date-first title for moments, never the raw file's exact name".
4. **`verified`:** the kit says "the date claims were last checked against live sources"; the skill said "the newest source's date". Pick one.
5. **Records:** whether ingest may append a dated checkpoint to a work item or change its `status`, or only flag it. Whether it raises work items and answers captures, or proposes them.
6. **When to create** products and organisations, as it already says for people. One name as both a vendor and its service (PayRail) needs a rule.
7. **The owner's section** is `## Notes` on most types but `## My notes` on meetings.
8. **No pronouns** unless a source uses them; use the name.
9. **A review threshold:** flag what changes a decision, a status or a date someone relies on; leave small discrepancies to the log.

### Decision

Skills on the kit types, borrowing the plugin's mechanics. Recorded in [`docs/vision.md`](../../docs/vision.md#knowledge-written-by-claude). The skill's next version starts from the list above.

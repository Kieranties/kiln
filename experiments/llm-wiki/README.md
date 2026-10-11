# Experiment: LLM-written knowledge

Status: **running** (2026-10-11). The first step of [#74](https://github.com/Kieranties/kiln/issues/74); the findings so far are in [LLM-written knowledge that reads well](../../docs/specs/2026-10-11-llm-written-knowledge.md).

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

The owner's step: it needs Obsidian and a model API key.

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

To fill in after both sides have run.

| | Claude | Plugin |
|---|---|---|
| Notes created | | |
| Notes updated | | |
| Reads better | | |
| Why | | |

Decision: plugin, skills or a mix, recorded in [`docs/vision.md`](../../docs/vision.md).

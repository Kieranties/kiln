# Test fixtures

Generated, fictional test data for kiln. **Nothing here is real.** Every organisation, person, ticket, URL and figure is invented for the fictional sports-tech platform **Northwind Arena** and its three client clubs: Kingsport FC, Harbour Athletic and Vale Rovers. The platform's services are Memberships, Ticketing, Payments and Identity. URLs use the reserved `.example` domain.

The files were produced once by a throwaway generator and are now frozen. Edit them by hand if they need to change, then re-run `npx vitest run tests/unit/fixtures.test.ts`.

## Layout

```
tests/fixtures/
  base/                  a kiln base (spec §4 layout), about 100 notes
    anchors/{organisation,product,service,person,topic}/
    projects/
    work/2026/
    decisions/2026/      named "<decided_on> <title>.md"
    references/
    sources/{jira,meeting}/   triaged sources (triage: linked), named "<captured date> <title>.md"
  golden.json            retrieval questions (added separately; see below)
  day/
    captures/*.md        12 pending sources: one simulated day of captures
    answer-key.json      the expected triage outcome for each capture
  denylist.txt           local only, never committed (see below)
```

### What is in `base/`

- Organisation anchors: Northwind Arena (`role: self`) and the three clubs (`role: client`).
- Service, product, topic and person anchors. People carry nicknames as `aliases`.
- 3 projects, about 20 work items (all five kinds, every status), about 15 decisions, about 10 references.
- About 20 triaged meeting and Jira sources. The knowledge notes cite them in `sources`, and each source's `linked_to` points back.
- Three supersession chains, linked both ways with `supersedes` / `superseded_by`:
  - the event bus;
  - the Fan App session and refresh-token lifetime (three decisions);
  - the renewal payment retry policy.

Every typed knowledge note carries `summary`, `aliases`, `sources` and `confidence`, and every `[[link]]` resolves. So `validate` reports no findings on the base.

Facts are spread across notes on purpose, as they would be in a real vault. For example, an incident names a client, the client anchor names its account manager, and a decision explains the cause of a bug.

## How the fixtures are used

- **`tests/unit/fixtures.test.ts`** checks the fixtures themselves:
  - the base validates cleanly (run on a temp copy, because opening the index writes `.kiln/`);
  - every golden path exists;
  - the answer key covers every capture;
  - the fixtures contain no denylisted names.
- **`golden.json`** (`{ questions: [{ id, category, question, primary, secondary }] }`, with paths relative to `base/`) feeds the retrieval regression. It has 4 questions in each category: `exact_term`, `vocab_mismatch`, `decision_temporal`, `multi_hop` and `resume_status`. It reports recall@5 and MRR per category. The questions are written separately from the base, by an author who has not read `day/`.
- **`base/`** also seeds the scale benchmark, which recombines its paragraphs into a much larger base.
- **`day/`** scores the `triage` skill:
  1. Copy `base/` to a temp base.
  2. Put each capture in `sources/<kind>/` of that base.
  3. Run triage in a Claude session.
  4. Score each capture's recorded `triage_outcome` and `linked_to` against `answer-key.json`.

### `day/answer-key.json`

`{ captures: [{ file, expected_outcome, targets }] }`:
- `file` is the capture's file name in `day/captures/`.
- `expected_outcome` is one of the `TRIAGE_OUTCOMES` in `src/schema.ts`.
- `targets` depends on the outcome:
  - **Outcomes that land on an existing note** (`update-work-item`, `supersede`, `link-to-anchor`, `duplicate-of`): base-relative paths of those notes, the main one first. For `supersede`, the target is the decision being replaced.
  - **Outcomes that create a note:** a description in the form `new <type>[/<kind>]: <what it is>`.
  - **`dismiss`:** empty.

The captures include realistic noise and are written so that each one has a single defensible outcome.

## `denylist.txt` (local only)

`tests/fixtures/denylist.txt` lists real names from the owner's organisation: people, clients, products and systems. The list is in `.gitignore` and must never be committed. Put one term per line. Blank lines and lines starting with `#` are ignored, and matching is a case-insensitive substring match.

When the file exists, the fixtures test scans every file under `tests/fixtures/` and fails on any match. When it is absent, that test is skipped with a message saying so.

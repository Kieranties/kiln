# Test fixtures

Fictional test data for kiln. **Nothing here is real.** Every organisation, person, ticket, URL and figure is invented for the fictional sports-tech platform **Northwind Arena** and its client clubs (Kingsport FC, Harbour Athletic and Vale Rovers). URLs use the reserved `.example` domain.

## `layer1/`

The Northwind Arena sample vault: one project, *Season Ticket Renewals 2027*, with a note of every type around it, in the kit's folders. [Try the sample](../../kit/TRY-THE-SAMPLE.md) loads it into a trial vault. `tests/kit/examples.test.ts` checks every note against the kit's type definitions.

## `sources/`

Raw sources for the [LLM-written knowledge experiment](../../experiments/llm-wiki/README.md): what an ingest reads, not notes. A standup transcript, a Slack-style thread, a GitHub issue, a vendor's PDF and an onboarding doc, all about the same Northwind Arena renewals as `layer1/`. They are written to test an ingest: one contradicts the sample's decision, two name people with no note yet, and one gives Vale Rovers new aliases. Never edit them; an ingest must leave them byte for byte.

## `denylist.txt` (local only)

`tests/fixtures/denylist.txt` lists real names from the owner's organisation: people, clients, products and systems. It is in `.gitignore` and must never be committed. Put one term per line; blank lines and lines starting with `#` are ignored, and matching is a case-insensitive substring match.

When the file exists, `tests/kit/examples.test.ts` fails if any term appears in `kit/`, the sample, `docs/`, the README, `CLAUDE.md` or this file. When it is absent, the check is skipped with a message.

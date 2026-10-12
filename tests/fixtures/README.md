# Test fixtures

Fictional test data for kiln. **Nothing here is real.** Every organisation, person, ticket, URL and figure is invented for the fictional sports-tech platform **Northwind Arena** and its client clubs (Kingsport FC, Harbour Athletic and Vale Rovers). URLs use the reserved `.example` domain.

## `layer1/`

The Northwind Arena sample vault: one project, *Season Ticket Renewals 2027*, with a note of every type around it, in the blueprint's folders. [Try the sample](../../claude-plugin/blueprint/TRY-THE-SAMPLE.md) loads it into a trial vault. `tests/kit/examples.test.ts` checks every note against the blueprint's type definitions.

## `denylist.txt` (local only)

`tests/fixtures/denylist.txt` lists real names from the owner's organisation: people, clients, products and systems. It is in `.gitignore` and must never be committed. Put one term per line; blank lines and lines starting with `#` are ignored, and matching is a case-insensitive substring match.

When the file exists, `tests/kit/examples.test.ts` fails if any term appears in `claude-plugin/`, the catalog, the sample, `docs/`, the README, `CLAUDE.md` or this file. When it is absent, the check is skipped with a message.

## `check/`

Broken notes for the note check, at their vault paths. `tests/check/` lays them over a copy of the sample. Each breaks the rules its test names.

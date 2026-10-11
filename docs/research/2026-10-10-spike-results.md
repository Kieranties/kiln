# Spike results: scale, mdbase, retrieval, embeddings, structure

Date: 2026-10-10 · Status: **exploration evidence, nothing decided** · Companion to [the landscape review](2026-10-10-knowledge-landscape.md)

All spikes were throwaway and ran in `D:\tmp\kiln-spike`. The test machine is an Intel Core Ultra 9 285K (24 cores), 128 GB RAM and a Dev Drive, with the files already in the OS cache. The real vault was only ever read.

## Summary

| # | Spike | Headline |
|---|---|---|
| 1 | Synthetic 100k-note scale | A derived **SQLite + FTS5 index is ample at 100k notes**: ~16 s cold build, 0.54 s no-change reconcile, structured queries under 1 ms, ranked search ~14 ms p50 and ~50 ms p95. **`@parcel/watcher` caught 100%** of 12k changes. Node `fs.watch` silently dropped ~40%, and chokidar collapsed. |
| 2 | mdbase on Windows | The native CLI runs without Rust. Typing, placement, **revision guard** and rename all work. But **writes reformat frontmatter they didn't touch**, every query scans the whole collection (6-20 s at 100k), and there is no ranked search and no MCP. Treat it as a design reference, not the engine. |
| 3 | Golden-set retrieval (189 real notes, 40 questions) | **Plain BM25 (stemming, OR query) is a strong baseline**: recall@5 0.84, MRR 0.81. It **beat Basic Memory's hybrid search** (0.72, 0.69), and by a wide margin on reworded questions (0.83 vs 0.38). Write-time enrichment raises recall@10 (0.88 → 0.94) but not ranking. |
| 4 | CPU embeddings | 100k notes is roughly **1-3 hours** for a first build: bge-small q8 in Node takes about 63 min, fp32 about 1.75 h. Daily top-ups take seconds. **Thread count is the lever, not batch size** (batch 1-2 with 16 threads is best). Basic Memory runs about 10× below what this CPU can do. |
| 5 | Distilled structure vs raw (blind LLM judge) | At 189 notes, answer quality is **level** (37 vs 36 out of 40). Distilled sets need **2.7× less reading**, mark superseded decisions so nothing points to a stale answer, and contained 0 factual errors (4 minor overstatements). It cost ~940k tokens to distil 189 notes, and parallel writers produced duplicate notes. |

## Spike 1: 100k-note synthetic base

The corpus is 100,000 files (399 MB), generated from paragraphs of the real notes, with kiln's draft layout and frontmatter. Generation took 4.7 s.

| Index operation (Python sqlite3, FTS5 porter, 16 parse processes, single writer) | Result |
|---|---|
| Cold build | 16 s (1 process: 28.6 s). DB is 770 MB; **310 MB with contentless FTS5** |
| Reconcile, nothing changed (stat scan) | 0.54 s |
| Reconcile, 1,000 changed | 1.7 s |
| Reconcile, ~73k changed | 31 s. Above roughly 30% churn, rebuilding fresh is faster |
| BM25 top-20 | p50 14 ms, p95 50 ms |
| Structured (`type=work AND status=active AND anchor=X`), backlinks | ~0.8 ms p50 |
| ripgrep across 100k files | 0.3 s per search: fast enough, but no ranking, filters or links |

| Watcher, 10k rewrites + 1k renames | Events received | Notes |
|---|---|---|
| **@parcel/watcher 2.6** | 10,000 / 10,000, all renames | ~80 MB RSS. Renames arrive as delete + create, so kiln must pair them (by id or hash) |
| Node `fs.watch` recursive | ~58% | Silent loss |
| chokidar 5 | collapsed | 93 s to become ready, ~1 GB RAM, slowed the writer ~90× |

Obsidian was not run. To measure cold start and a Bases view yourself, follow the steps in `bench/obsidian/` (open `bench/synth` as a vault).

## Spike 2: mdbase

- **Install:** official native binary, mdbase-connect `v0.1.0-beta.126` (engine 0.4.0-rc.6), run in direct mode. The npm TS library only implements spec v0.2, and it **silently passes** v0.3 collections.
- **Works:**
  - JSON Schema validation
  - CEL queries, including backlinks
  - deterministic placement with an auto ULID and timestamps
  - `--if-revision`, which rejects stale writes
  - rename that rewrites links and skips links inside code
  - clean JSON watch events
- **Breaks:**
  - **Writes reformat frontmatter they didn't need to change**: comments dropped, values re-quoted, flow lists turned into block lists. Renaming one person rewrote 11 real files.
  - Placement can't derive a year or slug.
  - A path collision fails instead of adding a suffix.
  - Some validation gaps.
- **Scale (100k):** every query scans the whole collection. Validate takes 13.8 s and 1.8 GB; anchor queries take 12-20 s. `cache rebuild` produced no cache.
- **Coverage of kiln's server:** about 40%, covering only the write semantics.
- **Verdict:** borrow its revision-guard semantics, type-file format and watch event shape; don't adopt it.

## Spike 3: golden-set retrieval (189 real notes)

The golden set has 40 questions across five categories: exact-term 8, vocabulary mismatch 12, decision/temporal 7, multi-hop 7, resume/status 6. A separate agent wrote them; it never saw the enrichment. A further 189 notes were enriched by three agents (summary, aliases, keywords, questions) that never saw the questions.

| Variant | recall@5 | recall@10 | MRR | Vocab mismatch r@5 / r@10 |
|---|---|---|---|---|
| FTS5 plain (title 5, body 1) | 0.84 | 0.88 | **0.81** | 0.83 / 0.83 |
| FTS5 + enrichment | 0.85 | **0.94** | 0.77 | 0.83 / 0.96 |
| FTS5 + enrichment + generated questions | 0.86 | **0.94** | 0.77 | 0.88 / 0.96 |
| Best tuned field weights | 0.86-0.88 | 0.91-0.94 | 0.79-0.81 | 0.83-0.88 |
| Basic Memory hybrid | 0.72 | 0.91 | 0.69 | 0.38 / 0.88 |

- **Correction to the first spike:** the "past due" question is found at rank 1 by plain BM25. It failed earlier because of how those engines handled the query, not because of vocabulary mismatch.
- **Enrichment** helps recall@10, which is what matters when Claude reads the top hits. Ranking only holds up if keyword fields get a low weight.
- **Cost:** about 400k tokens to enrich 78 notes.
- **Caveats:**
  - Small corpus.
  - 1 question ≈ 2.5 points.
  - Claude wrote both the questions and the enrichment, so phrasing may correlate.

## Spike 4: CPU embeddings

Test sample: 3,000 chunks of about 353 tokens, roughly 2.7 chunks per note, which projects to about 274k chunks for 100k notes.

| Setup | Chunks/s | 100k-note build |
|---|---|---|
| transformers.js + onnxruntime-node, bge-small **q8**, batch 1, 16 threads | 72 | ~63 min |
| fastembed or transformers.js, bge-small fp32, batch 1, 16 threads | 44 | ~1.75 h |
| Basic Memory-like settings (batch 2, default threads) | 25 | ~3 h |
| nomic-embed-text v1.5 | 6-10 | ~7.5 h |

- Larger batches are slower and use much more memory. 24 threads is worse than 16.
- Embedding only the curated notes (not `sources/`) takes about a third of the time.

## Spike 5: does distilled structure help?

**Method**
- Three agents distilled the 189 raw notes into kiln's shape, producing 219 notes: 97 anchors (75 of them people), 6 projects, 75 decisions with `supersedes`/`superseded_by`, and 41 work items. Every distilled note carries provenance links back to its raw sources.
- Search ran over raw plus distilled notes, using a type and status boost or anchor-first ordering.
- Provenance scoring gave 1.00 recall on the structure questions. That is an **upper bound**, because broad anchors cite up to 32 sources.
- A **blind judge** therefore scored the top-5 answerability of raw-only versus raw+distilled on 20 structure-sensitive questions, with A/B labels shuffled.

| Blind judge | Raw only | Raw + distilled (anchor-first) |
|---|---|---|
| Answer quality (/40) | 36 | **37** |
| Characters to read for the top 5 (20 questions) | ~1.12M | **~0.41M** |
| Misleading or outdated sets | present (e.g. a stale "stuck users" count) | none |
| Factual errors in distilled notes | n/a | **0** (4 overstatements, such as a plan worded as if it were done) |

**Findings**
- Distillation surfaced a correction the raw notes buried: a July "critical gap" was disproved in August. The distilled anchor was more current than the golden answer itself.
- Where distilled notes lost points, a detail was **missing**, not wrong ("several items remain open" with no list). Open items should be carried through verbatim.
- **Costs and risks:**
  - about 940k tokens to distil 189 notes (~5k per note)
  - ~8 duplicate decisions and work items from parallel writers, which is evidence for a single writer that deduplicates
  - first-name and person conflation, which agents flagged as `confidence: inferred`
- **Tested in B1 (below):** at 100k notes, structure's advantage grows sharply.

## Follow-up B1: structure at 100k notes

Setup: the 189 raw notes and 219 distilled notes were mixed into the 100k synthetic base, and the 40 golden questions were re-run. Each index built in ~9 s (~650 MB, non-contentless). Correction: the spike 5 script ranked only the first 200 matches without ordering them. Corrected 189-note figures for anchor-first are recall@5 0.95 (not 0.99); conclusions unchanged.

| recall@5 | raw only (189 → 100k) | raw + distilled, boosted (100k) | anchor-first (189 → 100k) |
|---|---|---|---|
| decision / temporal | 0.86 → **0.14** | 0.93 | 1.00 → **1.00** |
| resume / status | 0.83 → **0.25** | 0.67 | 1.00 → **1.00** |
| multi-hop | 0.79 → 0.21 | 0.71 | 0.86 → 0.79 |
| vocabulary mismatch | 0.83 → **0.00** | 0.29 | 0.92 → 0.46 |
| exact term | 0.88 → 0.31 | 0.50 | 1.00 → 0.63 |
| all 40 | 0.84 → 0.16 | 0.58 | 0.95 → **0.73** |

- Average synthetic distractors in the top 5: raw 4.7, boosted 3.3, anchor-first 2.3.
- **Findings:**
  - At scale, anchor-first structure keeps every decision and status question answerable, while plain search collapses.
  - The remaining weakness is questions whose wording matches no anchor name or alias. That is where enrichment, alias coverage and possibly vectors earn their place.
- **Caveats:**
  - The distractors are harsher than a real vault: every synthetic note is recombined from the same 189 notes, so all are on-topic.
  - Ranked OR-queries averaged ~300 ms at 100k, against 14 ms for spike 1's simpler queries, so this is worth optimising.
  - A blind judge was skipped because path prefixes would reveal which variant is which.

## Follow-up B3: weekly inbox cost (triage and distillation)

**Setup**
- An agent wrote a plausible simulated week (Mon 5 - Fri 9 Oct) of 60 captures continuing the real work. The mix: Jira 20, Slack 12, meetings 8, GitHub 6, email 6, ad-hoc 8.
- Deliberate test cases: 7 supersessions, 4 duplicates, 7 new work items, 15 pieces of noise, 4 new people.
- A hidden answer key held the expected outcomes.
- Two runs processed the week:
  - **triage-only**: decide an outcome and targets, no edits;
  - **full**: triage, then apply the changes to a copy of the 219-note distilled base.

| | Triage only | Triage + distil |
|---|---|---|
| Outcome matches answer key | 58/60 (97%) | 58/60 (97%) |
| Expected target notes touched (mean coverage) | 65% | 75% |
| Tokens (whole week) | ~160k | ~332k |
| **Tokens per capture** | **~2.7k** | **~5.5k** |
| Wall time | ~4 min | ~19 min |
| Knowledge changes | none | 28 notes created, 46 modified, 10 decisions superseded, 9 anchors and 3 projects rewritten to current truth |
| Edit footprint on modified notes | n/a | median 6 lines rewritten, max 12 (small, local edits) |

**Findings**
- Accuracy is high, and both runs flagged the right things for human review: borderline dismissals, partial supersessions, and the existing duplicate notes that should be merged.
- Incremental distillation costs **about 5.5k tokens per capture**: ~330k a week at 60 captures, or ~65k a day.
- Triage-only is half that. It is a natural "light" mode that defers distillation to the weekly review.

**Caveats**
- The same model family wrote the scenario and the key, so the signals in the captures are probably cleaner than real life.
- The full run once diffed a single original file (an isolation slip). It is unlikely to have mattered.

## Follow-up B2: Obsidian on the 100k synthetic vault (manual, measured by the owner)

| Test | Result |
|---|---|
| First index of the vault (cold) | just over 1 minute; all 100,000 files in the metadata cache |
| Reopen the vault | a few seconds |
| Bases view (`kiln-active-work.base`) | first render ~1 s; sorting by `updated` slightly slower |
| Ctrl+Shift+F "renewal" | ~10 s, 214,530 matches (worst case: the term is in most synthetic notes) |

**Finding:** Obsidian is a workable viewer at 100k notes on this machine. Its search is slow for very common terms, but kiln's own index serves search.

**Layout implications:**
- One vault per knowledge base.
- Source snapshots may stay in the vault, optionally hidden from Obsidian search to keep it uncluttered.
- No need to move high-volume material out of the vault.

## Implications (for discussion, not decided)

1. **Build a small, purpose-built index:**
   - SQLite + contentless FTS5
   - frontmatter and link tables
   - parallel parse with a single writer
   - `@parcel/watcher` as a hint stream, plus a periodic stat-scan reconcile
   - a full rebuild on heavy churn

   It is ample at 100k notes. No existing engine (Basic Memory, QMD, mdbase) beat this on quality, scale or format fidelity.
2. **Byte-preserving writes are a hard requirement.** Both Basic Memory and mdbase reformat untouched frontmatter. kiln's writer must patch only the fields it changes.
3. **Retrieval order:**
   - structured lookup and anchor-first
   - then BM25 over a weighted title, aliases and summary
   - then Claude reads the top hits

   Enrichment adds recall. Vectors are an optional layer that can lag behind (a 1-3 h first build, q8 bge-small in Node, 16 threads).
4. **Structure's value is currency and cost more than findability.** It gives an unambiguous latest decision, 2.7× less to read, and surfaced corrections. It costs real tokens and needs single-writer deduplication, provenance, confidence, and verbatim open items.
5. **Next evidence worth getting:**
   - re-run the golden and judge tests with the distilled notes mixed into the 100k synthetic base, to see whether structure's lead grows with noise
   - measure Obsidian on `bench/synth`
   - estimate the ongoing token cost of distilling the inbox per day/week instead of in bulk

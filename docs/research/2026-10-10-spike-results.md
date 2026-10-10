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
| 5 | Distilled structure vs raw (blind LLM judge) | Answer quality is **level** (37 vs 36 out of 40). Distilled sets need **2.7× less reading**, mark superseded decisions so nothing points to a stale answer, and contained 0 factual errors (4 minor overstatements). It cost ~940k tokens to distil 189 notes, and parallel writers produced duplicate notes. |

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
| Misleading or outdated sets | present (e.g. stale LFC "stuck users" count) | none |
| Factual errors in distilled notes | n/a | **0** (4 overstatements, such as a plan worded as if it were done) |

**Findings**
- Distillation surfaced a correction the raw notes buried: a July "critical gap" was disproved in August. The distilled anchor was more current than the golden answer itself.
- Where distilled notes lost points, a detail was **missing**, not wrong ("several items remain open" with no list). Open items should be carried through verbatim.
- **Costs and risks:**
  - about 940k tokens to distil 189 notes (~5k per note)
  - ~8 duplicate decisions and work items from parallel writers, which is evidence for a single writer that deduplicates
  - first-name and person conflation, which agents flagged as `confidence: inferred`
- **Untested:** whether structure's advantage grows at 100k notes, where raw retrieval gets noisier.

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

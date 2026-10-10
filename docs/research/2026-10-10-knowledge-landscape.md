# Knowledge capture and querying: landscape review

Date: 2026-10-10 · Status: **exploration, nothing decided**

Inputs: a hands-on spike (Basic Memory 0.22 and QMD against 189 real vault notes) and five parallel research tracks: agent memory layers, PKM apps vs Obsidian, retrieval approaches, capture and prior art, and markdown-as-database engines. Claims marked *(agent-reported)* come from the research agents and I have not checked them myself. Two load-bearing sources I did verify directly: [BM25 Wins at Scale (arXiv 2607.26497)](https://arxiv.org/abs/2607.26497) and the [mdbase spec](https://github.com/mdbase-dev/mdbase-spec).

Planning scale: **tens of thousands growing to 50-100k+ notes** across several bases, with meetings, references and source snapshots dominating volume.

---

## 1. Your questions, answered

### Are there alternatives to Basic Memory?

Plenty, and they fall into two groups. Neither group can replace the knowledge store; both are useful patterns or optional derived layers.

| Group | Examples | What they are good at | Why not the core |
|---|---|---|---|
| **Agent memory layers** (DB-backed) | Graphiti (Apache-2.0), Hindsight (MIT), Cognee (Apache-2.0), mcp-memory-service, Mem0, MemPalace, Letta | Facts over time ("what did we decide, and when did that change"), standing queries, isolated banks | Data lives in Postgres, graph or vector DBs, so you can't read or edit it in Obsidian. Most run **LLM extraction on every write** (Graphiti estimated at 6-10 calls per episode *(agent-reported)*), which is unaffordable across 100k notes on this machine |
| **Markdown-native engines** | **mdbase** (spec plus Rust/TS engines), zk, MarkdownDB, Basic Memory, MCPVault | Typed markdown, queries, MCP over files | Maturity and fit vary; see section 3 |

The one that matters most is **mdbase**. It is an open spec for *typed markdown collections* and covers roughly 70-80% of what we had planned to build ourselves *(agent-reported estimate)*:
- JSON Schema per type
- deterministic path placement
- **revision-guarded writes** (`if_revision`)
- link-preserving renames
- atomic batches
- CEL queries and saved views
- watch events
- an **Obsidian Bases adapter**

The catches: it is pre-1.0 (v0.3.0-rc), effectively has one maintainer, has no published benchmarks beyond 5k records, has no local stdio MCP, and its full-text search is unclear.

### Should Obsidian content be the searchable corpus?

**The markdown files should be the corpus, but Obsidian should not be the search engine.** Every research track converged on this:
- Markdown files are the truth and the corpus. They are portable, readable, diffable, and have no lock-in.
- A **derived, rebuildable index that we own** (SQLite: frontmatter columns, a link table, FTS5, optional vectors) is the query engine.
- Obsidian's own index lives inside the app, so it is unavailable whenever Obsidian is closed.
- At 50-100k notes it strains: Bases and Dataview scan the whole vault, graph view crashes, and folder moves lock the app for minutes *(forum anecdotes, agent-reported)*.

A separate database as the truth only wins for high-churn *operational* records (thousands of status flips) or multi-writer concurrency. Even then the hybrid is tables for records, projected to markdown for viewing.

### Is Obsidian the right tool?

**Yes as the viewer and cockpit. No as the engine.**
- **Strengths:**
  - best-in-class editing and linking over plain files
  - Bases views straight from frontmatter
  - free for work
  - an official CLI (1.12+) with `base:query`, for when the app is open
- **Limits:**
  - every programmatic path needs the GUI running, and headless mode only covers sync (paid)
  - the core is closed source
  - it is weak at 50k+ notes, and weak on mobile at that size
- **Alternatives:** none beats "files plus our own index" on lock-in, scale headroom and git history. *(agent-reported)*
  - **Anytype** has the best typed object model, an official MCP and a headless CLI, but the store is opaque and encrypted, and users report lag at ~3k objects.
  - **Tana** has the best agent API, but it is cloud-only.
  - **Logseq DB** is beta, with data-loss warnings. Revisit in 2027.
  - **SiYuan** offers SQL, but in a proprietary format.
- **Complements worth trying alongside Obsidian:** **Memos** (built-in MCP, Docker) as a mobile capture inbox, and **SilverBullet** as a phone-friendly web view over the same files.

---

## 2. Where the evidence converges

1. **Markdown as truth with a derived index is the only option backed by scale evidence.** No PKM app has credible evidence of working comfortably at 100k notes. A purpose-built SQLite index over files does.
2. **Structure beats search engine choice.** In the spike, every engine failed the "past due" question. The research agrees:
   - anchor-first lookup (resolve the entity, follow typed links, filter by type, status and date) scales with an anchor's link count, not with corpus size
   - Resume and Start are mostly *structured* queries, not ranked search
3. **Agentic grep has an expiry date.** The verified paper finds a file-system agent leads only on small corpora, at 39× the query tokens. BM25 overtakes it at around **10M corpus tokens (roughly 10-15k notes)** and leads by ~20 points at full scale. Agent reasoning works best *after* ranked discovery, not instead of it.
4. **Fix vocabulary mismatch at write time, not with heavier search.** At capture, Claude adds a plain-language `summary`, `aliases` and `keywords` that mix business and technical terms. This is the doc2query / contextual-retrieval family. Anthropic reports contextual BM25 cuts retrieval failures by about 49% *(agent-reported)*. It is cheap, needs no GPU, and directly targets the failing question.
5. **Vectors are a later, measured addition.** Use small ONNX models (bge-small via fastembed) in sqlite-vec, embedding summaries and anchors first. Not llama.cpp: QMD was impractical on this CPU. Our spike's embedding throughput needs diagnosing before scaling (at the observed rate, 100k notes would take ~17 hours).
6. **Graph RAG is not worth it here.** LLM graph construction is unaffordable locally, and the claimed wins reverse under fair evaluation *(agent-reported)*. Our human-curated wikilinks are a cheaper, more accurate graph.
7. **Keep raw sources and synthesis separate.** This is the Karpathy "LLM Wiki" pattern (raw sources the agent never edits, a maintained wiki layer, and a schema file, with *ingest / query / lint* as the core operations). It maps closely onto kiln's sources layer, anchors and distillation.
8. **Agent writes need guard rails.** Prior art hit hallucinated summaries and clobbered edits. The mitigations that recur:
   - transactional writes and revision checks
   - `confidence` and provenance on synthesised claims
   - a git commit per agent operation
   - no deletes without approval
   - session-end writeback based on the *actual diff*, not the agent's recollection
9. **Capture fails through overload, not lack of capture.** The collector's fallacy and unprocessed inboxes are the top reasons these systems get abandoned. Counter-measures:
   - pointer-only cards
   - narrow watcher rules (assigned, mentioned, review-requested only)
   - manual captures prioritised over automatic ones
   - **auto-expiry** of untriaged cards
   - agent-proposed batch triage
   - a **weekly review**
10. **Meetings and snapshots will dominate volume.** Keep summaries, decisions and actions plus a pointer to the transcript, and store high-volume material outside, or excluded from, the Obsidian vault.

---

## 3. Build vs compose (the KB core)

| Responsibility | Existing option | Current lean |
|---|---|---|
| Schema validation | mdbase (JSON Schema per type), Zod with JSON Schema export, Ajv | Compose |
| Deterministic placement | mdbase path patterns | Compose, or a small function |
| Revision-guarded writes | mdbase `if_revision`; hash-precondition pattern from obsidian-native-mcp and claude-obsidian | Compose, or about 50 lines of our own |
| Frontmatter + links + full-text index | Partly mdbase-rs (FTS unclear), zk (FTS and links, no frontmatter queries), Basic Memory | Own SQLite FTS5 index, unless mdbase gains FTS |
| File watching | `@parcel/watcher`, Rust `notify`, mdbase watcher | Compose, **plus a reconciliation scan**, because Windows watchers drop events under bulk change |
| Soft delete / archive, event log | Nothing found does this | Our own |
| MCP + HTTP surface | Official MCP SDK | Our own thin layer |
| Human views | Obsidian Bases (plus CLI `base:query` when open) | Compose |
| Optional semantic / temporal layers | sqlite-vec + fastembed; Graphiti for a curated decisions subset; Cognee (keyless extraction) | Defer until measured need |

**Two credible compositions to explore:**

- **A. mdbase-first.** Adopt mdbase's file layout and types, and wrap its engine behind a small local MCP and HTTP server. Add an FTS5 sidecar fed by watch events, soft-delete and the event log. *Least code. The risk is a pre-1.0 spec with one maintainer.*
- **B. Own engine with mdbase-compatible semantics and files.** Use TypeScript with Zod/JSON Schema, gray-matter and remark, better-sqlite3 with FTS5, and `@parcel/watcher` with reconciliation. Keep files mdbase-compatible so its CLI, LSP and validation tools can be used later. *More control and less dependency risk. More to build.*

Either way, **adopting mdbase's semantics is cheap insurance**, even if we never adopt its code.

---

## 4. Implications for kiln (proposals, not decisions)

- **Retrieval layers**, each added only when measured misses justify it:
  - L0: structured lookup (`resolve`, `query` by type, status, date and links) plus BM25 with field and type weights. The agent reads and greps the top hits.
  - L1: write-time enrichment (`summary`, `aliases`, `keywords`), a backfill of existing notes, and a down-weighted snapshot tier.
  - L2: ONNX vectors fused with BM25, starting with summaries and anchors.
  - L3: per-anchor maintained summaries and weekly rollups for Resume.
  - L4: a reranker, LanceDB or Tantivy, or link-graph PageRank, only at very large scale.
- **Measure before adding layers.** Build a golden question set (40 questions now, 150+ later) tagged by category: exact term, vocabulary mismatch, latest decision, multi-hop, resume. Score recall@5/10 and MRR (with `ranx`), and grow the set from real misses.
- **Schema additions to consider:**
  - `summary`, `aliases`, `keywords`
  - `confidence` and provenance links on synthesised content
  - decision fields: `supersedes`, `superseded_by`, `decided_on` (Graphiti's "invalidate, don't delete" without the engine)
  - `last_verified` / `review_after` on anchors
- **Storage hygiene for scale:**
  - one vault per base
  - stable ids, flat-ish folders, never mass-move
  - high-volume sources and snapshots in an excluded folder or a separate store
  - keep vaults off OneDrive, and exclude them from Defender on the Dev Drive
- **Capture contract:**
  - pointer cards: `source`, `external_id`, `dedupe_key`, `url`, `title`, `captured_by`, `why`, `snippet`, `status`, `expires`
  - feeders are swappable: staged from Claude sweeps → n8n (or Activepieces) once a source proves noisy or expensive
  - **poll, don't webhook**, so nothing has to be exposed to the internet
- **New operations to consider:**
  - **lint**: deterministic over everything, semantic only on recently changed neighbourhoods
  - **weekly review**, as part of Resume
  - **harvest**: diff-based session-end writeback
- **Ideas to borrow:**
  - Hindsight's *standing queries*: "open work for client X" as a regenerated view
  - Graphiti's *sagas*: rolling thread summaries
  - Backlog.md's *MCP resources as instructions*
  - Beads' *ready/next* query

---

## 5. Suggested next spikes (each throwaway, each measurable)

1. **Scale benchmark.** Generate a synthetic 100k-note base on Z:. Measure the FTS5 index rebuild and incremental reconcile, watcher behaviour under bulk change, and Obsidian cold start plus `base:query`.
2. **mdbase on Windows.** Run mdbase-rs and the CLI against the 189-note copy: validate, query, revision-guarded update, rename. Then run it at 100k from spike 1.
3. **Golden set plus enrichment test.** Write 40 real questions, then compare plain FTS5, FTS5 with Claude-written summaries and aliases, and Basic Memory's hybrid search. This tests the "enrichment beats vectors" claim on your own notes.
4. **Embedding throughput diagnosis.** Check fastembed bge-small batch and thread settings on this CPU, to know whether L2 is minutes or hours at 100k notes.

---

## 6. Unverified or weak evidence

- Every scale figure for Obsidian, Anytype, SilverBullet and Trilium is a forum anecdote. No official benchmarks exist.
- FTS5 at 100k+ documents and ripgrep timings at 100k files were not benchmarked.
- The following came from the research agents and were not checked by me:
  - mdbase's FTS support, Windows support and scale
  - Graphiti's per-episode call count
  - Hindsight's local reranker and Markdown export
  - Cognee's offline quality
  - the Contextual Retrieval percentages
  - the PwC "Is Grep All You Need?" results
- CPU embedding throughput figures in the literature conflict, by more than 10×.

## Key sources

- [BM25 Wins at Scale (arXiv 2607.26497)](https://arxiv.org/abs/2607.26497) (verified)
- [mdbase spec](https://github.com/mdbase-dev/mdbase-spec) (verified)
- [Anthropic: Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [Karpathy: LLM Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian)
- [Obsidian CLI](https://obsidian.md/help/cli)
- [Obsidian headless sync](https://obsidian.md/help/sync/headless)
- [Obsidian forum: large vaults](https://forum.obsidian.md/t/can-obsidian-handle-100s-of-thousands-of-notes/112785)
- [Graphiti](https://github.com/getzep/graphiti)
- [Hindsight](https://github.com/vectorize-io/hindsight)
- [Cognee](https://github.com/topoteretes/cognee)
- [mcp-memory-service](https://github.com/doobidoo/mcp-memory-service)
- [Anytype MCP](https://github.com/anyproto/anytype-mcp)
- [Memos MCP](https://www.usememos.com/docs/integrations/mcp)
- [zk](https://github.com/zk-org/zk)
- [MarkdownDB](https://github.com/flowershow/markdowndb)
- [Backlog.md](https://github.com/MrLesk/Backlog.md)
- [n8n MCP Server Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcptrigger/)
- [Basic Memory](https://www.mintlify.com/basicmachines-co/basic-memory/concepts/how-it-works)
- [QMD](https://github.com/tobi/qmd)

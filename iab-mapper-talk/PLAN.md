# 🧭 Talk Title:

**From Taxonomies to Intelligence — How the IAB Mapper Powers Multimodal Understanding**

---

## 0. Opening (2 min)

**Goal:** Context + hook.
**Slide:** IAB Taxonomy Mapper logo + Mixpeek logo side by side.

* Quick welcome & gratitude to the IAB Tech Lab team
* One-liner: "We built a standalone IAB taxonomy mapper that makes semantic content classification accessible to everyone—and Mixpeek extends it from text-only to images and video."
* Audience question: "How many of you have wrestled with category mapping before?" → raise hands

---

## 1. Why Taxonomies Still Matter (3 min)

**Slide:** Old IAB 2.x tree vs. modern contextual signals diagram.

* Contextual data is replacing cookies — relevance through content, not identity
* IAB taxonomies are the lingua franca of contextual data
* But they’re static → AI makes them *semantic*
* Transition: “Let’s see what happens when we teach machines to read a taxonomy.”

---

## 2. The IAB Mapper Demo (7 min)

**Slide / Live demo:** [mixpeek.com/tools/iab-taxonomy-mapper](https://mixpeek.com/tools/iab-taxonomy-mapper)

**Flow:**

1. Paste a piece of text (article or ad copy)
2. Watch the mapper auto-detect category, subcategory, and confidence
3. Expand hierarchical view → show why multiple levels matter
4. Toggle between IAB 2.x → 3.0 mapping
5. Show JSON output (`category_id`, `confidence`, `hierarchy_path`)

**Interactive moment:**
Ask audience to shout a random topic (e.g., “electric bikes”) → paste into demo → live classify.

---

## 3. Under the Hood — How the Mapper Works (7 min)

**Slide:** "IAB Mapper Architecture" diagram showing Ollama → embedding → similarity search flow.

**The Mapper's Core Engine:**

* **Ollama-powered classification** — Local LLM inference using Ollama for semantic understanding
  * Text input → Ollama generates embeddings for IAB taxonomy nodes
  * Compares input text against taxonomy descriptions using semantic similarity
  * Returns best-matching categories with confidence scores
* **Standalone implementation** — The mapper is **not powered by Mixpeek**; it's an independent tool
  * Self-contained classification engine
  * Can run locally with Ollama
  * Open-source and extensible

**How it works step-by-step:**

1. Input text → Ollama generates semantic embedding
2. Taxonomy nodes (IAB categories) → Pre-computed embeddings
3. Cosine similarity search → Find closest matches
4. Hierarchical enrichment → Walk up parent chain to build full path
5. Confidence scoring → Return top matches with scores

**Show architecture diagram:** Text → Ollama → Embeddings → Similarity Search → IAB Categories

---

## 4. From Mapper to Production — Mixpeek Makes It Extensible (5 min)

**Slide:** "Mapper → Mixpeek Production Pipeline" diagram.

**Key points (visual):**

* **Mapper = First step** — Standalone tool for classification
* **Mixpeek = Production layer** — Makes it production-grade, extensible, and powerful
* **How Mixpeek enhances the mapper:**

  * **Multimodal support** — Extends text-only mapper to images and video via CLIP embeddings
  * **Scalability** — Ray-based distributed inference across CPU/GPU workers
  * **Taxonomy System integration** — Uses Mixpeek's **Taxonomy System** for enterprise-scale enrichment
  * **Production features** — Materialized enrichments, retriever pipelines, API orchestration
  
* **Execution modes (with real numbers):**

  * *On-demand* (real-time classification via Ray Serve)
    * Latency: 100-500ms per batch
    * Use: Testing, real-time enrichment, small-scale queries
  * *Materialized* (batch enrichment via Ray map_batches)
    * Throughput: 1000+ docs/min
    * Use: Production-scale enrichment, persisted to collections
    * 10-50x faster with parallel execution

**Show small snippet:** How mapper output integrates with Mixpeek taxonomy JSON config and resulting enriched document fields.

---

## 5. Building a Multimodal Taxonomy (5 min)

**Slide:** Mixpeek architecture flow (Objects → Collections → Taxonomies → Retrievers).

**Narrative:**

* Mapper works on text, but Mixpeek extends it to **images and video**
* Example:

  * Scene → "crowd cheering" → sports taxonomy node
  * Product photo → "sneakers" → fashion taxonomy node
* **Feature extractors** (Ray-based, distributed):
  * `text_extractor@v1` — multilingual-e5 embeddings (1024-1536 dims)
  * `video_extractor@v1` — CLIP scene embeddings + scene detection
  * `splade_extractor@v1` — sparse vectors for hybrid search
* **Taxonomy as JOIN stage** — internally uses the JOIN RETRIEVER pattern
  * Parallel retriever execution across taxonomy nodes
  * Hierarchical enrichment with inheritance
  * Results merge with confidence scoring
* Show quick API call (`/v1/taxonomies/enrich`) or `retriever@v1` example

**Interactive:** Ask audience which medium (text / image / video) is hardest to classify; show how multimodal embedding alignment solves it.

---

## 6. Collection Processing → Retrievers → Use Cases (5 min)

**Slide:** “From Data to Decisions” pipeline diagram.

**Concepts:**

1. **Buckets → Collections** — ingestion and feature extraction
2. **Taxonomy Enrichment** — attach contextual metadata
3. **Retrievers & Multistage Pipelines** — 6 stage categories, 15+ stage types:
   * SEARCH (semantic, sparse, hybrid, late_interaction)
   * FILTER (structured, text, LLM, custom)
   * RANK (rerank with cross-encoders, LLM scoring)
   * ENRICH (join with direct or retriever modes, taxonomy)
   * TRANSFORM (LLM generation)
   * COMPOSE (nested retrievers, external APIs)

**Live Examples:**

* *AdTech:* map creative assets → IAB categories for brand safety (100-1000 queries/sec)
* *Publishing:* auto-tag content for recommendation (1000+ docs/min batch enrichment)
* *E-commerce:* classify products → category tree for contextual ads
* *Security:* detect unsafe video scenes via taxonomy clusters (5-20 videos/sec)

**Audience prompt:** "If you could enrich any dataset with IAB tags, what would you use it for?"

---

## 7. Interactive Deep Dive (3 min)

**Idea:** Turn classification into a group experiment.

1. Split crowd: pick 3 random ad headlines (text), 1 product photo, 1 short clip.
2. Use Mapper + Mixpeek retriever API to show:

   * text → IAB category
   * image → similar categories via CLIP embedding
   * video → scene classification
3. Display confidence scores, hierarchy, and real-time enrichment.

---

## 8. Closing & Takeaways (3 min)

**Slide:** “Taxonomies are the bridge between AI and advertising context.”

**Summarize:**

* IAB Mapper = standalone, Ollama-powered classification tool (the foundation)
* Mixpeek extends it → production-grade, multimodal, scalable taxonomy system
* Taxonomies become retrievers → retrievers power contextual AI use cases
* API & Open-Source Links:

  * [mixpeek.com/tools/iab-taxonomy-mapper](https://mixpeek.com/tools/iab-taxonomy-mapper)
  * [github.com/mixpeek/iab-mapper](https://github.com/mixpeek/iab-mapper)

**Soft CTA:** "We're open-sourcing the Mapper to make contextual AI interoperable across the ad ecosystem. Mixpeek makes it production-ready."

**Final interactive:** invite questions or show one surprising classification (e.g., how ‘podcast about finance’ maps to two IAB verticals).

---

## Appendix / Backup Slides

* **Architecture diagram** — Full service stack (API Layer, Storage Layer, Engine Layer)
* **Retriever Stage Catalog** — Visual of all 15+ stage types across 6 categories
* **Feature Extractor Performance** — Benchmarks (text: 100-500 docs/sec, video: 5-20 videos/sec)
* **Taxonomy configuration examples** — JSON snippets for flat vs hierarchical taxonomies
* **Ray cluster architecture** — How distributed inference scales (CPU/GPU worker allocation)
* **JOIN stage internals** — How taxonomy system uses JOIN RETRIEVER pattern
* **Performance comparison** — On-demand (100-500ms) vs Materialized (1000+ docs/min)
* **Execution mode decision tree** — When to use Ray Serve vs Ray map_batches
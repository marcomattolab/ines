# Knowledge Manager — Local-First Knowledge Base for Edge AI

The Knowledge Manager is a feature of **INES (Intelligent Neural Edge System)** that transforms your browser into a persistent, private knowledge base powered by a Small Language Model (SLM) running entirely on-device via MediaPipe.

Unlike cloud-based knowledge management tools, INES keeps every document, chunk, query, and answer **strictly local** — no data ever leaves your machine. The SLM (e.g. Gemma 3 1B) handles retrieval-augmented generation (RAG) over your stored documents, making it ideal for sensitive or offline environments.

## Use Cases

### UC1 — Cross-Document Retrieval & Synthesis

A developer saves technical manuals, API guides, and articles in PDF/HTML over time. Months later, they ask *"How do I configure OAuth in Angular 22?"*.

1. The system searches across all stored documents using keyword scoring + TF-IDF weighing
2. It retrieves the 3–5 most relevant chunks from different documents
3. The SLM synthesises a unified answer citing exact sources
4. The user sees which documents and pages were used

**Value**: Knowledge persists across sessions. The SLM does not need to "remember" anything — context comes from the local knowledge base.

### UC2 — Project Review with Recurring Questions

A PM or developer accumulates project documentation, meeting notes, and architectural decisions. During a review they ask *"What architectural decisions were made for the auth module and why?"*

1. The system retrieves chunks from meeting notes, ADRs, and technical specs
2. It finds related chunks across multiple documents
3. The SLM answers with **source citations** (document name, date, page)
4. The knowledge graph is optionally updated with new connections

**Value**: Traceability, faster onboarding, no repeated questions.

### UC3 — Batch Import of Documents

A user has a folder of dozens of PDFs, Markdown notes, and HTML reports accumulated over years. They want to load them all at once.

1. Accepts **multi-file upload** (drag-and-drop folder or multi-select)
2. Processes each file in **queue**: parser → chunker → IndexedDB, with per-document progress
3. Shows a final **report**: documents imported, total size, chunks generated
4. **Deduplication**: skips files with matching name + hash

**Value**: One-shot population of the knowledge base without uploading files one by one.

### UC4 — Export & Import Knowledge Base

A user changes PC or wants to back up their personal knowledge base.

1. **Full export**: downloads a `.ines-knowledge` file (compressed JSON) containing all documents, chunks, saved Q&As, and graph data
2. **Selective export**: pick which documents to include via checkboxes
3. **Import from backup**: drag the `.ines-knowledge` file — the system shows a preview (document count, export date, size) and asks for confirmation
4. **Smart merge**: existing documents with matching name+hash are skipped; new ones are added

**Value**: Portability, backup, device-to-device migration without cloud dependency.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KNOWLEDGE MANAGER                            │
│                      (New tab in INES)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │  UPLOAD   │───▶│   PARSER    │───▶│     CHUNKER              │  │
│  │  (drag&   │    │ (PDF/HTML/  │    │ (256 word, 32 overlap)   │  │
│  │   drop)   │    │  TXT/MD)   │    │                          │  │
│  └──────────┘    └──────────────┘    └──────────┬───────────────┘  │
│                                                  │                  │
│                                                  ▼                  │
│                                  ┌──────────────────────────────┐   │
│                                  │     INDEXEDDB STORE          │   │
│                                  │  ┌──────────┐ ┌──────────┐  │   │
│                                  │  │Documents │ │  Chunks  │  │   │
│                                  │  │- id      │ │- docId    │  │   │
│                                  │  │- name    │ │- text     │  │   │
│                                  │  │- date    │ │- position │  │   │
│                                  │  │- type    │ │- keywords │  │   │
│                                  │  │- tags[]  │ │- hash     │  │   │
│                                  │  │- hash    │ │           │  │   │
│                                  │  │- size    │ │           │  │   │
│                                  │  └──────────┘ └──────────┘  │   │
│                                  │  ┌──────────┐ ┌──────────┐  │   │
│                                  │  │ Q&A      │ │  Graph   │  │   │
│                                  │  │- id      │ │- edges   │  │   │
│                                  │  │- question│ │- nodes   │  │   │
│                                  │  │- answer  │ │- weight  │  │   │
│                                  │  │- sources │ │          │  │   │
│                                  │  │- date    │ │          │  │   │
│                                  │  └──────────┘ └──────────┘  │   │
│                                  └──────────────────────────────┘   │
│                                                  │                  │
│                  ┌─────────────┐                 │                  │
│                  │   QUERY     │                 │                  │
│                  │   INPUT     │                 │                  │
│                  └──────┬──────┘                 │                  │
│                         │                        ▼                  │
│                  ┌──────▼──────────────────────────┐                │
│                  │         RETRIEVER               │                │
│                  │  ┌──────────────────────────┐   │                │
│                  │  │  1. Keyword scoring      │   │                │
│                  │  │  2. TF-IDF boost         │   │                │
│                  │  │  3. Position weight      │   │                │
│                  │  │  4. Multi-doc rank merge │   │                │
│                  │  └──────────────────────────┘   │                │
│                  │         │                       │                │
│                  │         ▼                       │                │
│                  │  ┌──────────────────────────┐   │                │
│                  │  │  Top-K chunks + context  │   │                │
│                  │  └──────────────────────────┘   │                │
│                  └──────────────┬──────────────────┘                │
│                                 │                                   │
│                                 ▼                                   │
│                  ┌──────────────────────────────┐                   │
│                  │      SLM (on-device)         │                   │
│                  │  buildPrompt(system + context │                   │
│                  │           + query)           │                   │
│                  │  LlmService.generate()       │                   │
│                  │  with streaming callback     │                   │
│                  └──────────────┬───────────────┘                   │
│                                 ▼                                   │
│                  ┌──────────────────────────────┐                   │
│                  │     ANSWER + SOURCES         │                   │
│                  │  "According to doc X (p.3)   │                   │
│                  │   and meeting note Y (Mar 12)│                   │
│                  │   the decision was..."       │                   │
│                  └──────────────────────────────┘                   │
│                                 │                                   │
│                                 ▼                                   │
│                  ┌──────────────────────────────┐                   │
│                  │     KNOWLEDGE GRAPH          │                   │
│                  │  Updates nodes/connections   │                   │
│                  │  between documents, Q&As,    │                   │
│                  │  concepts (Mermaid visual)   │                   │
│                  └──────────────────────────────┘                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Ingest** — File upload → format-specific parser → text chunking (256 words, 32-word overlap) → IndexedDB persistence
2. **Query** — User question → Retriever (keyword scoring + TF-IDF + position weight) → top-K chunks across all documents
3. **Synthesis** — Retrieved chunks + user query → `buildPrompt()` → `LlmService.generate()` with streaming
4. **Response** — Answer with source citations (document name, chunk position) → optionally saved to Q&A store
5. **Reuse** — Every saved Q&A pair enriches the knowledge base for future cross-referencing

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **IndexedDB** for persistence | Works offline, no size limit (except device quota), structured queries via indexes |
| **Keyword scoring + TF-IDF** instead of embeddings | No GPU needed, no vector DB, works well with SLM context windows |
| **256-word chunks with 32-word overlap** | Balances granularity with context coherence; fits SLM token budget |
| **`.ines-knowledge` export format** | Single-file portable backup, JSON compression via native `CompressionStream` |
| **No vector embeddings** | SLMs work best with direct text context; embeddings add complexity without proportional benefit for small-scale local KB |

## Relationship to Existing Features

The Knowledge Manager builds on and extends existing INES infrastructure:

| Existing Feature | How It's Used |
|-----------------|---------------|
| `LlmService` | Prompt building, streaming generation, conversation trimming |
| `RagService` (partial) | Document parsing (PDF, HTML, TXT) and chunking logic |
| `LearningTab` | Inspiration for the Q&A chat UI pattern with source citations |

The critical difference from the existing Learning tab: **persistence**. The Learning tab stores everything in-memory (lost on refresh). The Knowledge Manager stores documents, chunks, Q&As, and graph data in IndexedDB, enabling cross-session knowledge reuse.

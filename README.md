# INES — Intelligent Neural Edge System

> **Run a small language model entirely in your browser. No server. No API key. No data leaving your device.**

INES is an **Angular 22 PWA** that brings on-device AI to the browser using Google's [MediaPipe LLM Inference API](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) and WebGPU acceleration. Load a Gemma model once, and use thirteen specialized AI-powered tools — all completely offline after the initial CDN load.

---

## Table of Contents

- [Why INES](#why-ines)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Supported Models](#supported-models)
- [Getting Started](#getting-started)
- [Features](#features)
  - [Chat](#-chat)
  - [Email Assistant](#-email-assistant)
  - [Meeting Recorder](#-meeting-recorder)
  - [Translator](#-translator)
  - [Daily Planner](#-daily-planner)
  - [Coding Assistant](#-coding-assistant)
  - [DevAgent](#-devagent)
  - [Agents](#-agents)
  - [Vision](#-vision)
  - [Learning Center](#-learning-center)
  - [Knowledge Manager](#-knowledge-manager)
  - [Slides](#-slides)
  - [Project](#-project)
- [RAG Pipeline](#rag-pipeline)
- [Model Loading Internals](#model-loading-internals)
- [Prompt Architecture](#prompt-architecture)
- [Browser Requirements](#browser-requirements)
- [Privacy Guarantee](#privacy-guarantee)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Why INES

Most AI tools require a cloud API, an account, and send your data to a remote server. INES takes the opposite approach: the entire neural network runs inside your browser tab via WebAssembly and WebGPU. Your prompts, documents, meeting transcripts, and todo lists never leave your machine.

This makes INES suitable for:

- Sensitive corporate communication that cannot be sent to third-party APIs
- Air-gapped or offline environments
- Privacy-conscious personal productivity
- Learning, training, and knowledge retention with on-device RAG
- Demos and educational use of on-device AI

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          Browser Tab                             │
│                                                                  │
│  ┌──────────┐   ArrayBuffer   ┌────────────────────────────────┐ │
│  │  File    │ ──────────────► │  MediaPipe WASM Runtime        │ │
│  │  Picker  │                 │  (WebGPU accelerated)          │ │
│  └──────────┘                 │                                │ │
│                               │  Single LlmInference instance  │ │
│  ┌──────────┐                 │  (shared across all tabs)      │ │
│  │  13 Tab  │                 │                                │ │
│  │  UI      │                 │  Gemma 3 / Gemma 3n            │ │
│  │          │◄────────────────│  streaming tokens via          │ │
│  │  Chat    │  Prompt         │  generateResponse()            │ │
│  │  Email   │  + System       │                                │ │
│  │  Meeting │  Messages       └────────────────────────────────┘ │
│  │  ...     │                                                    │
│  └──────────┘                                                    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Services (DI)                                              │ │
│  │  KnowledgeManager · RagService · SpeechService              │ │
│  │  VisionService · AgentService · TodoService                 │ │
│  │  TextProcessingService (PDF/DOCX/PPTX/HTML)                 │ │
│  │  DocFetchService · MarkdownService                          │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │  Persistence                                                │ │
│  │  IndexedDB (KnowledgeBase, Documents, Chunks, QAs)          │ │
│  │  localStorage (Todo, Chat, Coding, Agent persistence)       │ │
│  │  sessionStorage (Model cache flag, theme, active tab)       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                 ▲
                 │  ES Module import (CDN, one-time)
                 │  @mediapipe/tasks-genai
```

A single `LlmInference` instance is initialized once and reused across all thirteen tabs. Each tab injects its own system prompt before the user message, effectively turning one model into thirteen specialized agents.

---

## Tech Stack

| Layer                    | Technology                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Framework**            | [Angular 22](https://angular.dev) — standalone components, Signals, `@for`/`@if` control flow                                       |
| **Styling**              | [Tailwind CSS 3](https://tailwindcss.com) + CSS custom properties + per-component CSS files                                         |
| **LLM Runtime**          | [Google MediaPipe Tasks GenAI](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) (`@mediapipe/tasks-genai`) |
| **GPU Acceleration**     | WebGPU (via browser) + WASM SIMD fallback                                                                                            |
| **Model Format**         | `.task` / `.litertlm` / `.bin` (MediaPipe-compatible)                                                                                |
| **RAG**                  | Keyword-scoring retrieval over IndexedDB-stored document chunks                                                                      |
| **PDF Parsing**          | [pdfjs-dist](https://github.com/mozilla/pdf.js) v5                                                                                   |
| **DOCX Parsing**         | [Mammoth](https://github.com/mwilliamson/mammoth.js) — DOCX → plain text                                                             |
| **PPTX Parsing**         | [JSZip](https://stuk.github.io/jszip/) + DOM namespace-aware XML parsing — PPTX → Markdown                                           |
| **Diagrams**             | [Mermaid.js](https://mermaid.js.org) v11 — mind maps, flowcharts                                                                     |
| **Presentations**        | [PptxGenJS](https://github.com/gitbrent/PptxGenJS) v4 — client-side PPTX generation                                                  |
| **Markdown Rendering**   | [marked](https://marked.js.org) v18                                                                                                  |
| **Speech Transcription** | Web Speech API (native browser, no library)                                                                                          |
| **Persistence**          | IndexedDB (knowledge base), `localStorage` (settings, todo), `sessionStorage` (session flags)                                         |
| **Testing**              | Vitest + jsdom (unit), Cypress (E2E)                                                                                                 |
| **Code Quality**         | Prettier, lint-staged                                                                                                                |
| **PWA**                  | Angular Service Worker (`ngsw-config.json`), offline-capable                                                                         |
| **Fonts**                | Syne · IBM Plex Sans · DM Mono (Google Fonts)                                                                                        |

---

## Supported Models

INES works with any MediaPipe-compatible LLM. The following are recommended and tested:

| Model                                                                      | Size  | Format      | Notes                             |
| -------------------------------------------------------------------------- | ----- | ----------- | --------------------------------- |
| [Gemma-3 1B IT](https://huggingface.co/litert-community/Gemma3-1B-IT)      | ~1 GB | `.task`     | Recommended for most hardware  |
| [Gemma-3n E2B IT](https://huggingface.co/google/gemma-3n-E2B-it-litert-lm) | ~2 GB | `.litertlm` | Multimodal (text + image + audio) |
| [Gemma-3n E4B IT](https://huggingface.co/google/gemma-3n-E4B-it-litert-lm) | ~4 GB | `.litertlm` | Higher quality, needs more VRAM   |
| [Gemma-2 2B IT](https://huggingface.co/litert-community/Gemma2-2B-IT)      | ~2 GB | `.task`     | Strong reasoning, all platforms   |
| [Gemma-3 4B IT](https://huggingface.co/litert-community/Gemma3-4B-IT)      | ~4 GB | `.task`     | Best quality for capable GPUs     |

> **Note:** Only GPU-backend encoded models are currently supported by the MediaPipe Web API. Files with `-Web` in the name from the [litert-community HuggingFace page](https://huggingface.co/litert-community) are pre-converted and ready to use.

---

## Getting Started

### 1. Download a model

Go to HuggingFace and download a compatible model file (`.task` or `.litertlm`). For most machines, start with **Gemma-3 1B**:

```
https://huggingface.co/litert-community/Gemma3-1B-IT
```

### 2. Run INES

```bash
cd ines-ng

# Install dependencies
npm install

# Start development server
npm start
# Then open http://localhost:4200

# Run unit tests
npm run vitest

# Run E2E tests
npm run cypress:open

# Build for production
npm run build
```

> **HTTPS note:** The Meeting tab uses the Web Speech API, which requires a secure context (`https://` or `localhost`). All other tabs work fine on `file://`.

### 3. Load the model

When INES opens, the model loader overlay appears. Drag and drop your `.task` or `.litertlm` file into the drop zone, or click to browse. The model is read as an `ArrayBuffer` and passed directly to the WASM runtime — it never leaves your browser.

Loading time by model size:

| Model Size | Approx. Load Time |
| ---------- | ----------------- |
| 1 GB       | 15 – 30 s         |
| 2 GB       | 30 – 60 s         |
| 4 GB       | 60 – 120 s        |

Once loaded, the status bar shows `✓ [model name]` in green. The model stays loaded for the entire session across all tabs.

---

## Features

### Chat

A general-purpose conversational assistant with **multi-turn memory**. The last 6 message pairs are included in every prompt to maintain context. Responses stream token-by-token.

**System prompt focus:** Helpful, concise, language-adaptive.

| Action        | How                        |
| ------------- | -------------------------- |
| Send message  | `Enter` or the send button |
| New line      | `Shift + Enter`            |
| Clear history | Trash button in header     |

---

### Email Assistant

Paste any email and apply AI-powered transformations in one click.

**Tone selectors:** Professional, Friendly, Assertive, Formal, Concise

**Actions:** Improve, Fix grammar, Shorten, Make formal, Reply, Summarize

---

### Meeting Recorder

Real-time voice transcription combined with AI-powered meeting analysis. Uses the browser's native **Web Speech API**.

1. Click **Start Recording** — microphone permission is requested
2. Speak; transcription appears live
3. Click **Stop Recording** — the model automatically summarizes:
   - Key Points, Decisions Made, Action Items, Next Steps

---

### Translator

Side-by-side translation between 10 languages with automatic language detection.

**Supported languages:** Italian, English, French, German, Spanish, Portuguese, Chinese, Japanese, Arabic, Russian

Features auto-detect, auto-translate (debounced), swap languages, and style-preserving output.

---

### Daily Planner

A smart task manager with manual entry and **AI-generated daily plans**.

- Add tasks with optional priority flag
- Check off completed tasks
- Tasks persist across browser sessions via `localStorage`
- AI generation: describe your day in natural language → structured JSON plan

---

### Coding Assistant

Multi-file code editor with AI-powered code generation, sandbox preview, copy and download. Supports diverse programming languages.

---

### DevAgent

An advanced coding agent with file system abstraction, terminal emulator, multi-step task execution, and integrated knowledge base retrieval.

---

### Agents

Create and manage custom AI agents with specialized system prompts, skills, and tools. Each agent can have its own personality, knowledge base access, and output format.

---

### Vision

Analyze images using on-device vision models. Upload or capture images for captioning, object detection, and visual Q&A — all processed locally.

---

### Learning Center

RAG-powered active learning platform. Upload documents (PDF, DOCX, PPTX, HTML, TXT, MD) and generate:

| Tool          | Description                                      |
| ------------- | ------------------------------------------------ |
| **Chat Q&A**  | Ask questions with source citations              |
| **Mind Map**  | Auto-generate Mermaid.js mind maps               |
| **Quiz**      | Multiple-choice quizzes with timer and scoring   |
| **Flashcards**| Anki-compatible CSV export                       |
| **Study Plan**| Structured timeline with milestones              |
| **Summary**   | Comprehensive document summaries                 |
| **Fill Blanks**| Cloze exercises from key facts                  |
| **Matching**  | Term ↔ Definition matching exercises             |
| **Open Q&A**  | Thought-provoking questions with AI feedback     |

---

### Knowledge Manager

Centralized knowledge base management:

- Upload documents (same formats as Learning Center)
- Chat Q&A with source citations and document preview
- Saved Q&A pairs with persistence
- Import/export knowledge base (`.ines-knowledge` format)
- Shared across all tabs via `KnowledgeManagerService`

---

### Slides

Create and edit presentations directly in the browser. AI-powered slide generation from prompts, with HTML/Markdown editing and real-time preview. Export to PPTX via PptxGenJS.

---

### Project

File-based project manager for organizing coding projects, documents, and assets. Drag-and-drop file upload, folder structure navigation, and integrated file viewer.

---

## RAG Pipeline

INES implements keyword-scoring Retrieval-Augmented Generation across all knowledge-enabled tabs:

```
File Upload → Text Extraction → Chunking (256 words, 32 overlap)
    → IndexedDB Storage (documents + chunks with keywords)
    → Query → Keyword Scoring → Top-K Retrieval → LLM Prompt
```

**Text extraction:** `TextProcessingService` handles PDF (pdf.js), DOCX (Mammoth), PPTX (JSZip + XML parsing), HTML, TXT, and MD files.

**Scoring:** Each chunk is scored by keyword overlap with the query. Bonus points for exact phrase matches and multi-keyword hits.

**Storage:** All documents, chunks, and Q&As are persisted in `InesKnowledgeDB` IndexedDB. Export/import supports migration between devices.

---

## Model Loading Internals

INES uses `modelAssetBuffer` (not `modelAssetPath`) to pass the model to the WASM runtime:

```javascript
const modelBuffer = await file.arrayBuffer();
llmInference = await LlmInference.createFromOptions(genai, {
  baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer) },
  ...
});
```

`blob:` URLs are scoped to the main browser context and cannot be fetched by the internal WASM fetch mechanism. Reading the file directly as an `ArrayBuffer` sidesteps this entirely.

The MediaPipe library is loaded as an **ES module** via CDN using dynamic `import()`:

```javascript
const mediapipe = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai');
```

**Caching:** Models are cached in IndexedDB (`InesModelCacheDB`) and `sessionStorage` for instant reload on page refresh. The caching layer checks IndexedDB first, then falls back to a local `/models/` URL, and finally shows the loader overlay.

---

## Prompt Architecture

Every tab uses the Gemma instruction-tuned prompt format:

```
<start_of_turn>user
[SYSTEM]: {tab-specific system prompt}

[PREVIOUS USER]: {history turn n-1}
[PREVIOUS ASSISTANT]: {history turn n-1}
...
[USER]: {current message}
<end_of_turn>
<start_of_turn>model
```

Each tab has a dedicated system prompt optimized for its task. Context from the knowledge base (when available) is prepended to the system message using `[docName]\nchunk text` format.

---

## Browser Requirements

| Requirement  | Details                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| **Browser**  | Chrome 113+ or Edge 113+ (WebGPU required)                                             |
| **WebGPU**   | Must be enabled (default in Chrome 113+)                                               |
| **RAM**      | 4 GB minimum; 8 GB recommended for 2B+ models                                          |
| **GPU**      | Any modern integrated or discrete GPU with WebGPU support                              |
| **HTTPS**    | Required only for the Meeting tab (Web Speech API)                                     |
| **Internet** | Only for the initial CDN load of `@mediapipe/tasks-genai` — inference is fully offline |

Firefox does not support WebGPU by default. Safari has partial WebGPU support; compatibility with MediaPipe is not guaranteed.

---

## Privacy Guarantee

| Data                      | Where it goes                                                         |
| ------------------------- | --------------------------------------------------------------------- |
| Your prompts and messages | **Stays in browser memory**                                           |
| Uploaded documents        | **Stays in browser IndexedDB** (your device only)                     |
| Email text                | **Stays in browser memory**                                           |
| Meeting audio             | **Processed by Web Speech API** (browser-native, OS-level)            |
| Meeting transcripts       | **Stays in browser memory**                                           |
| Todo list                 | **Stored in `localStorage`** (your device only)                       |
| Knowledge base            | **Stored in IndexedDB** (your device only)                            |
| The LLM model file        | **Stays in browser memory** — never uploaded                          |
| CDN requests              | `cdn.jsdelivr.net` for the MediaPipe JS library (once, on first load) |
| Google Fonts              | `fonts.googleapis.com` for UI fonts                                   |

No analytics. No telemetry. No accounts. No backend server.

---

## Known Limitations

- **One model at a time** — the model must be re-loaded to switch to a different one (page refresh required)
- **No session persistence for chat** — conversation history is lost on page reload (except todo and knowledge base)
- **Meeting tab requires HTTPS or localhost** — Web Speech API restriction
- **Large model load time** — a 4B model can take 2+ minutes to initialize on integrated graphics
- **WebGPU required** — no CPU-only fallback; MediaPipe will fail on older hardware
- **RAG is keyword-based** — no vector embeddings; retrieval quality depends on keyword overlap with the query
- **Single shared model** — all thirteen tabs share one `LlmInference` instance with no concurrent requests

---

## Roadmap

### Phase 1 — Foundation (Completed)

- [x] First POC in a single-file HTML with vanilla JS
- [x] Move POC into Angular 22 PWA with standalone components and Signals
- [x] UI improvements — icons, logo, footer, favicons

### Phase 2 — Core Product Features (Completed)

- [x] RAG pipeline with IndexedDB persistence
- [x] Learning Center with 9 learning tools
- [x] Knowledge Manager with import/export
- [x] DevAgent with file system and terminal
- [x] Agents with custom system prompts and skills
- [x] Vision tab with on-device image analysis
- [x] Presentation/Slides tab with PPTX export
- [x] Project tab with file management
- [x] DOCX and PPTX support in knowledge pipeline

### Phase 3 — AI Intelligence Layer

- [ ] Export meeting summary as `.txt` / `.md`
- [ ] Vector-based RAG embeddings for better retrieval
- [ ] Multi-model support — load different models for different tasks
- [ ] Fine-tuned Gemma 3 1B for specialized tasks

### Phase 4 — Platform & Reliability

- [ ] Unit and E2E test coverage for all features
- [ ] CI/CD pipeline for deployment to GitHub Pages
- [ ] Landing page to introduce the project
- [ ] Offline model hosting for air-gapped environments

---

## License

© 2026 All rights reserved.

This project and its source code are proprietary and are provided for **personal, non-commercial use only**.

### Third-party components

- MediaPipe — [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- Gemma model weights — [Gemma Terms of Use](https://ai.google.dev/gemma/terms)

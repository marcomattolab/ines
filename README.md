# INES — Intelligent Neural Edge System

> **Run a small language model entirely in your browser. No server. No API key. No data leaving your device.**

INES is an **Angular 22 PWA** that brings on-device AI to the browser using Google's [MediaPipe LLM Inference API](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) and WebGPU acceleration. Load a Gemma model once, and use **21 specialized AI-, vision-, and gesture-powered tools across 21 dedicated tabs** — all completely offline after the initial CDN load.

---

## Table of Contents

- [Why INES](#why-ines)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Supported Models](#supported-models)
- [Getting Started](#getting-started)
- [Implemented Tabs (21 Tabs)](#implemented-tabs-21-tabs)
- [Features](#features)
  - [Chat](#chat)
  - [Voice Assistant](#voice-assistant)
  - [Second Brain](#second-brain)
  - [Email Assistant](#email-assistant)
  - [Meeting Recorder](#meeting-recorder)
  - [Translator](#translator)
  - [Daily Planner](#daily-planner)
  - [Expenses (Spese)](#expenses-spese)
  - [Coding Assistant](#coding-assistant)
  - [DevAgent](#devagent)
  - [Agents](#agents)
  - [Vision](#vision)
  - [Sicilian Gestures (Gesti Siciliani)](#sicilian-gestures-gesti-siciliani)
  - [Pinch Scroll](#pinch-scroll)
  - [Head Cursor](#head-cursor)
  - [Background Replacer (Sfondo)](#background-replacer-sfondo)
  - [OCR & PII Redaction](#ocr--pii-redaction)
  - [Vision Assist](#vision-assist)
  - [Learning Center](#learning-center)
  - [Knowledge Manager](#knowledge-manager)
  - [Slides](#slides)
  - [Project](#project)
- [RAG Pipeline](#rag-pipeline)
- [Model Loading Internals](#model-loading-internals)
- [Prompt Architecture](#prompt-architecture)
- [Browser Requirements](#browser-requirements)
- [Privacy Guarantee](#privacy-guarantee)
- [Known Limitations](#known-limitations)
- [License](#license)

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
│  │  21 Tabs │                 │                                │ │
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
│  │  VisionService · AgentService · TodoService · ExpenseService│ │
│  │  TextProcessingService (PDF/DOCX/PPTX/HTML)                 │ │
│  │  DocFetchService · OcrService · CaptioningService           │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │  Persistence                                                │ │
│  │  IndexedDB (KnowledgeBase, Documents, Expenses, Models)     │ │
│  │  localStorage (Todo, Settings, Brain, Coding persistence)   │ │
│  │  sessionStorage (Model cache flag, theme, active tab)       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                 ▲
                 │  ES Module import (CDN, one-time)
                 │  @mediapipe/tasks-genai
```

A single `LlmInference` instance is initialized once and reused across all 21 tabs. Each tab injects its own specialized system prompt before the user message, effectively turning one model into 21 specialized agents. Tabs are lazy-loaded on-demand using Angular `@defer (prefetch on idle)` to keep initial bundle size tiny (~1.5 MB) while keeping tab switching instantaneous.

---

## Tech Stack

| Layer                  | Technology                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Framework**          | [Angular 22](https://angular.dev) — standalone components, Signals, `@defer` lazy-loading, `@for`/`@if` control flow                                   |
| **Styling**            | [Tailwind CSS 3](https://tailwindcss.com) + CSS custom properties + per-component CSS files                                                            |
| **LLM Runtime**        | [Google MediaPipe Tasks GenAI](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) (`@mediapipe/tasks-genai`)                   |
| **Vision & Gestures**  | [Google MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision) (`@mediapipe/tasks-vision`) — Gesture Recognizer & Face Mesh |
| **GPU Acceleration**   | WebGPU (via browser) + WASM SIMD fallback                                                                                                              |
| **Model Format**       | `.task` / `.litertlm` / `.bin` (MediaPipe-compatible)                                                                                                  |
| **RAG**                | Semantic and keyword-scoring retrieval over IndexedDB-stored document chunks                                                                           |
| **OCR (On-Device)**    | [Tesseract.js](https://tesseract.projectnaptha.com/) v7 — client-side optical character recognition with PII detection/masking                         |
| **Image Captioning**   | [@huggingface/transformers](https://huggingface.co/docs/transformers.js) via dedicated Web Worker for background image captioning                      |
| **PDF Parsing**        | [pdfjs-dist](https://github.com/mozilla/pdf.js) v5                                                                                                     |
| **DOCX Parsing**       | [Mammoth](https://github.com/mwilliamson/mammoth.js) — DOCX → plain text                                                                               |
| **PPTX Parsing**       | [JSZip](https://stuk.github.io/jszip/) + DOM namespace-aware XML parsing — PPTX → Markdown                                                             |
| **Diagrams**           | [Mermaid.js](https://mermaid.js.org) v11 — mind maps, flowcharts                                                                                       |
| **Presentations**      | [PptxGenJS](https://github.com/gitbrent/PptxGenJS) v4 — client-side PPTX generation                                                                    |
| **Markdown Rendering** | [marked](https://marked.js.org) v18                                                                                                                    |
| **Speech & Audio**     | Web Speech API (speech recognition + synthesis, native browser)                                                                                        |
| **Persistence**        | IndexedDB (knowledge base, expenses, cached models), `localStorage` (settings, todos), `sessionStorage` (session flags)                                |
| **Testing**            | Vitest + jsdom (210+ unit tests), Cypress (E2E)                                                                                                        |
| **Code Quality**       | Prettier, lint-staged                                                                                                                                  |
| **PWA**                | Angular Service Worker (`ngsw-config.json`), offline-capable                                                                                           |
| **Fonts**              | Syne · IBM Plex Sans · DM Mono (Google Fonts)                                                                                                          |

---

## Supported Models

INES works with any MediaPipe-compatible LLM. The following are recommended and tested:

| Model                                                                      | Size  | Format      | Notes                             |
| -------------------------------------------------------------------------- | ----- | ----------- | --------------------------------- |
| [Gemma-3 1B IT](https://huggingface.co/litert-community/Gemma3-1B-IT)      | ~1 GB | `.task`     | Recommended for most hardware     |
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

## Implemented Tabs (21 Tabs)

INES includes **21 specialized tabs** categorized across productivity, development, computer vision, gestures, and active content learning. All tabs share the same underlying on-device neural runtime.

| #   | Tab ID          | Label           | Category          | Description                                                                                                   |
| --- | --------------- | --------------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | `assistant`     | **Voice**       | General           | Continuous hands-free voice assistant with "Hey Ines" wake word, voice commands & speech synthesis            |
| 2   | `chat`          | **Chat**        | General           | Conversational multi-turn assistant with streaming tokens and context memory                                  |
| 3   | `email`         | **Email**       | General           | One-click email drafting, tone styling (formal, concise, friendly), proofreading & summarization              |
| 4   | `meeting`       | **Meeting**     | General           | Real-time speech-to-text recorder with automated action items & meeting minutes                               |
| 5   | `translate`     | **Translate**   | General           | Instant translation between 10 languages with auto-detection & style preservation                             |
| 6   | `todo`          | **Todo**        | General           | Smart daily planner with priorities, undo/redo stack, categories & natural language plan generation           |
| 7   | `expenses`      | **Spese**       | General           | Personal & business expense tracking with monthly amortisation, receipt OCR & category analytics              |
| 8   | `coding`        | **Code**        | Development       | Angular/TypeScript coding assistant with syntax highlighting, sandbox preview & export                        |
| 9   | `agents`        | **Agents**      | Development       | Multi-agent manager with customizable system prompts, capabilities & tool bindings                            |
| 10  | `vision`        | **Vision**      | Vision & Gestures | Object detection, visual classification, and scene analysis via MediaPipe Vision                              |
| 11  | `sicilian`      | **Gesti**       | Vision & Gestures | Real-time Sicilian hand gesture recognition (_"Ma che vuoi?"_, _"Perfetto"_, etc.) with audio/visual feedback |
| 12  | `pinch-scroll`  | **Pinch**       | Vision & Gestures | Touchless page navigation and scrolling driven entirely by hand pinch gestures                                |
| 13  | `head-cursor`   | **Head Cursor** | Vision & Gestures | Accessible pointer navigation and clicks driven by head pose and Face Mesh tracking                           |
| 14  | `background`    | **Sfondo**      | Vision & Gestures | Live webcam portrait background segmentation and replacement (London, Paris, Rome, Tokyo, Palermo)            |
| 15  | `pii-ocr`       | **OCR PII**     | Vision & Gestures | On-device Tesseract.js OCR with automated detection & masking of sensitive PII (GDPR/privacy)                 |
| 16  | `vision-assist` | **Assistente**  | Vision & Gestures | Assistive vision camera captioning, document reader & text-to-speech descriptions for accessibility           |
| 17  | `learning`      | **Learning**    | Content           | RAG active learning suite: flashcards, quizzes, Mermaid mind maps, cloze & study schedules                    |
| 18  | `presentation`  | **Slides**      | Content           | Interactive slide creator with AI generation & client-side PowerPoint (.pptx) export                          |
| 19  | `project`       | **Project**     | Content           | Multi-file project workspace with document indexing & local RAG search                                        |
| 20  | `brain`         | **Brain**       | Content           | Second Brain personal knowledge base with hierarchical folders & semantic retrieval                           |
| 21  | `dev-agent`     | **DevAgent**    | AI                | Autonomous developer coding agent with file system abstraction, patch application & git diffs                 |

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

### Voice Assistant

Continuous hands-free voice interaction powered by Web Speech recognition and local intent parsing.

- **Wake word support:** Optional "Hey Ines" activation on startup
- **Spoken responses:** Natural text-to-speech feedback
- **Quick commands:** Add reminders, tasks, check status, or trigger actions completely hands-free

---

### Second Brain

Hierarchical personal knowledge repository combining local document storage and semantic chunk retrieval.

- Categorize notes and knowledge into custom folders
- Instant similarity search and contextual QA against your personal archive
- 100% private and persisted locally via IndexedDB

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

### Expenses (Spese)

Comprehensive on-device personal and business expense tracking:

- Track one-off and recurring expenses with monthly amortisation
- Categorize spending (work, personal, utilities, food, etc.) with custom tags
- Filter by date ranges, categories, and payment methods
- Export and import data locally in IndexedDB

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

### Sicilian Gestures (Gesti Siciliani)

Real-time hand gesture recognition powered by MediaPipe Hands:

- Detects traditional Sicilian gestures (_"Ma che vuoi?"_, _"Perfetto"_, _"Mamma mia"_, etc.)
- Audio-visual feedback with cultural explanations and folklore context
- Runs at 30+ FPS directly in the browser via WebCam

---

### Pinch Scroll

Hands-free touchless web navigation:

- Control page scrolling and zooming purely using hand pinch gestures
- Smooth physics and momentum simulation

---

### Head Cursor

Accessible head tracking pointer control:

- Control cursor movement and clicking using head pose and eye/blink gestures
- 100% on-device MediaPipe Face Mesh processing for complete privacy

---

### Background Replacer (Sfondo)

Real-time virtual background replacement for webcam video:

- Live portrait segmentation without green screen
- Replace background with presets (London, Paris, Rome, Tokyo, Palermo) or custom images
- Blur and virtual studio lighting effects

---

### OCR & PII Redaction

Document scanning and GDPR-compliant sensitive data protection:

- On-device text recognition with **Tesseract.js** (`ita+eng`)
- Automatic pattern matching for sensitive personal information (PII): Emails, IBAN, Italian Codice Fiscale, Credit Cards (Luhn check), Partita IVA, Phone numbers, and IP addresses
- Interactive canvas redactor: mask private data visually and copy sanitized text

---

### Vision Assist

Assistive vision assistant for visually impaired users:

- Real-time scene captioning and OCR reading from camera stream
- Spoken audio descriptions via Web Speech synthesis
- Zero network dependency

---

### Learning Center

RAG-powered active learning platform. Upload documents (PDF, DOCX, PPTX, HTML, TXT, MD) and generate:

| Tool            | Description                                    |
| --------------- | ---------------------------------------------- |
| **Chat Q&A**    | Ask questions with source citations            |
| **Mind Map**    | Auto-generate Mermaid.js mind maps             |
| **Quiz**        | Multiple-choice quizzes with timer and scoring |
| **Flashcards**  | Anki-compatible CSV export                     |
| **Study Plan**  | Structured timeline with milestones            |
| **Summary**     | Comprehensive document summaries               |
| **Fill Blanks** | Cloze exercises from key facts                 |
| **Matching**    | Term ↔ Definition matching exercises           |
| **Open Q&A**    | Thought-provoking questions with AI feedback   |

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
const mediapipe =
  await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai");
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

| Requirement  | Details                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Browser**  | Chrome 113+ or Edge 113+ (WebGPU required)                                                                                           |
| **WebGPU**   | Must be enabled (default in Chrome 113+)                                                                                             |
| **RAM**      | 4 GB minimum; 8 GB recommended for 2B+ models                                                                                        |
| **GPU**      | Any modern integrated or discrete GPU with WebGPU support                                                                            |
| **HTTPS**    | Required only for the Meeting tab (Web Speech API)                                                                                   |
| **Internet** | Only on first load — `@mediapipe/tasks-genai` (CDN) and Vision `.task` models (cached in IndexedDB). Inference is then fully offline |

Firefox does not support WebGPU by default. Safari has partial WebGPU support; compatibility with MediaPipe is not guaranteed.

---

## Privacy Guarantee

| Data                      | Where it goes                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Your prompts and messages | **Stays in browser memory**                                                             |
| Uploaded documents        | **Stays in browser IndexedDB** (your device only)                                       |
| Email text                | **Stays in browser memory**                                                             |
| Meeting audio             | **Processed by Web Speech API** (browser-native, OS-level)                              |
| Meeting transcripts       | **Stays in browser memory**                                                             |
| Todo list                 | **Stored in `localStorage`** (your device only)                                         |
| Knowledge base            | **Stored in IndexedDB** (your device only)                                              |
| The LLM model file        | **Stays in browser memory** — never uploaded                                            |
| CDN requests              | `cdn.jsdelivr.net` for the MediaPipe JS library (once, on first load)                   |
| Vision models             | `storage.googleapis.com` MediaPipe `.task` models (Vision tab, cached after first load) |
| Google Fonts              | `fonts.googleapis.com` for UI fonts                                                     |

No analytics. No telemetry. No accounts. No backend server.

---

## Known Limitations

- **One model at a time** — the model must be re-loaded to switch to a different one (page refresh required)
- **No session persistence for chat** — conversation history is lost on page reload (except todo and knowledge base)
- **Meeting tab requires HTTPS or localhost** — Web Speech API restriction
- **Large model load time** — a 4B model can take 2+ minutes to initialize on integrated graphics
- **WebGPU required** — no CPU-only fallback; MediaPipe will fail on older hardware
- **RAG is keyword-based** — no vector embeddings; retrieval quality depends on keyword overlap with the query
- **Single shared model** — all 21 tabs share one `LlmInference` instance with no concurrent requests

---

## License

© 2026 All rights reserved.

This project and its source code are proprietary and are provided for **personal, non-commercial use only**.

### Third-party components

- MediaPipe — [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- Gemma model weights — [Gemma Terms of Use](https://ai.google.dev/gemma/terms)

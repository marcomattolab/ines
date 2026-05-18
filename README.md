# INES - Intelligent Neural Edge System

> **Run a large language model entirely in your browser. No server. No API key. No data leaving your device.**

INES is a single-file, zero-dependency web application that brings on-device AI to the browser using Google's [MediaPipe LLM Inference API](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) and WebGPU acceleration. Load a Gemma model once, and use five specialized AI-powered tools — all completely offline after the initial CDN load.

---

## Table of Contents

- [Why INES](#why-ines)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Supported Models](#supported-models)
- [Getting Started](#getting-started)
- [Features](#features)
  - [💬 Chat](#-chat)
  - [✉️ Email Assistant](#️-email-assistant)
  - [🎙️ Meeting Recorder](#️-meeting-recorder)
  - [🌍 Translator](#-translator)
  - [✅ Daily Planner](#-daily-planner)
  - [👨‍💻 Coding Assistant](#-coding-assistant)
- [Model Loading Internals](#model-loading-internals)
- [Prompt Architecture](#prompt-architecture)
- [Browser Requirements](#browser-requirements)
- [Privacy Guarantee](#privacy-guarantee)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Why INES

Most AI tools require a cloud API, an account, and send your data to a remote server. INES takes the opposite approach: the entire neural network runs inside your browser tab via WebAssembly and WebGPU. Your prompts, emails, meeting transcripts, and todo lists never leave your machine.

This makes INES suitable for:

- Sensitive corporate communication that cannot be sent to third-party APIs
- Air-gapped or offline environments
- Privacy-conscious personal productivity
- Demos and educational use of on-device AI

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser Tab                          │
│                                                             │
│  ┌──────────┐   ArrayBuffer   ┌───────────────────────────┐ │
│  │  File    │ ──────────────► │  MediaPipe WASM Runtime   │ │
│  │  Picker  │                 │  (WebGPU accelerated)     │ │
│  └──────────┘                 │                           │ │
│                               │  LlmInference instance    │ │
│  ┌──────────────────────────┐ │  (shared across all tabs) │ │
│  │   5 Tab UI               │ │                           │ │
│  │                          │ │  Gemma 3 / Gemma 3n       │ │
│  │  Chat · Email · Meeting  │ │  streaming tokens via     │ │
│  │  Translate · Todo        │◄│  generateResponse()       │ │
│  │                          │ │                           │ │
│  └──────────────────────────┘ └───────────────────────────┘ │
│                                                             │
│  Web Speech API (Meeting tab) · localStorage (Todo tab)    │
└─────────────────────────────────────────────────────────────┘
              ▲
              │  ES Module import (CDN, one-time)
              │  @mediapipe/tasks-genai
```

A single `LlmInference` instance is initialized once and reused across all five tabs. Each tab injects its own system prompt before the user message, effectively turning one model into five specialized agents.

---

## Tech Stack

| Layer                    | Technology                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **LLM Runtime**          | [Google MediaPipe Tasks GenAI](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) (`@mediapipe/tasks-genai`) |
| **GPU Acceleration**     | WebGPU (via browser) + WASM SIMD fallback                                                                                            |
| **Model Format**         | `.task` / `.litertlm` / `.bin` (MediaPipe-compatible)                                                                                |
| **Speech Transcription** | Web Speech API (native browser, no library)                                                                                          |
| **Persistence**          | `localStorage` (Todo list only)                                                                                                      |
| **Fonts**                | Syne · IBM Plex Sans · DM Mono (Google Fonts)                                                                                        |
| **Dependencies**         | **Zero** — single HTML file, no build step                                                                                           |
| **Distribution**         | Static HTML file — open directly or serve from any web server                                                                        |

---

## Supported Models

INES works with any MediaPipe-compatible LLM. The following are recommended and tested:

| Model                                                                      | Size  | Format      | Notes                             |
| -------------------------------------------------------------------------- | ----- | ----------- | --------------------------------- |
| [Gemma-3 1B IT](https://huggingface.co/litert-community/Gemma3-1B-IT)      | ~1 GB | `.task`     | ✅ Recommended for most hardware  |
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

### 2. Open INES

Open `ines.html` directly in Chrome or Edge (no server needed for most use cases).

```bash
# Or serve locally if you need HTTPS for microphone access:
npx serve .
# then open http://localhost:3000/ines.html
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

### 💬 Chat

A general-purpose conversational assistant with **multi-turn memory**. The last 6 message pairs are included in every prompt to maintain context. Responses stream token-by-token.

**System prompt focus:** Helpful, concise, language-adaptive. Mirrors the user's language automatically.

| Action        | How                        |
| ------------- | -------------------------- |
| Send message  | `Enter` or the send button |
| New line      | `Shift + Enter`            |
| Copy a reply  | Hover over the bubble → 📋 |
| Clear history | 🗑 button in the header    |

---

### ✉️ Email Assistant

Paste any email and apply AI-powered transformations in one click.

**Tone selectors:**

| Tone            | Description                            |
| --------------- | -------------------------------------- |
| 🎩 Professional | Business-appropriate, neutral register |
| 😊 Friendly     | Warm and approachable                  |
| 💪 Assertive    | Confident, no-fluff                    |
| 📜 Formal       | Official correspondence style          |
| ⚡ Concise      | Maximum information density            |

**Actions:**

| Action         | What it does                                      |
| -------------- | ------------------------------------------------- |
| ✨ Improve     | Rewrites the email with better flow and clarity   |
| 🔧 Fix grammar | Grammar and spelling fix only, no content changes |
| ✂️ Shorten     | Halves length while preserving key points         |
| 🎩 Make formal | Elevates register to formal correspondence        |
| ↩️ Reply       | Drafts a contextually appropriate reply           |
| 📋 Summarize   | Extracts 3–5 bullet-point key takeaways           |

The output preserves the original email's language. Click 📋 Copy button to copy the result to clipboard.

---

### 🎙️ Meeting Recorder

Real-time voice transcription combined with AI-powered meeting analysis. Uses the browser's native **Web Speech API** — no audio data is sent anywhere.

**How it works:**

1. Click **Avvia Registrazione** — microphone permission is requested
2. Speak; transcription appears live in the left pane (interim results shown in brackets)
3. Click **Ferma Registrazione** — the model automatically summarizes
4. The right pane shows a structured summary:
   - **Punti Chiave** — main topics discussed
   - **Decisioni Prese** — decisions made
   - **Action Items** — who does what
   - **Prossimi Passi** — next steps

You can also trigger the summary manually with **✨ Riassumi Ora** without stopping the recording. The transcript and summary can be copied individually with the 📋 buttons.

> **Language:** The speech recognizer uses `navigator.language` by default, so it adapts to your OS locale. The summary is always produced in the transcript's language.

---

### 🌍 Translator

Side-by-side translation between 10 languages with automatic language detection.

**Supported languages:**

Italian · English · French · German · Spanish · Portuguese · Chinese · Japanese · Arabic · Russian

**Features:**

- **Auto-detect** source language — no need to specify what you're translating from
- **Auto-translate** — translation triggers automatically 1.2 seconds after you stop typing (debounced)
- **⇄ Swap** — swaps source/target languages and re-translates the current output as new input
- **Manual translate** — click 🌍 Traduci for immediate translation
- Preserves original formatting, tone, and style

---

### ✅ Daily Planner

A smart task manager that combines manual entry with **AI-generated daily plans**.

**Manual mode:**

- Add tasks with optional 🔥 priority flag
- Check off completed tasks
- Remove individual items or bulk-clear all done tasks
- Tasks persist across browser sessions via `localStorage`

**AI generation mode:**
Describe your day in natural language in the right panel. The AI returns a structured JSON plan with 4–8 concrete, specific tasks tagged as `normal` or `priority`. Example input:

```
Ho una demo alle 15, revisione PR del team Angular,
call col cliente e preparare slide per il tech talk di venerdì
```

The model generates a prioritized, realistic task breakdown and injects it directly into your list.

---

## 👨‍💻 Coding Assistant

Coding Assistant is a tab for generating code snippets, web components, dashboards, and more.
It support diverse langiages and use a specific LLM for code generation.

---

## Model Loading Internals

INES uses `modelAssetBuffer` (not `modelAssetPath`) to pass the model to the WASM runtime.
This is a deliberate technical choice:

```javascript
// ✅ Correct: pass ArrayBuffer directly
const modelBuffer = await file.arrayBuffer();
llmInference = await LlmInference.createFromOptions(genai, {
  baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer) },
  ...
});

// ❌ Wrong: blob URLs are not fetchable by the WASM runtime context
const modelUrl = URL.createObjectURL(file);  // causes "Failed to fetch"
```

`blob:` URLs are scoped to the main browser context and cannot be fetched by the internal WASM fetch mechanism that MediaPipe uses to load model assets. Reading the file directly as an `ArrayBuffer` sidesteps this entirely.

The MediaPipe library itself is loaded as an **ES module** via CDN:

```javascript
import {
  FilesetResolver,
  LlmInference,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai";
```

The `.cjs` bundle (historically documented in some Google guides) is served by jsDelivr with `Content-Type: application/node`, which browsers reject. The bare ESM import resolves correctly to the `.mjs` entry with the right MIME type.

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

Each tab has a dedicated system prompt optimized for its task:

| Tab       | System Prompt Focus                                                |
| --------- | ------------------------------------------------------------------ |
| Chat      | General assistant, language-adaptive, multi-turn                   |
| Email     | Business writing expert, output-only (no preamble)                 |
| Meeting   | Structured output: key points, decisions, action items, next steps |
| Translate | Exact translation, output-only, style-preserving                   |
| Todo      | JSON-structured output: `{tasks: [...], message: "..."}`           |
| Coding    | Code generation, sandbox preview, copy and download                |

The Todo tab uses **structured JSON output** prompting — the model is instructed to return only a valid JSON object, which is then parsed to populate the task list programmatically.

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

Firefox does not support WebGPU by default as of the time of writing. Safari has partial WebGPU support; compatibility with MediaPipe is not guaranteed.

---

## Privacy Guarantee

| Data                      | Where it goes                                                         |
| ------------------------- | --------------------------------------------------------------------- |
| Your prompts and messages | **Stays in browser memory**                                           |
| Email text                | **Stays in browser memory**                                           |
| Meeting audio             | **Processed by Web Speech API** (browser-native, OS-level)            |
| Meeting transcripts       | **Stays in browser memory**                                           |
| Todo list                 | **Stored in `localStorage`** (your device only)                       |
| The LLM model file        | **Stays in browser memory** — never uploaded                          |
| CDN requests              | `cdn.jsdelivr.net` for the MediaPipe JS library (once, on first load) |
| Google Fonts              | `fonts.googleapis.com` for UI fonts                                   |

No analytics. No telemetry. No accounts.

---

## Known Limitations

- **One model at a time** — the model must be re-loaded to switch to a different one (page refresh required)
- **No session persistence for chat** — conversation history is lost on page reload
- **Meeting tab requires HTTPS or localhost** — Web Speech API restriction
- **Large model load time** — a 4B model can take 2+ minutes to initialize on integrated graphics
- **No WASM SIMD fallback for very old CPUs** — MediaPipe will warn and may fail on older hardware
- **Single-file, no build tooling** — intentional; advanced use cases (e.g., Web Workers for non-blocking init) would require a proper build setup

---

## Roadmap

- [x] First POC in a single-file HTML with vanilla JS
- [x] Move this POC into a proper Angular 22 PWA with standalone components and Signals
- [x] UI improvemens and creation of icons, logo, footer and favicons
- [ ] Export meeting summary as `.txt` / `.md`
- [ ] Handle diverse model based on tasks automatically
- [ ] RAG pipeline integration via `@mediapipe/tasks-genai-experimental`
- [ ] Improve coding assistant with more features and sandbox improvement
- [ ] Add unit and e2e tests for all the features and documentation
- [ ] Add new tabs for new features (based on project/company)
- [ ] Fine tuning Gemma 3 1B to make it a better assistant
- [ ] Explore more LLM providers
- [ ] Setup CI/CD for deployment to GitHub Pages
- [ ] Create landing page to introduce the project

---

## License

This project is provided as-is for educational and personal productivity use.
The MediaPipe library is licensed under [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0).
Gemma model weights are subject to the [Gemma Terms of Use](https://ai.google.dev/gemma/terms).

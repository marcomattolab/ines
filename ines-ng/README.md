# INES (Angular 22 PWA) — Intelligent Neural Edge System

Intelligent Neural Edge System (INES) is a client-side Progressive Web Application (PWA) built with **Angular 22** that executes neural network models entirely inside the user's browser via **WebGPU/WebAssembly** acceleration. No server, no external API keys, and no personal data ever leaving the device.

INES is organized into **8 tab hubs** — grouped workspaces (Assistant, Knowledge, Code, Learning, Labs…) that share a single local **LiteRT-LM** session and dedicated client-side perceptual models (MediaPipe Tasks, Tesseract.js, EmbeddingGemma).

---

## 📑 Tab Hubs (8 workspaces)

Each hub groups related tools with an internal navigation bar (chips), keeping the sidebar clean:

| # | Tab             | Category    | Tools inside                                                                                       |
| - | --------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| 1 | **Assistant**   | Productivity | Chat (streaming, RAG) · Voice (wake word "Hey Ines", speech recognition & TTS)                     |
| 2 | **Knowledge**   | Productivity | Second Brain (notes, semantic memory, folders) · Project (documents workspace)                     |
| 3 | **Todo**        | Productivity | Task manager with 20-level undo, priorities, categories & reminders                                |
| 4 | **Meeting**     | Productivity | Real-time speech-to-text recorder with automated action items & minutes                            |
| 5 | **Translate**   | Productivity | Debounced offline translator with auto-detection                                                    |
| 6 | **Code**        | Dev & Studio | Code assistant (syntax highlight, sandbox) · DevAgent (autonomous) · Agents (catalog & skills)     |
| 7 | **Learning**    | Dev & Studio | Chat Q&A · Summary · Mind Map · Study Plan · Quiz · Flashcards · Fill Blanks · Matching · Open Q&A · Slides (HTML + PPTX) |
| 8 | **Labs**        | Vision & AI | Vision · Vision Assist · OCR & PII · Gestures · Pinch Scroll · Head Cursor · Background · Tris     |

---

## 🏗️ Project Structure

```
ines-ng/src/app/
├── app.ts                         # Root component, tab navigation, keyboard shortcuts, command palette
├── app.html                       # Layout, sidebar, lazy panel rendering via @defer
├── app.css                        # App host layout and styling
├── app.config.ts                  # Application configuration (HTTP, service worker)
│
├── core/services/                 # Injected singleton services
│   ├── llm.service.ts             # LiteRT-LM engine runner, streaming chat & IndexedDB model cache
│   ├── embedding.service.ts       # EmbeddingGemma 2 semantic vectors (on-device, CPU)
│   ├── slide-deck.service.ts      # Slide generation: LLM JSON → deterministic HTML + PPTX export
│   ├── voice-assistant.service.ts # Continuous voice assistant & wake word detection
│   ├── voice-intent.ts            # Deterministic intent parsing (navigation, todo, reminders…)
│   ├── speech.service.ts          # Web Speech API recognition & speech synthesis
│   ├── second-brain.service.ts    # Second Brain notes, folders & BM25/semantic retrieval
│   ├── knowledge-manager.service.ts # Knowledge base document store & RAG
│   ├── project.service.ts         # Project workspace document management
│   ├── base-indexed-db.service.ts # Abstract base class for IndexedDB storage
│   ├── text-processing.service.ts # Extractors for PDF, DOCX, PPTX, HTML, Markdown
│   ├── ocr.service.ts             # Tesseract.js local OCR worker
│   ├── pii.ts                     # PII pattern detection (IBAN, CF, Luhn card, VAT, IP)
│   ├── vision.service.ts          # MediaPipe Face/Gesture/Hand/Pose landmarker orchestration
│   ├── mediapipe-tasks.service.ts # MediaPipe Hand/Face/Selfie-segmentation task loaders (shared)
│   ├── camera.ts                  # Webcam stream lifecycle & RAF frame loop
│   ├── captioning.service.ts      # Image captioning bridge to Web Worker
│   ├── captioning.worker.ts       # Transformers.js background image captioning worker
│   ├── reminder.service.ts        # Reminder scheduling with persisted timers
│   ├── reminder-parse.ts          # Natural-language reminder time parsing
│   ├── todo.service.ts            # Daily planner store with 20-level undo stack
│   ├── settings.service.ts        # User settings: tab ordering, visible tabs, theme, language
│   ├── storage.service.ts         # Privacy-aware localStorage wrapper
│   ├── privacy.service.ts         # Privacy mode flag
│   ├── toast.service.ts           # Signal-based toast notification queue
│   ├── syntax-highlight.service.ts# Code syntax highlighting
│   ├── dom-utils.service.ts       # Download, clipboard, HTML escaping helpers
│   ├── doc-fetch.service.ts       # Fetches remote documentation (Angular guides) into the KB
│   ├── harness.service.ts         # Voice assistant system prompt builder
│   ├── agent.service.ts           # Agents & skills catalog (CRUD + import/export)
│   ├── json-parser.service.ts     # Resilient JSON parser and markdown block extractor
│   └── presentation-prompt.ts     # Shared presentation CSS/design tokens
│
├── components/                    # Tab hubs + standalone tab components
│   ├── status-bar/                # Model status, WebGPU indicator, memory badge
│   ├── loader-overlay/            # Drag-and-drop model loader & cache selector
│   ├── info-modal/                # System information & privacy details
│   ├── assistant-tab/             # Hub: chat + voice
│   ├── knowledge-tab/             # Hub: brain + project
│   ├── code-tab/                  # Hub: coding + dev-agent + agents
│   ├── labs-tab/                  # Hub: 8 vision/gesture experiments
│   ├── chat-tab/                  # Multi-turn conversational chat
│   ├── voice-tab/                 # Voice assistant panel
│   ├── brain-tab/                 # Second Brain folder explorer & notes
│   ├── project-tab/               # Workspace project file manager
│   ├── coding-tab/                # Code playground & generator
│   ├── dev-agent-tab/             # Autonomous coding agent & diff viewer
│   ├── agents-tab/                # Custom agents & skills manager
│   ├── meeting-tab/               # Speech recorder & meeting summarizer
│   ├── translate-tab/             # Offline multi-language translator
│   ├── todo-tab/                  # Smart daily planner
│   ├── learning-tab/              # RAG study tools, quizzes, mind maps & slides
│   ├── vision-tab/                # Computer vision & object detection
│   ├── vision-assist-tab/         # Assistive camera vision & reading assistant
│   ├── pii-ocr-tab/               # Document OCR with interactive PII redactor
│   ├── sicilian-gestures-tab/     # MediaPipe hand gesture detection
│   ├── pinch-scroll-tab/          # Gesture-controlled touchless scrolling
│   ├── head-cursor-tab/           # Head tracking pointer navigation
│   ├── background-tab/            # Real-time virtual background replacement
│   └── tic-tac-toe-tab/           # Two-player game with mouse/pinch/head cursor
│
└── shared/                        # Shared UI components & utilities
    ├── components/button/         # Reusable button component
    ├── components/confirm-dialog/ # Modal confirmation dialog
    ├── components/dropdown/       # Custom select/dropdown component
    ├── message-bubble/            # Chat message bubble with markdown & code copy
    ├── typing-indicator/          # Animated three-dot typing indicator
    ├── chat-input.directive.ts    # Auto-resizing chat input
    └── resize.util.ts             # Panel resizer utility
```

---

## 🛠️ Key Commands

Run from the `ines-ng/` directory:

| Command                     | Action                                                |
| --------------------------- | ----------------------------------------------------- |
| `npm start`                 | Launch Angular dev server at `http://localhost:4200`  |
| `npm run build`             | Compile production build into `dist/ines-ng/browser/` |
| `npm test`                  | Run Vitest unit tests once (CI-friendly, 189 tests)   |
| `npm run vitest`            | Run Vitest in interactive watch mode                  |
| `npm run cypress:run`       | Execute Cypress E2E headless test suite               |
| `npm run cypress:open`      | Open Cypress interactive E2E runner                   |
| `npx prettier --check src/` | Check code formatting across `src/`                   |
| `npx prettier --write src/` | Automatically format all source files                 |

---

## ⚡ Performance & Lazy Loading Architecture

- **Eager Shell**: The application shell, status bar and the default **Assistant** hub load instantly.
- **On-Demand Tabs**: The other 7 hubs use `@defer (when activeTab() === '...')`, so heavy dependencies (PptxGenJS, Tesseract.js, Mermaid, MediaPipe Vision tasks, pdfjs-dist, mammoth) are isolated into lazy chunks loaded only when the hub is first opened.
- **Hub Sub-Tools**: Within each hub, sub-tools are rendered with `@if`, so switching tools **destroys** the previous component — this stops the webcam and animation frames when you leave a camera tool (e.g. in Labs), instead of keeping it running in the background.
- **On-device Models**: The LLM (LiteRT-LM) and the embedding model (EmbeddingGemma 2) are cached in IndexedDB for instant reloads; vision models (MediaPipe `.task`) are fetched once and cached too.

---

## 📦 PWA & Offline Support

- **App Shell Caching**: `ngsw-config.json` caches the application shell, icons, fonts, and styles for complete offline usability.
- **Model Storage**: Model files are loaded into browser memory and cached in IndexedDB (`InesModelCacheDB`, `InesEmbedderCacheDB`, `InesVisionCacheDB`) for instant page reloads.
- **Privacy Assurance**: No telemetry, no third-party APIs, and zero network calls during neural inference.

---

_INES — Intelligent Neural Edge System_  
_Running locally in your browser · Powered by [LiteRT-LM](https://ai.google.dev/edge/litert) and [MediaPipe](https://ai.google.dev/edge/mediapipe)_

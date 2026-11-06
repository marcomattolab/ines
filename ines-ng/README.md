# INES (Angular 22 PWA) — Intelligent Neural Edge System

Intelligent Neural Edge System (INES) is a client-side Progressive Web Application (PWA) built with **Angular 22** that executes state-of-the-art neural network models entirely inside the user's browser via **WebGPU** acceleration and **WebAssembly**. No server, no external API keys, and no personal data ever leaving the device.

INES provides **21 specialized AI-, vision-, and gesture-powered tabs**, all sharing a single local `LlmInference` session and dedicated client-side perceptual models (MediaPipe Tasks, Tesseract.js, Transformers.js).

---

## 📑 Implemented Tabs (21 Tabs)

All 21 tabs are fully implemented and optimized with Angular `@defer (prefetch on idle)`:

| #   | Tab ID          | Sidebar Label   | Category          | Status | Description                                                                            |
| --- | --------------- | --------------- | ----------------- | :----: | -------------------------------------------------------------------------------------- |
| 1   | `assistant`     | **Voice**       | General           |   ✅   | Continuous hands-free assistant with "Hey Ines" wake word, speech recognition & TTS    |
| 2   | `chat`          | **Chat**        | General           |   ✅   | Multi-turn streaming chat with token-by-token generation and context memory            |
| 3   | `email`         | **Email**       | General           |   ✅   | Tone transformer, proofreading, grammar fixer, and email summarizer                    |
| 4   | `meeting`       | **Meeting**     | General           |   ✅   | Real-time speech-to-text recorder with automated action items & meeting minutes        |
| 5   | `translate`     | **Translate**   | General           |   ✅   | Debounced offline translator across 10 languages with auto-detection                   |
| 6   | `todo`          | **Todo**        | General           |   ✅   | Daily task manager with undo stack (20 levels), priority, categories & AI daily plans  |
| 7   | `expenses`      | **Spese**       | General           |   ✅   | Expense tracker with monthly amortisation, receipt OCR, analytics & category breakdown |
| 8   | `coding`        | **Code**        | Development       |   ✅   | TypeScript/Angular assistant with syntax highlighting, sandbox preview & file export   |
| 9   | `agents`        | **Agents**      | Development       |   ✅   | Customizable multi-agent manager with dedicated system prompts & skill bindings        |
| 10  | `vision`        | **Vision**      | Vision & Gestures |   ✅   | On-device visual classification, object detection & visual Q&A via MediaPipe           |
| 11  | `sicilian`      | **Gesti**       | Vision & Gestures |   ✅   | Real-time Sicilian hand gesture recognition (_"Ma che vuoi?"_, _"Perfetto"_, etc.)     |
| 12  | `pinch-scroll`  | **Pinch**       | Vision & Gestures |   ✅   | Hands-free page navigation and smooth scrolling controlled via hand pinch gestures     |
| 13  | `head-cursor`   | **Head Cursor** | Vision & Gestures |   ✅   | Accessible mouse cursor & click control powered by head pose and Face Mesh             |
| 14  | `background`    | **Sfondo**      | Vision & Gestures |   ✅   | Real-time virtual background replacement (London, Paris, Rome, Tokyo, Palermo)         |
| 15  | `pii-ocr`       | **OCR PII**     | Vision & Gestures |   ✅   | Tesseract.js OCR + automatic detection and redaction of PII (GDPR / sensitive data)    |
| 16  | `vision-assist` | **Assistente**  | Vision & Gestures |   ✅   | Assistive vision camera captioning & document text reader with voice feedback          |
| 17  | `learning`      | **Learning**    | Content           |   ✅   | RAG active study center: quizzes, flashcards, Mermaid mind maps, cloze exercises       |
| 18  | `presentation`  | **Slides**      | Content           |   ✅   | Markdown slide deck creator with AI generation & client-side PowerPoint (.pptx) export |
| 19  | `project`       | **Project**     | Content           |   ✅   | Multi-file workspace with document parsing (PDF, DOCX, PPTX) & local RAG search        |
| 20  | `brain`         | **Brain**       | Content           |   ✅   | Second Brain personal knowledge repository with hierarchical folders & retrieval       |
| 21  | `dev-agent`     | **DevAgent**    | AI                |   ✅   | Autonomous developer agent with file tree abstraction, code patches & git diff view    |

---

## 🏗️ Project Structure

```
ines-ng/src/app/
├── app.ts                         # Root component, tab navigation, keyboard shortcuts
├── app.html                       # Layout, sidebar, lazy panel rendering via @defer
├── app.css                        # App host layout and styling
├── app.config.ts                  # Application configuration (zoneless, service worker)
│
├── core/services/                 # Injected singleton services
│   ├── llm.service.ts             # MediaPipe LLM Inference runner & IndexedDB cache
│   ├── voice-assistant.service.ts # Continuous voice assistant & wake word detection
│   ├── speech.service.ts          # Web Speech API recognition & speech synthesis
│   ├── second-brain.service.ts    # Second Brain knowledge base & document organizer
│   ├── expense.service.ts         # Expense tracking, amortisation & persistence
│   ├── mediapipe-tasks.service.ts # MediaPipe Hands, FaceMesh, and Selfie Segmentation
│   ├── ocr.service.ts             # Tesseract.js local OCR worker
│   ├── pii.ts                     # PII pattern detection (IBAN, CF, Luhn card, VAT, IP)
│   ├── captioning.service.ts      # Image captioning bridge to Web Worker
│   ├── captioning.worker.ts       # Transformers.js background image captioning worker
│   ├── camera.ts                  # Webcam stream lifecycle & RAF frame loop
│   ├── base-indexed-db.service.ts # Abstract base class for IndexedDB storage
│   ├── knowledge-manager.service.ts # Knowledge base document store & RAG
│   ├── project.service.ts         # Project workspace document management
│   ├── text-processing.service.ts # Extractors for PDF, DOCX, PPTX, HTML, Markdown
│   ├── todo.service.ts            # Daily planner store with 20-level undo stack
│   ├── settings.service.ts        # User settings: tab ordering, visible tabs, theme
│   ├── storage.service.ts         # Safe localStorage wrapper
│   ├── toast.service.ts           # Signal-based toast notification queue
│   ├── syntax-highlight.service.ts# Code syntax highlighting
│   └── json-parser.service.ts     # Resilient JSON parser and markdown block extractor
│
├── components/                    # 21 Standalone Tab Components
│   ├── status-bar/                # Model status, WebGPU indicator, memory badge
│   ├── loader-overlay/            # Drag-and-drop model loader & cache selector
│   ├── info-modal/                # System information & privacy details
│   ├── voice-tab/                 # Voice assistant panel
│   ├── chat-tab/                  # Multi-turn conversational chat
│   ├── email-tab/                 # Email assistant
│   ├── meeting-tab/               # Speech recorder & meeting summarizer
│   ├── translate-tab/             # Offline multi-language translator
│   ├── todo-tab/                  # Smart daily planner
│   ├── expenses-tab/              # Expense tracking & amortisation analytics
│   ├── coding-tab/                # Code playground & generator
│   ├── agents-tab/                # Custom agents manager
│   ├── vision-tab/                # Computer vision & image analysis
│   ├── sicilian-gestures-tab/     # MediaPipe Sicilian hand gesture detection
│   ├── pinch-scroll-tab/          # Gesture-controlled touchless scrolling
│   ├── head-cursor-tab/           # Head tracking pointer navigation
│   ├── background-tab/            # Real-time virtual background replacement
│   ├── pii-ocr-tab/               # Document OCR with interactive PII redactor
│   ├── vision-assist-tab/         # Assistive camera vision & reading assistant
│   ├── learning-tab/              # RAG study tools, quizzes & mind maps
│   ├── presentation-tab/          # Slide presentation generator (.pptx)
│   ├── project-tab/               # Workspace project file manager
│   ├── brain-tab/                 # Second Brain folder explorer & notes
│   └── dev-agent-tab/             # Autonomous coding agent & diff viewer
│
└── shared/                        # Shared UI components & utilities
    ├── components/button/         # Reusable button component
    ├── components/confirm-dialog/ # Modal confirmation dialog
    ├── components/dropdown/       # Custom select/dropdown component
    ├── message-bubble/            # Chat message bubble with markdown & code copy
    ├── typing-indicator/          # Animated three-dot typing indicator
    └── resize.util.ts             # Panel resizer utility
```

---

## 🛠️ Key Commands

Run from the `ines-ng/` directory:

| Command                     | Action                                                |
| --------------------------- | ----------------------------------------------------- |
| `npm start`                 | Launch Angular dev server at `http://localhost:4200`  |
| `npm run build`             | Compile production build into `dist/ines-ng/browser/` |
| `npm test`                  | Run Vitest unit tests once (CI-friendly, 210+ tests)  |
| `npm run vitest`            | Run Vitest in interactive watch mode                  |
| `npm run cypress:run`       | Execute Cypress E2E headless test suite               |
| `npm run cypress:open`      | Open Cypress interactive E2E runner                   |
| `npx prettier --check src/` | Check code formatting across `src/`                   |
| `npx prettier --write src/` | Automatically format all source files                 |

---

## ⚡ Performance & Lazy Loading Architecture

To guarantee fast initial loading and maintain a tiny initial bundle (~1.5 MB total), INES leverages Angular's native `@defer` control flow:

- **Eager Shell**: The application shell, status bar, and default Chat tab load instantly.
- **On-Demand & Idle Prefetching**: All other 20 tabs are defined with `@defer (when activeTab() === '...'; prefetch on idle)`. Heavy dependencies (such as PptxGenJS, KaTeX, Tesseract.js, Mermaid, and MediaPipe Vision tasks) are isolated into on-demand lazy chunks.
- **Zero-Latency Switching**: When the browser is idle, Angular prefetches chunks in the background using `requestIdleCallback`, ensuring tab transitions are instantaneous.

---

## 📦 PWA & Offline Support

- **App Shell Caching**: `ngsw-config.json` caches the application shell, icons, fonts, and styles for complete offline usability.
- **Model Storage**: Model files (`.task`, `.litertlm`) are loaded directly into browser memory as `ArrayBuffer` and cached in IndexedDB (`InesModelCacheDB`) for instant page reloads.
- **Privacy Assurance**: No telemetry, no third-party APIs, and zero network calls during neural inference.

---

_INES — Intelligent Neural Edge System_  
_Built on [Google AI Edge](https://ai.google.dev/edge) · Powered by [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference) · Running locally in your browser_

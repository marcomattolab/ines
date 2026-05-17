# INES — Intelligent Neural Edge System

Intelligent Neural Edge System (INES) is a client side application that runs a large language model entirely in your browser. No server. No API key. No data leaving your device. It uses Google's MediaPipe LLM Inference API. It is a Single Page Application (SPA) based on **Angular 22** using Progressive Web App (PWA).

### Project Structure

```
ines-ng/src/app/
├── core/services/
│   ├── llm.service.ts          # MediaPipe LLM wrapper (Angular Signals)
│   ├── toast.service.ts        # Signal-based toast notification queue
│   └── todo.service.ts         # Todo CRUD + localStorage via effect()
├── components/
│   ├── status-bar/             # Top bar: brand + model status dot
│   ├── loader-overlay/         # File drop zone + progress bar
│   ├── chat-tab/               # Multi-turn streaming chat
│   ├── coding-tab/             # Code generation with live preview sandbox
│   ├── email-tab/              # Email rewriter (tone + action)
│   ├── meeting-tab/            # Speech → transcript → AI summary
│   ├── translate-tab/          # Debounced offline translator
│   └── todo-tab/               # Daily planner + AI generation
└── shared/
    ├── message-bubble/         # Reusable chat bubble component
    └── typing-indicator/       # Animated three-dot indicator
```

### PWA Configuration

- `manifest.webmanifest` — dark theme (`#0a0b0f`), standalone display, 8 icon sizes
- `ngsw-config.json` — app shell precaching (HTML, JS, CSS) via `@angular/service-worker`
- Service worker registered via `provideServiceWorker()` in `app.config.ts`
- Model files (`.task`, `.litertlm`) are **never cached** — user always selects them manually

### Development

```bash
# Start dev server
npm start                # → http://localhost:4200

# Production build
npm run build            # → dist/ines-ng/browser/

```

### Build Output

```
Initial chunk files  | Raw size  | Transfer size
main.js              | 245 kB    | 66 kB
styles.css           | 20 kB     | 2 kB
─────────────────────────────────────────────────
Total                | 265 kB    | 68 kB
```

### Verification

| Tab          | Status | Notes                                               |
| ------------ | ------ | --------------------------------------------------- |
| 💬 Chat      | ✅     | Loader overlay on first load, streaming responses   |
| ✉️ Email     | ✅     | Tone/action selectors, copy to clipboard            |
| 🎙️ Meeting   | ✅     | Record button, live transcript, AI summary          |
| 🌍 Translate | ✅     | Auto-detect, swap, debounced auto-translate         |
| ✅ Todo      | ✅     | Manual add, AI generation, localStorage persistence |
| 👨‍💻 Coding    | 🚧     | Coding Assistant                                    |

> **To use the AI features**, you need a `.task` model file (e.g. [Gemma-3 1B IT](https://huggingface.co/litert-community/Gemma3-1B-IT)) and Chrome/Edge with **WebGPU enabled**. The app is fully functional without a model — all UI works.

---

### 🧠 How it works

MediaPipe LLM Inference is injected using ES modules from CDN (no bundle step), then a single `LlmInference` instance is created and shared across all tabs via a custom `LlmService`. Tabs communicate with the service using a simple message-passing pattern (send message, wait for response). This keeps the logic contained and makes the app easy to reason about.

---

_INES — Intelligent Neural Edge System_
_Built on [Google AI Edge](https://ai.google.dev/edge) · Powered by [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference) · Running in your browser_

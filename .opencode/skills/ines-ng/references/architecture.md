# INES architecture — services and components

## Services (`src/app/core/services/`)

| Service | Responsibility |
| --- | --- |
| `llm.service.ts` | Single shared MediaPipe `LlmInference`; model init from File, URL, or IndexedDB cache (`InesModelCacheDB`); streaming `generate()` with retry; prompt building + sanitization; token estimation. Generation params are signals (`modelMaxTokens`, `topK`, `temperature`, `randomSeed`). |
| `agent.service.ts` | Agent + skills orchestration, skill export/import (Anthropic-style SKILL.md interop). |
| `vision.service.ts` | Webcam face/gesture/hand/pose detection. Caches MediaPipe `.task` models in IndexedDB (`InesVisionCacheDB`). |
| `speech.service.ts` | TTS + speech recognition. |
| `todo.service.ts` | Todo state persisted to `localStorage` via `effect()`. |
| `knowledge-manager.service.ts` | Knowledge base: documents, chunks, Q&As, import/export (`.ines-knowledge`). Extends `BaseIndexedDbService`. |
| `project.service.ts` | File-based project management. Extends `BaseIndexedDbService`. |
| `storage.service.ts` | `localStorage` abstraction, gated by `PrivacyService`. |
| `base-indexed-db.service.ts` | Abstract IndexedDB base for documents/chunks + keyword RAG scoring (`getRelevantChunks` / `getRagContext`). |
| `doc-fetch.service.ts` | Fetches remote docs (Angular guides) into the knowledge base. |
| `syntax-highlight.service.ts` | Code syntax highlighting (escapes HTML first). |
| `text-processing.service.ts` | PDF/DOCX/PPTX/HTML/TXT/MD extraction, chunking, keyword extraction, hashing. |
| `json-parser.service.ts` | Lenient JSON parsing helpers. |
| `dom-utils.service.ts` | `escapeHtml`, clipboard, download helpers. |
| `privacy.service.ts` | Privacy mode flag. |
| `toast.service.ts` | Toast notifications. |
| `presentation-prompt.ts` | Prompt template for the slides tab. |

> Note: `rag.service.ts` and `markdown.service.ts` were removed. RAG lives in
> `BaseIndexedDbService`; markdown rendering lives in the `message-bubble`
> component (`renderMessageHtml` + `DomSanitizer`).

## Components (`src/app/components/`)

| Component | Tab |
| --- | --- |
| `chat-tab` | Chat |
| `email-tab` | Email |
| `meeting-tab` | Meeting |
| `translate-tab` | Translate |
| `todo-tab` | Todo |
| `coding-tab` | Code |
| `agents-tab` | Agents |
| `vision-tab` | Vision |
| `learning-tab` | Learning |
| `presentation-tab` | Slides |
| `knowledge-manager-tab` | Knowledge |
| `project-tab` | Project |
| `dev-agent-tab` | DevAgent |
| `status-bar` | Global status bar |
| `loader-overlay` | Model-loading overlay |
| `info-modal` | Info dialog |

## Shared (`src/app/shared/`)

- `components/button`, `components/confirm-dialog`, `components/dropdown`
- `message-bubble` (AI/user message rendering + sanitization + copy/speak)
- `typing-indicator`
- `chat-input.directive.ts`, `resize.util.ts`

## LLM model loading flow

`AppComponent.ngOnInit()` tries, in order:

1. `LlmService.initModelFromCache()` — IndexedDB cached model.
2. `checkSessionFallback()` — if `sessionStorage.model_loaded_previously` is set,
   HEAD-check `/models/gemma3-1b-it-int8-web.task` (>100 MB) and stream via
   `initModelFromUrl()`.
3. Otherwise idle, waiting for the user to load a model file.

`initModel(file)` reads the whole file as an `ArrayBuffer` (no 2 GB cap — the old
blob-URL fallback was removed because the WASM runtime cannot fetch `blob:` URLs).
All load paths share `bootstrapWasm()`, `createLlm()`, and `markModelReady()`.
`generate()` enforces single-flight via `isBusy` and a `requestCooldown` between
requests, with exponential backoff retry.

## Vision model loading flow

`VisionService.initVision()` resolves each MediaPipe `.task` model through
`getModelBuffer(url)`, which checks `InesVisionCacheDB` first and otherwise
fetches + caches the model. Face/gesture/hand/pose models are loaded on demand
(hand/pose only when enabled).

## Test infrastructure

- `src/test-setup.ts`: zoneless `TestBed` (`provideZonelessChangeDetection()`,
  `provideHttpClient()`, `BrowserTestingModule` + `platformBrowserTesting()`).
- Service specs use `Injector.create(...)` and are co-located with services.
- Component spec: `shared/message-bubble/message-bubble.component.spec.ts` uses
  `ɵresolveComponentResources` to load `templateUrl`/`styleUrl` from disk, then
  tests the exported pure `renderMessageHtml()` against the real `DomSanitizer`
  (XSS regression coverage).

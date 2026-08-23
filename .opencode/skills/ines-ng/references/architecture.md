# INES architecture — services and components

## Services (`src/app/core/services/`)

| Service | Responsibility |
| --- | --- |
| `llm.service.ts` | Single shared MediaPipe `LlmInference`; model init from File, URL, or IndexedDB cache; streaming `generate()` with retry; prompt building + sanitization; token estimation. |
| `rag.service.ts` | Retrieval over PDF/HTML/TXT with keyword scoring (no embeddings). |
| `agent.service.ts` | Agent orchestration. |
| `vision.service.ts` | Vision/image analysis. |
| `speech.service.ts` | Speech recognition. |
| `todo.service.ts` | Todo state persisted to `localStorage` via `effect()`. |
| `knowledge-manager.service.ts` | Knowledge base management. |
| `project.service.ts` | Project state. |
| `storage.service.ts` | General storage abstraction. |
| `base-indexed-db.service.ts` | IndexedDB base helper (DB `InesModelCacheDB`). |
| `doc-fetch.service.ts` | Document fetching. |
| `markdown.service.ts` | Markdown rendering. |
| `syntax-highlight.service.ts` | Code syntax highlighting. |
| `text-processing.service.ts` | Text utilities. |
| `json-parser.service.ts` | JSON parsing helpers. |
| `dom-utils.service.ts` | DOM utilities. |
| `privacy.service.ts` | Privacy controls. |
| `toast.service.ts` | Toast notifications. |
| `presentation-prompt.ts` | Prompt templates for the presentation/slides tab. |

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
- `message-bubble`, `typing-indicator`
- `chat-input.directive.ts`, `resize.util.ts`

## LLM model loading flow

`AppComponent.ngOnInit()` tries, in order:

1. `LlmService.initModelFromCache()` — IndexedDB cached model.
2. `checkSessionFallback()` — if `sessionStorage.model_loaded_previously` is set,
   HEAD-check `/models/gemma3-1b-it-int8-web.task` (>100 MB) and stream via
   `initModelFromUrl()`.
3. Otherwise idle, waiting for the user to load a model file.

Model params are signals: `maxTokens` (8192), `topK` (40), `temperature` (0.8),
`randomSeed` (101). `generate()` enforces single-flight via `isBusy` and a
`requestCooldown` between requests, with exponential backoff retry.

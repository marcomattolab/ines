---
name: ines-ng
description: Development conventions and architecture for the INES Angular PWA. Use when working on any code under ines-ng/ — editing components, services, styles, the LLM/RAG pipeline, tests, or the PWA/service-worker config. Trigger on mentions of the INES app, its tabs (chat, email, meeting, translate, todo, coding, agents, vision, learning, slides, knowledge, project, dev-agent), LlmService, RagService, MediaPipe/Gemma model loading, or when running npm/vitest/cypress in ines-ng/.
---

# INES Angular PWA

All source lives in `ines-ng/` — an Angular 22 standalone PWA. The root `README.md`
and `resources/` are docs only. Only edit code under `ines-ng/src/app/`.

## Key commands (run from `ines-ng/`)

| Command | What |
|---|---|
| `npm start` | Dev server at `http://localhost:4200` |
| `npm run build` | Production build → `dist/ines-ng/browser/` |
| `npm run vitest` | Run Vitest unit tests |
| `npm run cypress:open` | Open Cypress E2E |
| `npm run cypress:run` | Run Cypress E2E headless |
| `npx prettier --check src/` | Format check |
| `npx prettier --write src/` | Format fix |

No ESLint, no typecheck script — only Prettier for code style
(`printWidth: 100`, `singleQuote: true`, HTML uses the `angular` parser).

## Architecture

- **Entry**: `src/main.ts` → `bootstrapApplication(AppComponent, appConfig)`.
- **Root**: `app.ts` defines 13 tabs (`Tab` union + `TABS` array) and keyboard
  shortcuts (Cmd/Ctrl+K palette, Cmd/Ctrl+1..9 tab jump). Tab state and theme
  persist via `sessionStorage`.
- **LLM**: `LlmService` wraps a single shared MediaPipe `LlmInference` instance,
  imported at runtime from the CDN via `new Function('url', 'return import(url)')`
  (bypasses static analysis). Model is passed as an `ArrayBuffer` via
  `modelAssetBuffer`, never as a blob URL.
- **Prompt format**: Gemma instruct (`<start_of_turn>user\n[SYSTEM]: ...\n[USER]: ...<end_of_turn>\n<start_of_turn>model\n`), built by `LlmService.buildPrompt()`. Inputs are sanitized by `sanitizePromptInput()`.
- **RAG**: `RagService` supports PDF/pdfjs-dist, HTML, TXT, using keyword scoring
  (no vector embeddings).
- **Todo persistence**: `localStorage` via `effect()` in `TodoService`.
- **Service worker**: production only (`isDevMode()` guard), registered in `appConfig`.
- **Model caching**: IndexedDB (`InesModelCacheDB`, `models` store, `cached_model` key)
  + `sessionStorage` flag `model_loaded_previously`.

See `references/architecture.md` for the full service and component inventory.

## CSS conventions

- **Per-component CSS files** — each component has its own `*.css` (`styleUrl`) for
  animations, keyframes, pseudo-elements, CDK drag-drop overrides, and complex
  selectors Tailwind can't express.
- **`src/styles.css`** — global design tokens only (`--bg-*`, `--text-*`,
  `--accent-*`, `--tab-*`, `--shadow-*`), resets, and shared component classes
  (panel-header, chat-area, button system, scrollbar, toast).
- Reference tokens via arbitrary values: `text-[var(--text-1)]`,
  `bg-[var(--bg-2)]`, `font-[var(--font-ui)]`.
- Host layout via `host: { class: 'flex flex-1 overflow-hidden min-w-0' }` — no
  `:host` CSS selectors.
- Prefer existing design tokens over raw Tailwind colors. Glass effects:
  `bg-[var(--bg-1)]`, `backdrop-blur-md`, `border border-[var(--border)]`.

## Testing quirks

- **No tests exist** for components (schematics set `skipTests: true`) — write test
  files manually as `*.spec.ts`.
- Unit: Vitest + jsdom, `vitest/globals` enabled (no imports needed for
  `describe`/`it`/`expect`).
- E2E: Cypress, `baseUrl: http://localhost:4200`, no support file.
- Use `src/app/core/services/toast.service.spec.ts` as the pattern.

## What this project does not have

- No CI/CD, no pre-commit hooks, no git workflow automation.
- No vector DB or embedding models — RAG uses simple word-match scoring.
- No authentication, no backend, no analytics/telemetry.

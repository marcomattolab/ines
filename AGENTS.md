# INES — Agent Guide

## Repo layout

All source lives in `ines-ng/` — an Angular 22 standalone PWA. The root `README.md` and `resources/` are docs only.

Only code under `ines-ng/src/app/` needs editing.

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

No ESLint, no typecheck script — only Prettier for code style.

## Testing quirks

- **No tests exist** for components (schematics set `skipTests: true`). You must write test files manually as `*.spec.ts`.
- Unit tests: Vitest + jsdom, `vitest/globals` enabled (no imports needed for `describe`/`it`/`expect`).
- E2E: Cypress, `baseUrl: http://localhost:4200`, no support file.
- Only one test file exists: `src/app/core/services/toast.service.spec.ts` — use it as a pattern.

## Architecture

- **Entry**: `src/main.ts` → `bootstrapApplication(AppComponent, appConfig)`
- **LLM**: `LlmService` wraps a single shared `LlmInference` instance (MediaPipe CDN import at runtime via `new Function`). Model passed as `ArrayBuffer` via `modelAssetBuffer`, never as blob URL.
- **Prompt format**: Gemma instruct format (`<start_of_turn>user\n[SYSTEM]: ...\n[USER]: ...<end_of_turn>\n<start_of_turn>model\n`), built by `LlmService.buildPrompt()`.
- **RAG**: `RagService` supports PDF/pdfjs-dist, HTML, TXT. Uses keyword scoring, not vector embeddings.
- **Todo persistence**: `localStorage` via `effect()` in `TodoService`.
- **Service worker**: production only (`isDevMode()` guard), registered in `appConfig`.
- **Model caching**: IndexedDB (`InesModelCacheDB` DB, `models` store, `cached_model` key) + `sessionStorage` flag.

## CSS conventions

- **Per-component CSS files** — each component has its own `*.css` file (referenced via `styleUrl`) for animations, keyframes, pseudo-elements, CDK drag-drop overrides, and complex selectors that Tailwind cannot express.
- **`src/styles.css`** — global design tokens only (`--bg-*`, `--text-*`, `--accent-*`, `--tab-*`, `--shadow-*`), resets, and shared component classes (panel-header, chat-area, button system, scrollbar, toast).
- Global CSS variables referenced via arbitrary values: `text-[var(--text-1)]`, `bg-[var(--bg-2)]`, `font-[var(--font-ui)]`.
- Host layout via `host: { class: 'flex flex-1 overflow-hidden min-w-0' }` — no `:host` CSS selectors.
- Custom properties win over Tailwind — prefer using the existing design tokens.
- Glass effects: `bg-[var(--bg-1)]`, `backdrop-blur-md`, `border border-[var(--border)]`.

## Prettier

- `printWidth: 100`, `singleQuote: true`
- HTML uses `angular` parser (also single-quoted attributes, no closing slash)

## PWA

- `ngsw-config.json`: app shell precached, model files (`.task`/`.litertlm`) explicitly excluded from service worker cache.
- Build output: `dist/ines-ng/browser/`.
- No deploy infra configured.

## What this project does not have

- No CI/CD, no pre-commit hooks, no git workflow automation.
- No vector DB or embedding models — RAG uses simple word-match scoring.
- No authentication, no backend, no analytics/telemetry.

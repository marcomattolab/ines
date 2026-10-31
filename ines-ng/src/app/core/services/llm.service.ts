import { Injectable, signal, computed } from '@angular/core';

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ProgressState {
  pct: number;
  label: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * LiteRT-LM Web API (the replacement for the deprecated MediaPipe LLM
 * Inference API). Pinned to an exact version because the JS API is currently
 * in Early Preview. WASM is auto-loaded from the package's `wasm/` directory.
 */
const LITERTLM_CORE_URL = 'https://cdn.jsdelivr.net/npm/@litert-lm/core@0.19.0/+esm';

// Shared dynamic-import promise — the module is loaded once per page.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let litertlmModulePromise: Promise<any> | null = null;

function importLiteRtLm(): Promise<any> {
  if (!litertlmModulePromise) {
    // Dynamic CDN import at runtime — Function() bypasses TS static analysis.
    litertlmModulePromise = new Function('url', 'return import(url)')(LITERTLM_CORE_URL);
  }
  return litertlmModulePromise!;
}

/** Extracts the text content from a LiteRT-LM streaming message chunk. */
function extractMessageText(msg: any): string {
  if (!msg) return '';
  const content = msg.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part?.type === 'text')
      .map((part: any) => part?.text ?? '')
      .join('');
  }
  return '';
}

@Injectable({ providedIn: 'root' })
export class LlmService {
  readonly modelStatus = signal<ModelStatus>('idle');
  readonly modelName = signal<string>('No model loaded');
  readonly progress = signal<ProgressState>({ pct: 0, label: '' });
  readonly isReady = computed(() => this.modelStatus() === 'ready');
  readonly isBusy = signal(false);

  readonly modelMaxTokens = signal(8192);
  readonly contextWindow = signal(8192);
  readonly temperature = signal(0.8);
  readonly randomSeed = signal(101);
  readonly topK = signal(40);
  readonly requestCooldown = signal(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private engine: any = null;
  private lastRequestTime = 0;

  /**
   * Builds a LiteRT-LM Engine from a model source (URL, File or Blob).
   * Passing the File/Blob directly — instead of buffering it into an
   * ArrayBuffer first — avoids duplicating a multi-GB model in memory, which
   * can otherwise crash the tab (white page) when loading large models.
   */
  private async createEngine(model: Blob | string): Promise<any> {
    const { Engine } = await importLiteRtLm();
    return Engine.create({ model });
  }

  /** Creates a fresh conversation with the system prompt and history as preface. */
  private async createConversation(
    system: string,
    history: ChatMessage[],
    maxOutputTokens?: number,
  ): Promise<any> {
    const { SamplerType } = await importLiteRtLm();
    return this.engine.createConversation({
      preface: {
        messages: [
          { role: 'system', content: system },
          ...history.map((h) => ({ role: h.role, content: h.content })),
        ],
      },
      sessionConfig: {
        maxOutputTokens: maxOutputTokens ?? this.modelMaxTokens(),
        samplerParams: {
          type: SamplerType.TOP_K,
          k: this.topK(),
          temperature: this.temperature(),
          seed: this.randomSeed(),
        },
      },
    });
  }

  private markModelReady(fileName: string): void {
    try {
      sessionStorage.setItem('model_loaded_previously', 'true');
    } catch (e) {
      console.warn('Failed to cache model in sessionStorage:', e);
    }
    this.setProgress(100, 'Model ready!');
    this.modelStatus.set('ready');
    this.modelName.set(fileName.replace(/\.(litertlm|task|bin)$/, ''));
  }

  async initModel(file: File): Promise<void> {
    this.modelStatus.set('loading');
    this.setProgress(5, 'Initializing LiteRT-LM runtime...');

    try {
      this.setProgress(30, 'Loading model into GPU (this can take a while)...');
      this.engine = await this.createEngine(file);

      // Cache in the background — don't block the UI on a multi-GB IndexedDB write.
      void this.saveModelToCache(file.name, file).catch((cacheErr) =>
        console.warn('Failed to cache model in IndexedDB:', cacheErr),
      );

      this.markModelReady(file.name);
    } catch (err: any) {
      console.error('Model load error:', err);
      this.modelStatus.set('error');
      this.modelName.set('Error: ' + (err?.message ?? err));
      throw err;
    }
  }

  async initModelFromUrl(url: string, fileName: string): Promise<void> {
    this.modelStatus.set('loading');
    this.setProgress(5, 'Connecting to model stream...');

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch model from ${url} (Status: ${response.status})`);
      }

      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength || '0', 10);
      let loaded = 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body reader is not available');
      }

      const chunks: BlobPart[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          if (total) {
            const pct = Math.floor((loaded / total) * 50); // Download is 0-50%
            this.setProgress(
              pct + 5,
              `Downloading model (${Math.round(loaded / 1024 / 1024)}MB)...`,
            );
          } else {
            this.setProgress(30, `Downloading model (${Math.round(loaded / 1024 / 1024)}MB)...`);
          }
        }
      }

      this.setProgress(55, 'Loading model into GPU (30–90 s)...');

      const modelBlob = new Blob(chunks);
      this.engine = await this.createEngine(modelBlob);

      this.setProgress(85, 'Caching model in browser storage...');
      void this.saveModelToCache(fileName, modelBlob).catch((cacheErr) =>
        console.warn(
          'Failed to cache model in IndexedDB (likely quota limit in incognito):',
          cacheErr,
        ),
      );

      this.markModelReady(fileName);
    } catch (err: any) {
      this.modelStatus.set('error');
      this.modelName.set('Error: ' + (err?.message ?? err));
      throw err;
    }
  }

  /**
   * Generates a response. `system` is the system prompt, `history` are prior
   * turns (user/assistant), and `userMsg` is the current user message.
   * `onToken` streams partial text; `done=true` fires once at the end.
   */
  async generate(
    system: string,
    userMsg: string,
    history: ChatMessage[] = [],
    onToken: (partial: string, done: boolean, full: string) => void,
    signal?: AbortSignal,
    maxOutputTokens?: number,
  ): Promise<string> {
    if (!this.engine) throw new Error('Model not loaded. Click "Load Model" first.');
    if (this.isBusy())
      throw new Error('Model is busy processing another request. Wait for it to finish.');

    const now = Date.now();
    if (now - this.lastRequestTime < this.requestCooldown()) {
      throw new Error(
        `Please wait ${Math.ceil((this.requestCooldown() - (now - this.lastRequestTime)) / 1000)}s before sending another request.`,
      );
    }

    this.isBusy.set(true);
    this.lastRequestTime = now;

    const emitted = { value: false };
    try {
      return await this.withRetry(
        () =>
          this.runGeneration(system, userMsg, history, onToken, signal, emitted, maxOutputTokens),
        signal,
        () => emitted.value,
      );
    } finally {
      this.isBusy.set(false);
    }
  }

  /** One full generation attempt (fresh conversation per call, like the old stateless API). */
  private async runGeneration(
    system: string,
    userMsg: string,
    history: ChatMessage[],
    onToken: (partial: string, done: boolean, full: string) => void,
    signal: AbortSignal | undefined,
    emitted: { value: boolean },
    maxOutputTokens?: number,
  ): Promise<string> {
    const conversation = await this.createConversation(system, history, maxOutputTokens);
    try {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const stream = conversation.sendMessageStreaming(userMsg);
      const reader = stream.getReader();

      let full = '';

      const onAbort = () => {
        // Cancelling the stream also cancels the underlying generation.
        void reader.cancel().catch(() => undefined);
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          if (done) break;
          const text = extractMessageText(value);
          if (text) {
            emitted.value = true;
            full += text;
            onToken(text, false, full);
          }
        }
      } finally {
        signal?.removeEventListener('abort', onAbort);
      }

      onToken('', true, full);
      return full;
    } finally {
      void conversation.delete().catch(() => undefined);
    }
  }

  private async withRetry(
    fn: () => Promise<string>,
    signal: AbortSignal | undefined,
    shouldAbortRetry: () => boolean,
  ): Promise<string> {
    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        // Never retry once partial output has been shown (avoids duplicated text).
        if (shouldAbortRetry() || attempt >= maxRetries) throw err;
        const delay = Math.pow(2, attempt) * 800;
        await new Promise((r) => setTimeout(r, delay));
        this.lastRequestTime = Date.now();
      }
    }
    throw lastError;
  }

  trimConversation(
    system: string,
    userMsg: string,
    history: ChatMessage[],
    maxTotalTokens = 384,
    reserveOutput = 128,
  ): ChatMessage[] {
    const maxInputTokens = maxTotalTokens - reserveOutput;
    const systemTokens = LlmService.estimateTokens(system);
    const userTokens = LlmService.estimateTokens(userMsg);
    let budget = maxInputTokens - systemTokens - userTokens;
    if (budget <= 0) return [];
    const trimmed: ChatMessage[] = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      const tokens = LlmService.estimateTokens(msg.content);
      if (tokens <= budget) {
        trimmed.unshift(msg);
        budget -= tokens;
      } else {
        break;
      }
    }
    return trimmed;
  }

  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private setProgress(pct: number, label: string) {
    this.progress.set({ pct, label });
  }

  async hasCachedModel(): Promise<boolean> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('models', 'readonly');
      const store = tx.objectStore('models');
      const request = store.get('cached_model');
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  async clearModelCache(): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('models', 'readwrite');
      const store = tx.objectStore('models');
      store.delete('cached_model');
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          try {
            sessionStorage.removeItem('model_loaded_previously');
          } catch {
            /* best effort */
          }
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async initModelFromCache(): Promise<boolean> {
    const cached = await this.getCachedModel();
    if (!cached) return false;

    this.modelStatus.set('loading');
    this.setProgress(10, 'Found cached model. Initializing LiteRT-LM...');

    try {
      this.setProgress(40, 'Loading cached model into GPU...');
      const model =
        cached.buffer instanceof ArrayBuffer
          ? new Blob([new Uint8Array(cached.buffer)])
          : cached.buffer;
      this.engine = await this.createEngine(model);
      this.markModelReady(cached.name);
      return true;
    } catch (err: any) {
      // A MediaPipe-era `.task` model (or a corrupt cache entry) cannot load
      // with LiteRT-LM. Invalidate it so the user can pick a `.litertlm` model.
      console.warn('Cached model failed to load with LiteRT-LM — clearing cache:', err);
      await this.clearModelCache().catch(() => undefined);
      this.modelStatus.set('idle');
      this.modelName.set('No model loaded');
      return false;
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('InesModelCacheDB', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('models')) {
          db.createObjectStore('models');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveModelToCache(name: string, model: Blob): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('models', 'readwrite');
      const store = tx.objectStore('models');
      store.put({ name, buffer: model }, 'cached_model');
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Transaction error'));
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  private async getCachedModel(): Promise<{ name: string; buffer: Blob | ArrayBuffer } | null> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('models', 'readonly');
      const store = tx.objectStore('models');
      const request = store.get('cached_model');
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Failed to retrieve cached model from IndexedDB:', e);
      return null;
    }
  }
}

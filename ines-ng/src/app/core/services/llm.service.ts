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

@Injectable({ providedIn: 'root' })
export class LlmService {
  readonly modelStatus = signal<ModelStatus>('idle');
  readonly modelName = signal<string>('No model loaded');
  readonly progress = signal<ProgressState>({ pct: 0, label: '' });
  readonly isReady = computed(() => this.modelStatus() === 'ready');
  readonly isBusy = signal(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private llm: any = null;

  async initModel(file: File): Promise<void> {
    this.modelStatus.set('loading');
    this.setProgress(10, 'Initializing WASM runtime...');

    try {
      const mediapipe = await new Function('url', 'return import(url)')(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai',
      );
      const { FilesetResolver, LlmInference } = mediapipe;

      const genai = await FilesetResolver.forGenAiTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm',
      );
      this.setProgress(40, 'WASM ready. Loading model into GPU...');

      const maxBufferSize = 2048 * 1024 * 1024;
      let loadedViaBuffer = false;

      if (file.size <= maxBufferSize) {
        try {
          const modelBuffer = await file.arrayBuffer();
          this.setProgress(60, 'Loading model into GPU (30–90 s)...');
          this.llm = await LlmInference.createFromOptions(genai, {
            baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer) },
            maxTokens: this.modelMaxTokens(),
            topK: this.topK(),
            temperature: this.temperature(),
            randomSeed: this.randomSeed(),
          });
          loadedViaBuffer = true;

          try {
            await this.saveModelToCache(file.name, modelBuffer);
          } catch (cacheErr) {
            console.warn('Failed to cache model in IndexedDB:', cacheErr);
          }
        } catch {
          console.warn('arrayBuffer failed, falling back to blob URL');
        }
      }

      if (!loadedViaBuffer) {
        this.setProgress(60, 'Streaming model into GPU...');
        const blobUrl = URL.createObjectURL(file);
        try {
          this.llm = await LlmInference.createFromModelPath(genai, blobUrl);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
        try {
          const buffer = await file.arrayBuffer();
          await this.saveModelToCache(file.name, buffer);
        } catch {
          /* cache is best-effort */
        }
      }

      try {
        sessionStorage.setItem('model_loaded_previously', 'true');
      } catch (e) {
        console.warn('Failed to cache model in sessionStorage:', e);
      }

      this.setProgress(100, 'Model ready!');
      this.modelStatus.set('ready');
      this.modelName.set(file.name.replace(/\.(task|litertlm|bin)$/, ''));
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
      // Dynamic CDN import at runtime — Function() bypasses TS static analysis
      const mediapipe = await new Function('url', 'return import(url)')(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai',
      );
      const { FilesetResolver, LlmInference } = mediapipe;

      const genai = await FilesetResolver.forGenAiTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm',
      );
      this.setProgress(10, 'WASM ready. Fetching model file...');

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

      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          if (total) {
            const pct = Math.floor((loaded / total) * 50); // Download is 0-50%
            this.setProgress(
              pct + 10,
              `Downloading model (${Math.round(loaded / 1024 / 1024)}MB)...`,
            );
          } else {
            this.setProgress(30, `Downloading model (${Math.round(loaded / 1024 / 1024)}MB)...`);
          }
        }
      }

      this.setProgress(60, 'Loading model into GPU (30–90 s)...');

      const modelBuffer = new Uint8Array(loaded);
      let pos = 0;
      for (const chunk of chunks) {
        modelBuffer.set(chunk, pos);
        pos += chunk.length;
      }

      this.llm = await LlmInference.createFromOptions(genai, {
        baseOptions: { modelAssetBuffer: modelBuffer },
        maxTokens: 8192,
        topK: 40,
        temperature: 0.8,
        randomSeed: 101,
      });

      this.setProgress(80, 'Caching model in browser storage...');
      try {
        await this.saveModelToCache(fileName, modelBuffer.buffer);
      } catch (cacheErr) {
        console.warn(
          'Failed to cache model in IndexedDB (likely quota limit in incognito):',
          cacheErr,
        );
      }

      try {
        sessionStorage.setItem('model_loaded_previously', 'true');
      } catch (e) {
        console.warn(
          'Failed to cache model in sessionStorage (likely quota limit in incognito):',
          e,
        );
      }

      this.setProgress(100, 'Model ready!');
      this.modelStatus.set('ready');
      this.modelName.set(fileName.replace(/\.(task|litertlm|bin)$/, ''));
    } catch (err: any) {
      this.modelStatus.set('error');
      this.modelName.set('Error: ' + (err?.message ?? err));
      throw err;
    }
  }

  readonly modelMaxTokens = signal(8192);
  readonly temperature = signal(0.8);
  readonly randomSeed = signal(101);
  readonly topK = signal(40);
  readonly requestCooldown = signal(0);
  private lastRequestTime = 0;

  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  generate(
    prompt: string,
    onToken: (partial: string, done: boolean, full: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!this.llm) throw new Error('Model not loaded. Click "Load Model" first.');
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

    let emittedTokens = false;

    const doGenerate = (): Promise<string> =>
      new Promise((resolve, reject) => {
        let full = '';
        if (signal?.aborted) {
          this.isBusy.set(false);
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        const onAbort = () => {
          this.isBusy.set(false);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        try {
          this.llm.generateResponse(prompt, (partial: string, done: boolean) => {
            if (partial) emittedTokens = true;
            full += partial;
            onToken(partial, done, full);
            if (done) {
              signal?.removeEventListener('abort', onAbort);
              this.isBusy.set(false);
              resolve(full);
            }
          });
        } catch (e) {
          signal?.removeEventListener('abort', onAbort);
          this.isBusy.set(false);
          reject(e);
        }
      });

    return this.withRetry(doGenerate, signal, () => emittedTokens);
  }

  private async withRetry(
    fn: () => Promise<string>,
    signal?: AbortSignal,
    shouldAbortRetry?: () => boolean,
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
        if (shouldAbortRetry?.()) throw err;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 800;
          await new Promise((r) => setTimeout(r, delay));
          this.lastRequestTime = Date.now();
        }
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

  buildPrompt(system: string, userMsg: string, history: ChatMessage[] = []): string {
    const safeUser = LlmService.sanitizePromptInput(userMsg);
    let p = `<start_of_turn>user\n[SYSTEM]: ${system}\n\n`;
    for (const h of history) {
      p += `[PREVIOUS ${h.role.toUpperCase()}]: ${LlmService.sanitizePromptInput(h.content)}\n`;
    }
    p += `[USER]: ${safeUser}<end_of_turn>\n<start_of_turn>model\n`;
    return p;
  }

  static sanitizePromptInput(text: string): string {
    return text
      .replace(/<\|endoftext\|>/gi, '')
      .replace(/<start_of_turn>/gi, '')
      .replace(/<end_of_turn>/gi, '')
      .replace(/<\|im_start\|>/gi, '')
      .replace(/<\|im_end\|>/gi, '')
      .replace(/<\|user\|>/gi, '')
      .replace(/<\|assistant\|>/gi, '')
      .replace(/<\|system\|>/gi, '');
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
          } catch {}
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
    this.setProgress(10, 'Found cached model. Initializing WASM...');

    try {
      const mediapipe = await new Function('url', 'return import(url)')(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai',
      );
      const { FilesetResolver, LlmInference } = mediapipe;

      const genai = await FilesetResolver.forGenAiTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm',
      );
      this.setProgress(40, 'WASM ready. Loading cached model into GPU...');

      this.llm = await LlmInference.createFromOptions(genai, {
        baseOptions: { modelAssetBuffer: new Uint8Array(cached.buffer) },
        maxTokens: 8192,
        topK: 40,
        temperature: 0.8,
        randomSeed: 101,
      });

      try {
        sessionStorage.setItem('model_loaded_previously', 'true');
      } catch (e) {
        console.warn(
          'Failed to cache model in sessionStorage (likely quota limit in incognito):',
          e,
        );
      }

      this.setProgress(100, 'Model ready!');
      this.modelStatus.set('ready');
      this.modelName.set(cached.name.replace(/\.(task|litertlm|bin)$/, ''));
      return true;
    } catch (err: any) {
      this.modelStatus.set('error');
      this.modelName.set('Error loading cached model: ' + (err?.message ?? err));
      throw err;
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

  private async saveModelToCache(name: string, buffer: ArrayBuffer): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('models', 'readwrite');
      const store = tx.objectStore('models');
      store.put({ name, buffer }, 'cached_model');
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Transaction error'));
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  private async getCachedModel(): Promise<{ name: string; buffer: ArrayBuffer } | null> {
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

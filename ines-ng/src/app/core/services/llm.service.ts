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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private llm: any = null;

  async initModel(file: File): Promise<void> {
    this.modelStatus.set('loading');
    this.setProgress(10, 'Initializing WASM runtime...');

    try {
      // Dynamic CDN import at runtime — Function() bypasses TS static analysis
      const mediapipe = await (new Function('url', 'return import(url)')(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai'
      ));
      const { FilesetResolver, LlmInference } = mediapipe;

      const genai = await FilesetResolver.forGenAiTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm'
      );
      this.setProgress(40, 'WASM ready. Reading file into memory...');

      const modelBuffer = await file.arrayBuffer();
      this.setProgress(60, 'Loading model into GPU (30–90 s)...');

      this.llm = await LlmInference.createFromOptions(genai, {
        baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer) },
        maxTokens: 1024,
        topK: 40,
        temperature: 0.8,
        randomSeed: 101,
      });

      this.setProgress(80, 'Caching model in browser storage...');
      try {
        await this.saveModelToCache(file.name, modelBuffer);
      } catch (cacheErr) {
        console.warn('Failed to cache model in IndexedDB (likely quota limit in incognito):', cacheErr);
      }

      try {
        sessionStorage.setItem('model_loaded_previously', 'true');
      } catch (e) {
        console.warn('Failed to cache model in sessionStorage (likely quota limit in incognito):', e);
      }

      this.setProgress(100, 'Model ready!');
      this.modelStatus.set('ready');
      this.modelName.set(file.name.replace(/\.(task|litertlm|bin)$/, ''));
    } catch (err: any) {
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
      const mediapipe = await (new Function('url', 'return import(url)')(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai'
      ));
      const { FilesetResolver, LlmInference } = mediapipe;

      const genai = await FilesetResolver.forGenAiTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm'
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
            this.setProgress(pct + 10, `Downloading model (${Math.round(loaded / 1024 / 1024)}MB)...`);
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
        maxTokens: 1024,
        topK: 40,
        temperature: 0.8,
        randomSeed: 101,
      });

      this.setProgress(80, 'Caching model in browser storage...');
      try {
        await this.saveModelToCache(fileName, modelBuffer.buffer);
      } catch (cacheErr) {
        console.warn('Failed to cache model in IndexedDB (likely quota limit in incognito):', cacheErr);
      }

      try {
        sessionStorage.setItem('model_loaded_previously', 'true');
      } catch (e) {
        console.warn('Failed to cache model in sessionStorage (likely quota limit in incognito):', e);
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

  generate(
    prompt: string,
    onToken: (partial: string, done: boolean, full: string) => void
  ): Promise<string> {
    if (!this.llm) throw new Error('Model not loaded. Click "Load Model" first.');
    return new Promise((resolve) => {
      let full = '';
      this.llm.generateResponse(prompt, (partial: string, done: boolean) => {
        full += partial;
        onToken(partial, done, full);
        if (done) resolve(full);
      });
    });
  }

  buildPrompt(system: string, userMsg: string, history: ChatMessage[] = []): string {
    let p = `<start_of_turn>user\n[SYSTEM]: ${system}\n\n`;
    for (const h of history) {
      p += `[PREVIOUS ${h.role.toUpperCase()}]: ${h.content}\n`;
    }
    p += `[USER]: ${userMsg}<end_of_turn>\n<start_of_turn>model\n`;
    return p;
  }

  private setProgress(pct: number, label: string) {
    this.progress.set({ pct, label });
  }

  async initModelFromCache(): Promise<boolean> {
    const cached = await this.getCachedModel();
    if (!cached) return false;

    this.modelStatus.set('loading');
    this.setProgress(10, 'Found cached model. Initializing WASM...');

    try {
      const mediapipe = await (new Function('url', 'return import(url)')(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai'
      ));
      const { FilesetResolver, LlmInference } = mediapipe;

      const genai = await FilesetResolver.forGenAiTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm'
      );
      this.setProgress(40, 'WASM ready. Loading cached model into GPU...');

      this.llm = await LlmInference.createFromOptions(genai, {
        baseOptions: { modelAssetBuffer: new Uint8Array(cached.buffer) },
        maxTokens: 1024,
        topK: 40,
        temperature: 0.8,
        randomSeed: 101,
      });

      try {
        sessionStorage.setItem('model_loaded_previously', 'true');
      } catch (e) {
        console.warn('Failed to cache model in sessionStorage (likely quota limit in incognito):', e);
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

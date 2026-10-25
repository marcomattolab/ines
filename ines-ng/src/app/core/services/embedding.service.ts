import { Injectable, signal } from '@angular/core';

const TASKS_TEXT_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-text';
const TASKS_TEXT_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-text@latest/wasm';
const EMBEDDER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/text_embedder/universal_sentence_encoder/float32/latest/universal_sentence_encoder.tflite';
const EMBEDDER_CACHE_DB = 'InesEmbedderCacheDB';
const EMBEDDER_CACHE_KEY = 'cached_embedder';

/** Cosine similarity between two vectors. Pure and exported for testing. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * On-device semantic embeddings via MediaPipe Text Embedder (Universal Sentence
 * Encoder). Used by the Second Brain for true semantic memory — the "indexed
 * filesystem" layer of the Karpathy LLM OS.
 *
 * The model is fetched once at runtime and runs entirely in the browser.
 * If it cannot load (offline, blocked, unsupported), the Second Brain
 * transparently falls back to the BM25 lexical index.
 */
@Injectable({ providedIn: 'root' })
export class EmbeddingService {
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly dimension = signal(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private embedder: any = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.status() === 'ready') return;
    if (this.status() === 'loading' && this.initPromise) return this.initPromise;
    this.initPromise = this.load();
    return this.initPromise;
  }

  private async load(): Promise<void> {
    this.status.set('loading');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tasksText: any = await new Function('url', 'return import(url)')(TASKS_TEXT_URL);
      const { FilesetResolver, TextEmbedder } = tasksText;
      const fileset = await FilesetResolver.forTextTasks(TASKS_TEXT_WASM_URL);
      const buffer = await this.getModelBuffer();
      this.embedder = await TextEmbedder.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: new Uint8Array(buffer) },
      });
      this.status.set('ready');
    } catch (e) {
      this.status.set('error');
      throw e;
    }
  }

  /** Loads the model from IndexedDB cache, downloading it once if needed. */
  private async getModelBuffer(): Promise<ArrayBuffer> {
    const cached = await this.getCachedModel();
    if (cached) return cached;
    const res = await fetch(EMBEDDER_MODEL_URL);
    if (!res.ok) throw new Error(`Failed to fetch embedder model (${res.status})`);
    const buffer = await res.arrayBuffer();
    void this.saveModelCache(buffer);
    return buffer;
  }

  private openCacheDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(EMBEDDER_CACHE_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('models')) {
          req.result.createObjectStore('models');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async getCachedModel(): Promise<ArrayBuffer | null> {
    try {
      const db = await this.openCacheDB();
      return new Promise((resolve) => {
        const tx = db.transaction('models', 'readonly');
        const req = tx.objectStore('models').get(EMBEDDER_CACHE_KEY);
        req.onsuccess = () => resolve(req.result?.buffer ?? null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  private async saveModelCache(buffer: ArrayBuffer): Promise<void> {
    try {
      const db = await this.openCacheDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('models', 'readwrite');
        tx.objectStore('models').put({ name: 'embedder', buffer }, EMBEDDER_CACHE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      /* best effort */
    }
  }

  /** Returns the embedding vector for a text, or null when unavailable. */
  embed(text: string): number[] | null {
    if (!this.embedder) return null;
    try {
      const result = this.embedder.embed((text || ' ').trim());
      const v = result?.embeddings?.[0]?.floatEmbedding;
      if (!v) return null;
      const arr = Array.from(v as Float32Array);
      if (!this.dimension()) this.dimension.set(arr.length);
      return arr;
    } catch {
      return null;
    }
  }
}

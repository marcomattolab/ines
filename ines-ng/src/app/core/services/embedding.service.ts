import { Injectable, signal } from '@angular/core';

/**
 * On-device semantic embeddings via the LiteRT-LM Embedding API (EmbeddingGemma 2
 * Text 270M), replacing the old MediaPipe Text Embedder (Universal Sentence
 * Encoder). EmbeddingGemma 2 is multilingual (100+ languages, incl. Italian),
 * which matters for INES, and supports Matryoshka dimensions (768d by default).
 *
 * The model is fetched once at runtime and runs entirely in the browser on CPU
 * (no WebGPU required for search). If it cannot load (offline, blocked,
 * unsupported), the Second Brain transparently falls back to the BM25 index.
 */
const LITERTLM_CORE_URL = 'https://cdn.jsdelivr.net/npm/@litert-lm/core@0.19.0/+esm';
const EMBEDDING_MODEL_URL =
  'https://huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm/resolve/main/embeddinggemma-2-text-270m.litertlm';
const EMBEDDER_CACHE_DB = 'InesEmbedderCacheDB';
const EMBEDDER_CACHE_KEY = 'cached_embedder';

/** Identity of the embedding model — bumped to invalidate stale stored vectors. */
export const EMBEDDING_MODEL_ID = 'embeddinggemma-2-text-270m-v1';
const EMBEDDING_MODEL_VERSION_KEY = 'ines_embedding_model_id';

// EmbeddingGemma 2 uses asymmetric task instruction prefixes.
const DOCUMENT_PREFIX = 'task: search result | text: ';
const QUERY_PREFIX = 'task: search query | text: ';

// Shared dynamic-import promise — the module is loaded once per page.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let litertlmModulePromise: Promise<any> | null = null;

function importLiteRtLm(): Promise<any> {
  if (!litertlmModulePromise) {
    litertlmModulePromise = new Function('url', 'return import(url)')(LITERTLM_CORE_URL);
  }
  return litertlmModulePromise!;
}

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

@Injectable({ providedIn: 'root' })
export class EmbeddingService {
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly dimension = signal(0);
  readonly modelId = EMBEDDING_MODEL_ID;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private engine: any = null;
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
      const { EmbeddingEngine, Backend } = await importLiteRtLm();
      const buffer = await this.getModelBuffer();
      // Run on CPU so semantic search works even without WebGPU.
      this.engine = await EmbeddingEngine.create({
        model: new Blob([new Uint8Array(buffer)]),
        backend: Backend.CPU,
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
    const res = await fetch(EMBEDDING_MODEL_URL);
    if (!res.ok) throw new Error(`Failed to fetch embedder model (${res.status})`);
    const buffer = await res.arrayBuffer();
    void this.saveModelCache(buffer);
    return buffer;
  }

  /** True if stored vectors were produced by the currently configured model. */
  isCurrentModel(): boolean {
    try {
      return localStorage.getItem(EMBEDDING_MODEL_VERSION_KEY) === this.modelId;
    } catch {
      return true;
    }
  }

  /** Marks the current model as the source of all stored vectors. */
  markCurrentModel(): void {
    try {
      localStorage.setItem(EMBEDDING_MODEL_VERSION_KEY, this.modelId);
    } catch {
      /* best effort */
    }
  }

  /** Embedding for an indexed document/note chunk. */
  async embedDocument(text: string): Promise<number[] | null> {
    return this.computeEmbedding((text || '').trim(), DOCUMENT_PREFIX);
  }

  /** Embedding for a search query. */
  async embedQuery(text: string): Promise<number[] | null> {
    return this.computeEmbedding((text || '').trim(), QUERY_PREFIX);
  }

  /** Batch embedding of document chunks (used for fast indexing/backfill). */
  async embedDocuments(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.engine) return texts.map(() => null);
    const inputs = texts.map((t) => DOCUMENT_PREFIX + (t || '').trim());
    try {
      const results = await this.engine.computeEmbeddingBatch(inputs, { normalize: true });
      return results.map((r: any) => {
        const arr: number[] = Array.from((r?.embedding ?? []) as number[]);
        if (!this.dimension() && arr.length) this.dimension.set(arr.length);
        return arr.length ? arr : null;
      });
    } catch {
      return texts.map(() => null);
    }
  }

  private async computeEmbedding(text: string, prefix: string): Promise<number[] | null> {
    if (!this.engine) return null;
    try {
      const result = await this.engine.computeEmbedding(prefix + text, { normalize: true });
      const arr: number[] = Array.from((result?.embedding ?? []) as number[]);
      if (!arr.length) return null;
      if (!this.dimension()) this.dimension.set(arr.length);
      return arr;
    } catch {
      return null;
    }
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
        tx.objectStore('models').put({ name: 'embeddinggemma-2', buffer }, EMBEDDER_CACHE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      /* best effort */
    }
  }
}

import { inject, signal } from '@angular/core';
import { TextProcessingService, TextChunk } from './text-processing.service';

export interface BaseDocument {
  id: string;
  name: string;
  type: string;
  date: number;
  size: number;
  hash: string;
}

export interface BaseChunk {
  id: string;
  docId: string;
  docName: string;
  text: string;
  position: number;
  keywords: string[];
  hash: string;
}

export interface ChunkWithScore<T extends BaseChunk> {
  chunk: T;
  score: number;
}

export interface RagResult {
  text: string;
  docName: string;
}

export abstract class BaseIndexedDbService<TDoc extends BaseDocument, TChunk extends BaseChunk> {
  protected textProc = inject(TextProcessingService);

  readonly documents = signal<TDoc[]>([]);
  readonly isProcessing = signal(false);
  readonly processingStatus = signal('');

  protected abstract readonly dbName: string;
  protected abstract readonly dbVersion: number;

  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  protected documentStore = 'documents';
  protected chunkStore = 'chunks';

  protected abstract onUpgrade(db: IDBDatabase): void;

  protected async ensureDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise.then(() => this.db!);
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.documentStore)) {
          db.createObjectStore(this.documentStore, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.chunkStore)) {
          const store = db.createObjectStore(this.chunkStore, { keyPath: 'id' });
          store.createIndex('docId', 'docId', { unique: false });
        }
        this.onUpgrade(db);
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    return this.initPromise.then(() => this.db!);
  }

  protected async getAllFromStore<T>(storeName: string): Promise<T[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  protected async putInStore(storeName: string, value: unknown): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  protected async deleteFromStore(storeName: string, id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  protected async clearStore(storeName: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadDocuments(): Promise<void> {
    const docs = await this.getAllFromStore<TDoc>(this.documentStore);
    this.documents.set(docs);
  }

  protected computeHash(text: string): Promise<string> {
    return this.textProc.computeHash(text);
  }

  protected chunkText(
    text: string,
    source: string,
    docId: string,
    chunkSize = 256,
    overlap = 32,
  ): Omit<TextChunk, 'id' | 'hash'>[] {
    return this.textProc.chunkText(text, source, docId, chunkSize, overlap);
  }

  async processFile(file: File): Promise<void> {
    const fileHash = await this.computeHash(`${file.name}${file.size}${file.lastModified}`);

    const existing = this.documents().find((d) => d.hash === fileHash);
    if (existing) throw new Error(`Duplicate: "${file.name}" is already indexed`);

    this.isProcessing.set(true);
    this.processingStatus.set(`Parsing "${file.name}"...`);

    try {
      const text = await this.textProc.extractTextFromFile(file);
      const extension = file.name.split('.').pop()?.toLowerCase();

      const docId = crypto.randomUUID();
      const doc: BaseDocument = {
        id: docId,
        name: file.name,
        type: extension || 'unknown',
        date: Date.now(),
        size: file.size,
        hash: fileHash,
      };

      this.processingStatus.set(`Chunking "${file.name}"...`);
      const rawChunks = this.chunkText(text, file.name, docId);

      const db = await this.ensureDB();
      const tx = db.transaction([this.documentStore, this.chunkStore], 'readwrite');
      const docStore = tx.objectStore(this.documentStore);
      const chunkStore = tx.objectStore(this.chunkStore);

      docStore.put(doc);

      for (const raw of rawChunks) {
        const chunkHash = await this.computeHash(raw.text);
        const chunk: BaseChunk = {
          id: crypto.randomUUID(),
          ...raw,
          hash: chunkHash,
        };
        chunkStore.put(chunk);
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      this.documents.update((list) => [...list, doc as TDoc]);
    } finally {
      this.isProcessing.set(false);
      this.processingStatus.set('');
    }
  }

  async getRelevantChunks(query: string, topK = 3, maxWords = 800): Promise<RagResult[]> {
    const allWords = query.toLowerCase().split(/\s+/);
    const queryWords = allWords.filter(
      (w) => w.length >= 2 && !TextProcessingService.STOP_WORDS.has(w),
    );

    if (queryWords.length === 0) return [];

    const allChunks = await this.getAllFromStore<TChunk>(this.chunkStore);
    if (allChunks.length === 0) return [];

    const queryLower = query.toLowerCase();

    const scored: ChunkWithScore<TChunk>[] = allChunks.map((chunk) => {
      let score = 0;
      const lower = chunk.text.toLowerCase();

      if (lower.includes(queryLower)) score += 5;

      for (const word of queryWords) {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        const matches = lower.match(regex);
        if (matches) score += matches.length;
      }

      const docKeywords = chunk.keywords || [];
      for (const kw of docKeywords) {
        if (queryWords.includes(kw)) score += 2;
      }

      const allFound = queryWords.every((w) => lower.includes(w));
      if (allFound) score += 3;

      return { chunk, score };
    });

    const sorted = scored.sort((a, b) => b.score - a.score);
    const result: RagResult[] = [];
    let wordCount = 0;

    for (const item of sorted) {
      if (item.score === 0 && result.length > 0) break;
      if (result.length >= topK) break;
      const chunkWords = item.chunk.text.split(/\s+/).length;
      if (result.length > 0 && wordCount + chunkWords > maxWords) break;
      result.push({ text: item.chunk.text, docName: item.chunk.docName });
      wordCount += chunkWords;
    }

    return result;
  }

  async getRagContext(query: string, topK = 3, maxWords = 800): Promise<string> {
    const chunks = await this.getRelevantChunks(query, topK, maxWords);
    if (chunks.length === 0) return '';
    return chunks.map((c) => `[${c.docName}]\n${c.text}`).join('\n\n---\n\n');
  }

  async deleteDocument(id: string): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction([this.documentStore, this.chunkStore], 'readwrite');
    const docStore = tx.objectStore(this.documentStore);
    const chunkIndex = tx.objectStore(this.chunkStore).index('docId');
    const chunkRequest = chunkIndex.getAllKeys(id);

    chunkRequest.onsuccess = () => {
      const chunkKeys = chunkRequest.result;
      const store = tx.objectStore(this.chunkStore);
      for (const key of chunkKeys) {
        store.delete(key);
      }
    };

    docStore.delete(id);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    this.documents.update((list) => list.filter((d) => d.id !== id));
  }

  async clearAll(): Promise<void> {
    await this.clearStore(this.documentStore);
    await this.clearStore(this.chunkStore);
    this.documents.set([]);
  }

  async countChunks(): Promise<number> {
    const chunks = await this.getAllFromStore<TChunk>(this.chunkStore);
    return chunks.length;
  }
}

import { Injectable, signal, inject } from '@angular/core';
import { TextProcessingService } from './text-processing.service';

export interface ProjectDocument {
  id: string;
  name: string;
  type: string;
  date: number;
  size: number;
  hash: string;
}

export interface ProjectChunk {
  id: string;
  docId: string;
  docName: string;
  text: string;
  position: number;
  keywords: string[];
  hash: string;
}

interface ChunkWithScore {
  chunk: ProjectChunk;
  score: number;
}

const DB_NAME = 'InesProjectDB';
const DB_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly textProc = inject(TextProcessingService);

  readonly documents = signal<ProjectDocument[]>([]);
  readonly isProcessing = signal(false);
  readonly processingStatus = signal('');

  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async ensureDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise.then(() => this.db!);
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chunks')) {
          const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
          chunkStore.createIndex('docId', 'docId', { unique: false });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    return this.initPromise.then(() => this.db!);
  }

  private async getAllFromStore<T>(storeName: string): Promise<T[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  private async clearStore(storeName: string): Promise<void> {
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
    const docs = await this.getAllFromStore<ProjectDocument>('documents');
    this.documents.set(docs);
  }

  private computeHash(text: string): Promise<string> {
    return this.textProc.computeHash(text);
  }

  private extractKeywords(text: string): string[] {
    return this.textProc.extractKeywords(text);
  }

  private chunkText(
    text: string,
    source: string,
    docId: string,
    chunkSize: number = 256,
    overlap: number = 32,
  ): Omit<ProjectChunk, 'id' | 'hash'>[] {
    return this.textProc.chunkText(text, source, docId, chunkSize, overlap);
  }

  async processFile(file: File): Promise<void> {
    const fileHash = await this.computeHash(file.name + file.size + file.lastModified);

    const existing = this.documents().find((d) => d.hash === fileHash);
    if (existing) throw new Error(`Duplicate: "${file.name}" already in project memory`);

    this.isProcessing.set(true);
    this.processingStatus.set(`Parsing "${file.name}"...`);

    try {
      const text = await this.textProc.extractTextFromFile(file);
      const extension = file.name.split('.').pop()?.toLowerCase();

      const docId = crypto.randomUUID();
      const doc: ProjectDocument = {
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
      const tx = db.transaction(['documents', 'chunks'], 'readwrite');
      const docStore = tx.objectStore('documents');
      const chunkStore = tx.objectStore('chunks');

      docStore.put(doc);

      for (const raw of rawChunks) {
        const chunkHash = await this.computeHash(raw.text);
        const chunk: ProjectChunk = {
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

      this.documents.update((list) => [...list, doc]);
    } finally {
      this.isProcessing.set(false);
      this.processingStatus.set('');
    }
  }

  async getRelevantChunks(
    query: string,
    topK: number = 3,
    maxWords: number = 800,
  ): Promise<{ text: string; docName: string }[]> {
    const allWords = query.toLowerCase().split(/\s+/);
    const queryWords = allWords.filter(
      (w) => w.length >= 2 && !TextProcessingService.STOP_WORDS.has(w),
    );

    if (queryWords.length === 0) return [];

    const allChunks = await this.getAllFromStore<ProjectChunk>('chunks');
    if (allChunks.length === 0) return [];

    const queryLower = query.toLowerCase();

    const scored: ChunkWithScore[] = allChunks.map((chunk) => {
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
    const result: { text: string; docName: string }[] = [];
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

  async deleteDocument(id: string): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction(['documents', 'chunks'], 'readwrite');
    const docStore = tx.objectStore('documents');
    const chunkIndex = tx.objectStore('chunks').index('docId');
    const chunkRequest = chunkIndex.getAllKeys(id);

    chunkRequest.onsuccess = () => {
      const chunkKeys = chunkRequest.result;
      const chunkStore = tx.objectStore('chunks');
      for (const key of chunkKeys) {
        chunkStore.delete(key);
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
    await this.clearStore('documents');
    await this.clearStore('chunks');
    this.documents.set([]);
  }

  async countChunks(): Promise<number> {
    const chunks = await this.getAllFromStore<ProjectChunk>('chunks');
    return chunks.length;
  }

  async getChunksForDocument(docId: string): Promise<ProjectChunk[]> {
    const all = await this.getAllFromStore<ProjectChunk>('chunks');
    return all.filter((c) => c.docId === docId).sort((a, b) => a.position - b.position);
  }

  async exportProject(): Promise<Blob> {
    const docs = await this.getAllFromStore<ProjectDocument>('documents');
    const chunks = await this.getAllFromStore<ProjectChunk>('chunks');
    const data = JSON.stringify(
      {
        version: 1,
        exported: Date.now(),
        documents: docs,
        chunks,
      },
      null,
      2,
    );
    return new Blob([data], { type: 'application/json' });
  }

  async importProject(file: File): Promise<void> {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.documents?.length) throw new Error('Invalid project file');

    const db = await this.ensureDB();
    const tx = db.transaction(['documents', 'chunks'], 'readwrite');
    const docStore = tx.objectStore('documents');
    const chunkStore = tx.objectStore('chunks');

    for (const doc of data.documents) {
      await new Promise<void>((resolve, reject) => {
        const req = docStore.put(doc);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    if (data.chunks) {
      for (const chunk of data.chunks) {
        await new Promise<void>((resolve, reject) => {
          const req = chunkStore.put(chunk);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

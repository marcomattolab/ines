import { Injectable } from '@angular/core';
import {
  BaseIndexedDbService,
  BaseDocument,
  BaseChunk,
  RagResult,
} from './base-indexed-db.service';

export interface KnowledgeDocument extends BaseDocument {
  tags: string[];
}

export interface KnowledgeChunk extends BaseChunk {}

export interface KnowledgeQA {
  id: string;
  question: string;
  answer: string;
  sources: { docName: string; text: string }[];
  date: number;
}

export interface ExportPayload {
  version: 1;
  date: number;
  documents: KnowledgeDocument[];
  chunks: KnowledgeChunk[];
  qas: KnowledgeQA[];
}

const DB_NAME = 'InesKnowledgeDB';
const DB_VERSION = 1;
const QA_STORE = 'qas';
const GRAPH_STORE = 'graph';

@Injectable({ providedIn: 'root' })
export class KnowledgeManagerService extends BaseIndexedDbService<
  KnowledgeDocument,
  KnowledgeChunk
> {
  protected override readonly dbName = DB_NAME;
  protected override readonly dbVersion = DB_VERSION;

  protected override onUpgrade(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(QA_STORE)) {
      db.createObjectStore(QA_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(GRAPH_STORE)) {
      db.createObjectStore(GRAPH_STORE, { keyPath: 'id' });
    }
  }

  override async clearAll(): Promise<void> {
    await super.clearAll();
    await this.clearStore(QA_STORE);
    await this.clearStore(GRAPH_STORE);
  }

  async getChunksByDocName(docName: string): Promise<{ text: string; position: number }[]> {
    const all = await this.getAllFromStore<KnowledgeChunk>('chunks');
    return all
      .filter((c) => c.docName === docName)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ text: c.text, position: c.position }));
  }

  async saveQA(
    question: string,
    answer: string,
    sources: { docName: string; text: string }[],
  ): Promise<void> {
    const qa: KnowledgeQA = {
      id: crypto.randomUUID(),
      question,
      answer,
      sources,
      date: Date.now(),
    };
    await this.putInStore(QA_STORE, qa);
  }

  async getQAs(): Promise<KnowledgeQA[]> {
    const all = await this.getAllFromStore<KnowledgeQA>(QA_STORE);
    return all.sort((a, b) => b.date - a.date);
  }

  async deleteQA(id: string): Promise<void> {
    await this.deleteFromStore(QA_STORE, id);
  }

  async exportKnowledgeBase(): Promise<Blob> {
    const documents = await this.getAllFromStore<KnowledgeDocument>('documents');
    const chunks = await this.getAllFromStore<KnowledgeChunk>('chunks');
    const qas = await this.getAllFromStore<KnowledgeQA>(QA_STORE);

    const payload: ExportPayload = {
      version: 1,
      date: Date.now(),
      documents,
      chunks,
      qas,
    };

    const json = JSON.stringify(payload);
    return new Blob([json], { type: 'application/json' });
  }

  async importKnowledgeBase(
    file: File,
  ): Promise<{ docsAdded: number; chunksAdded: number; qasAdded: number; duplicates: number }> {
    const text = await file.text();
    let payload: ExportPayload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('Invalid knowledge base file');
    }

    if (!payload.version || !Array.isArray(payload.documents)) {
      throw new Error('Invalid knowledge base format');
    }

    const db = await this.ensureDB();
    let docsAdded = 0;
    let chunksAdded = 0;
    let qasAdded = 0;
    let duplicates = 0;

    const existingDocs = await this.getAllFromStore<KnowledgeDocument>('documents');
    const existingHashes = new Set(existingDocs.map((d) => d.hash));
    const existingIds = new Set(existingDocs.map((d) => d.id));

    const tx = db.transaction(['documents', 'chunks', QA_STORE], 'readwrite');
    const docStore = tx.objectStore('documents');
    const chunkStore = tx.objectStore('chunks');
    const qaStore = tx.objectStore(QA_STORE);

    for (const doc of payload.documents) {
      if (existingHashes.has(doc.hash)) {
        duplicates++;
        continue;
      }
      const newId = crypto.randomUUID();
      docStore.put({ ...doc, id: newId });
      docsAdded++;

      const docChunks = payload.chunks.filter((c) => c.docId === doc.id);
      for (const c of docChunks) {
        chunkStore.put({ ...c, id: crypto.randomUUID(), docId: newId });
        chunksAdded++;
      }
    }

    for (const qa of payload.qas || []) {
      if (!existingIds.has(qa.id)) {
        qaStore.put(qa);
        qasAdded++;
      }
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await this.loadDocuments();
    return { docsAdded, chunksAdded, qasAdded, duplicates };
  }
}

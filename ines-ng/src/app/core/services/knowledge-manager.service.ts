import { Injectable, signal } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface KnowledgeDocument {
  id: string;
  name: string;
  type: string;
  date: number;
  size: number;
  hash: string;
  tags: string[];
}

export interface KnowledgeChunk {
  id: string;
  docId: string;
  docName: string;
  text: string;
  position: number;
  keywords: string[];
  hash: string;
}

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

interface ChunkWithScore {
  chunk: KnowledgeChunk;
  score: number;
}

const DB_NAME = 'InesKnowledgeDB';
const DB_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class KnowledgeManagerService {
  readonly documents = signal<KnowledgeDocument[]>([]);
  readonly isProcessing = signal(false);
  readonly processingStatus = signal('');

  static readonly STOP_WORDS: Record<string, readonly string[]> = {
    en: [
      'the',
      'a',
      'an',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'and',
      'or',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'shall',
      'can',
      'with',
      'from',
      'by',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'out',
      'off',
      'over',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'every',
      'both',
      'few',
      'more',
      'most',
      'some',
      'any',
      'no',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'because',
      'but',
      'which',
      'who',
      'whom',
      'what',
      'this',
      'that',
      'these',
      'those',
      'its',
      'it',
      'i',
      'me',
      'my',
      'we',
      'our',
      'you',
      'your',
      'he',
      'she',
      'his',
      'her',
      'they',
      'them',
      'their',
      'about',
      'up',
      'down',
      'also',
      'although',
      'though',
      'unless',
      'until',
      'while',
      'whether',
      'either',
      'neither',
      'without',
      'within',
      'across',
      'along',
      'around',
      'among',
      'behind',
      'beneath',
      'beside',
      'beyond',
      'despite',
      'except',
      'inside',
      'outside',
      'since',
      'toward',
      'towards',
      'upon',
      'via',
      'else',
      'even',
      'still',
      'already',
      'yet',
      'enough',
      'such',
      'rather',
      'quite',
      'well',
      'much',
      'many',
      'several',
    ],
    it: [
      'il',
      'lo',
      'la',
      'le',
      'gli',
      'un',
      'una',
      'uno',
      'di',
      'a',
      'da',
      'in',
      'con',
      'su',
      'per',
      'tra',
      'fra',
      'del',
      'dello',
      'della',
      'delle',
      'degli',
      'dei',
      'al',
      'allo',
      'alla',
      'alle',
      'agli',
      'dal',
      'dallo',
      'dalla',
      'dalle',
      'dagli',
      'nel',
      'nello',
      'nella',
      'nelle',
      'negli',
      'sul',
      'sullo',
      'sulla',
      'sulle',
      'sugli',
      'che',
      'chi',
      'cui',
      'quale',
      'quali',
      'quanto',
      'come',
      'dove',
      'quando',
      'perché',
      'perche',
      'e',
      'ed',
      'o',
      'ma',
      'anche',
      'se',
      'però',
      'pero',
      'mentre',
      'poiché',
      'poiche',
      'siccome',
      'non',
      'più',
      'piu',
      'meno',
      'molto',
      'tanto',
      'poco',
      'troppo',
      'già',
      'gia',
      'ancora',
      'sempre',
      'mai',
      'appena',
      'solo',
      'pure',
      'poi',
      'dopo',
      'prima',
      'ora',
      'adesso',
      'qui',
      'qua',
      'lì',
      'la',
      'ci',
      'si',
      'vi',
      'ne',
      'mi',
      'ti',
      'lo',
      'la',
      'li',
      'le',
      'mio',
      'tuo',
      'suo',
      'nostro',
      'vostro',
      'loro',
      'questa',
      'questo',
      'questi',
      'queste',
      'quella',
      'quello',
      'quelle',
      'quelli',
      'stessa',
      'stesso',
      'stesse',
      'stessi',
      'qualche',
      'ogni',
      'tutto',
      'tutta',
      'tutti',
      'tutte',
      'sono',
      'sia',
      'siamo',
      'siete',
      'era',
      'erano',
      'sarà',
      'sara',
      'ha',
      'hai',
      'hanno',
      'ho',
      'abbiamo',
      'avete',
      'avere',
      'essere',
      'fare',
      'stare',
      'dire',
      'volere',
      'potere',
      'posso',
      'puoi',
      'può',
      'puo',
      'possiamo',
      'potete',
      'possono',
      'voglio',
      'vuoi',
      'vuole',
      'vogliamo',
      'volete',
      'vogliono',
      'devo',
      'devi',
      'deve',
      'dobbiamo',
      'dovete',
      'devono',
      'sapere',
      'vedere',
      'venire',
      'dare',
      'parlare',
      'trovare',
      'pensare',
      'credere',
      'prendere',
      'chiedere',
      'lasciare',
      'cercare',
      'lavorare',
      'studiare',
      'leggere',
      'scrivere',
      'capire',
      'vivere',
      'morire',
      'nascere',
      'crescere',
      'cominciare',
      'finire',
      'continuare',
      'restare',
      'rimanere',
      'diventare',
      'sembrare',
      'servire',
      'bastare',
      'mancare',
      'piacere',
      'succedere',
      'valere',
      'contenere',
      'ottenere',
      'ricevere',
      'offrire',
      'decidere',
      'dividere',
      'vincere',
      'perdere',
      'salire',
      'scendere',
      'cadere',
      'mettere',
      'tenere',
      'portare',
      'guardare',
      'sentire',
      'importare',
      'cambiare',
      'passare',
      'arrivare',
      'partire',
      'tornare',
      'entrare',
      'uscire',
      'aprire',
      'chiudere',
      'accendere',
      'spegnere',
      'invece',
      'inoltre',
      'quindi',
      'pertanto',
      'dunque',
      'cioè',
      'cioe',
      'tuttavia',
      'altrimenti',
      'comunque',
      'anzi',
      'oppure',
      'ovvero',
      'ossia',
      'infatti',
      'davvero',
      'forse',
      'probabilmente',
      'certamente',
      'sicuramente',
      'veramente',
    ],
    fr: [],
    ch: [],
  };

  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly _stopWords = new Set(Object.values(KnowledgeManagerService.STOP_WORDS).flat());

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
        if (!db.objectStoreNames.contains('qas')) {
          db.createObjectStore('qas', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('graph')) {
          db.createObjectStore('graph', { keyPath: 'id' });
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

  private async putInStore(storeName: string, value: any): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async deleteFromStore(storeName: string, id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
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
    const docs = await this.getAllFromStore<KnowledgeDocument>('documents');
    this.documents.set(docs);
  }

  private async computeHash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    return Array.from(new Set(words.filter((w) => w.length >= 2 && !this._stopWords.has(w))));
  }

  private chunkText(
    text: string,
    source: string,
    docId: string,
    chunkSize: number = 256,
    overlap: number = 32,
  ): Omit<KnowledgeChunk, 'id' | 'hash'>[] {
    const words = text.split(/\s+/);
    const result: Omit<KnowledgeChunk, 'id' | 'hash'>[] = [];
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunkWords = words.slice(i, i + chunkSize);
      const chunkText = chunkWords.join(' ');
      result.push({
        text: chunkText,
        docId,
        docName: source,
        position: i,
        keywords: this.extractKeywords(chunkText),
      });
      if (i + chunkSize >= words.length) break;
    }
    return result;
  }

  private async extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      disableFontFace: false,
    }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(' ') + '\n';
    }
    return fullText;
  }

  private async extractTextFromHtml(file: File): Promise<string> {
    const html = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body.innerText || '';
  }

  async processFile(file: File): Promise<void> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const fileHash = await this.computeHash(file.name + file.size + file.lastModified);

    const existing = this.documents().find((d) => d.hash === fileHash);
    if (existing) throw new Error(`Duplicate: "${file.name}" already in knowledge base`);

    this.isProcessing.set(true);
    this.processingStatus.set(`Parsing "${file.name}"...`);

    try {
      let text = '';
      if (file.type === 'application/pdf' || extension === 'pdf') {
        text = await this.extractTextFromPdf(file);
      } else if (file.type === 'text/html' || extension === 'html' || extension === 'htm') {
        text = await this.extractTextFromHtml(file);
      } else if (file.type === 'text/plain' || extension === 'txt') {
        text = await file.text();
      } else if (extension === 'md') {
        text = await file.text();
      } else {
        throw new Error(`Unsupported file type: ${extension}`);
      }

      const docId = crypto.randomUUID();
      const doc: KnowledgeDocument = {
        id: docId,
        name: file.name,
        type: extension || 'unknown',
        date: Date.now(),
        size: file.size,
        hash: fileHash,
        tags: [],
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
        const chunk: KnowledgeChunk = {
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
    const queryWords = allWords.filter((w) => w.length >= 2 && !this._stopWords.has(w));

    if (queryWords.length === 0) return [];

    const allChunks = await this.getAllFromStore<KnowledgeChunk>('chunks');
    if (allChunks.length === 0) return [];

    const queryLower = query.toLowerCase();

    const scored: ChunkWithScore[] = allChunks.map((chunk) => {
      let score = 0;
      const lower = chunk.text.toLowerCase();

      // Score 1: exact phrase match (highest weight)
      if (lower.includes(queryLower)) score += 5;

      // Score 2: individual keyword matches (word-boundary only)
      for (const word of queryWords) {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        const matches = lower.match(regex);
        if (matches) {
          score += matches.length;
        }
      }

      // Score 3: keyword overlap with pre-computed doc keywords
      const docKeywords = chunk.keywords || [];
      for (const kw of docKeywords) {
        if (queryWords.includes(kw)) score += 2;
      }

      // Score 4: all query words found in chunk (bonus for completeness)
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

  async getChunksByDocName(docName: string): Promise<{ text: string; position: number }[]> {
    const all = await this.getAllFromStore<KnowledgeChunk>('chunks');
    return all
      .filter((c) => c.docName === docName)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ text: c.text, position: c.position }));
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
    await this.putInStore('qas', qa);
  }

  async getQAs(): Promise<KnowledgeQA[]> {
    const all = await this.getAllFromStore<KnowledgeQA>('qas');
    return all.sort((a, b) => b.date - a.date);
  }

  async deleteQA(id: string): Promise<void> {
    await this.deleteFromStore('qas', id);
  }

  async exportKnowledgeBase(): Promise<Blob> {
    const documents = await this.getAllFromStore<KnowledgeDocument>('documents');
    const chunks = await this.getAllFromStore<KnowledgeChunk>('chunks');
    const qas = await this.getAllFromStore<KnowledgeQA>('qas');

    const payload: ExportPayload = {
      version: 1,
      date: Date.now(),
      documents,
      chunks,
      qas,
    };

    const json = JSON.stringify(payload);
    const compressed = new Blob([json], { type: 'application/json' });
    return compressed;
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

    const tx = db.transaction(['documents', 'chunks', 'qas'], 'readwrite');
    const docStore = tx.objectStore('documents');
    const chunkStore = tx.objectStore('chunks');
    const qaStore = tx.objectStore('qas');

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

  async clearAll(): Promise<void> {
    await this.clearStore('documents');
    await this.clearStore('chunks');
    await this.clearStore('qas');
    await this.clearStore('graph');
    this.documents.set([]);
  }

  async countChunks(): Promise<number> {
    const chunks = await this.getAllFromStore<KnowledgeChunk>('chunks');
    return chunks.length;
  }
}

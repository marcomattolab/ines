import { Injectable, signal } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

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
  readonly documents = signal<ProjectDocument[]>([]);
  readonly isProcessing = signal(false);
  readonly processingStatus = signal('');

  private static readonly STOP_WORDS = new Set([
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
    'li',
    'ci',
    'si',
    'vi',
    'ne',
    'mi',
    'ti',
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
  ]);

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
    return Array.from(
      new Set(words.filter((w) => w.length >= 2 && !ProjectService.STOP_WORDS.has(w))),
    );
  }

  private chunkText(
    text: string,
    source: string,
    docId: string,
    chunkSize: number = 256,
    overlap: number = 32,
  ): Omit<ProjectChunk, 'id' | 'hash'>[] {
    const words = text.split(/\s+/);
    const result: Omit<ProjectChunk, 'id' | 'hash'>[] = [];
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
    if (existing) throw new Error(`Duplicate: "${file.name}" already in project memory`);

    this.isProcessing.set(true);
    this.processingStatus.set(`Parsing "${file.name}"...`);

    try {
      let text = '';
      if (file.type === 'application/pdf' || extension === 'pdf') {
        text = await this.extractTextFromPdf(file);
      } else if (file.type === 'text/html' || extension === 'html' || extension === 'htm') {
        text = await this.extractTextFromHtml(file);
      } else if (file.type === 'text/plain' || extension === 'txt' || extension === 'md') {
        text = await file.text();
      } else {
        throw new Error(`Unsupported file type: ${extension}`);
      }

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
    const queryWords = allWords.filter((w) => w.length >= 2 && !ProjectService.STOP_WORDS.has(w));

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

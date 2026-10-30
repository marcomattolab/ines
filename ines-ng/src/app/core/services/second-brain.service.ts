import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { StorageService } from './storage.service';
import { LlmService } from './llm.service';
import { KnowledgeManagerService } from './knowledge-manager.service';
import { EmbeddingService, cosineSimilarity } from './embedding.service';

export interface BrainNote {
  id: string;
  text: string;
  tags: string[];
  source: 'voice' | 'typed' | 'agent';
  date: number;
  pinned: boolean;
  /** Working memory ("note") vs compressed long-term memory ("memory"). */
  kind: 'note' | 'memory';
  /** Folder in the second brain filesystem ("Inbox", "Work", "Projects", …). */
  folder: string;
  /** Optional semantic embedding vector (set when the embedder is available). */
  embedding?: number[];
}

const STORAGE_KEY = 'ines_brain_notes';
const FOLDERS_KEY = 'ines_brain_folders';

/** Top-level folders of the second brain filesystem (Karpathy LLM OS). */
export const DEFAULT_FOLDERS = [
  'Inbox',
  'Notes',
  'Documents',
  'Memories',
  'Work',
  'Personal',
  'Projects',
];

const RECALL_SYSTEM = `You are INES's memory (the user's "second brain"). Answer based on the user's saved notes and documents.
Cite the source (a note or a document name) when you use it. If the memory does not contain the answer, say so clearly and then answer from your own knowledge if appropriate.
Answer in the same language as the user. Be concise and conversational, suitable to be read aloud.`;

const CONSOLIDATE_SYSTEM = `You are INES's long-term memory. Compress the following notes into ONE concise memory paragraph that preserves the key facts, decisions and ideas.
Merge related items and drop trivial details. Write in the same language as the notes. Output only the memory text, nothing else.`;

/**
 * Stop words (English + Italian) removed during indexing.
 * Kept small and explicit for on-device use.
 */
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'for',
  'nor',
  'so',
  'yet',
  'in',
  'on',
  'at',
  'to',
  'from',
  'of',
  'by',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'i',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'me',
  'my',
  'your',
  'our',
  'their',
  'this',
  'that',
  'these',
  'those',
  'do',
  'does',
  'did',
  'not',
  'no',
  'yes',
  'have',
  'has',
  'had',
  'can',
  'could',
  'will',
  'would',
  'should',
  'about',
  'what',
  'when',
  'where',
  'which',
  'who',
  'how',
  'why',
  'if',
  'then',
  'than',
  'as',
  'il',
  'lo',
  'la',
  'i',
  'gli',
  'le',
  'un',
  'uno',
  'una',
  'di',
  'da',
  'con',
  'su',
  'per',
  'tra',
  'fra',
  'e',
  'o',
  'ma',
  'che',
  'chi',
  'come',
  'cosa',
  'dove',
  'quando',
  'perche',
  'se',
  'non',
  'sono',
  'era',
  'mi',
  'ti',
  'si',
  'ci',
  'vi',
  'mio',
  'mia',
  'miei',
  'mie',
  'tuo',
  'tua',
  'tuoi',
  'sue',
  'del',
  'della',
  'dei',
  'delle',
  'al',
  'allo',
  'alla',
  'ai',
  'alle',
  'nel',
  'nello',
  'nella',
  'nei',
  'nelle',
  'questo',
  'questa',
  'questi',
  'queste',
  'quello',
  'quella',
  'quelli',
]);

/** Extracts #hashtags from a note. Exported for unit testing. */
export function extractTags(text: string): string[] {
  const tags = Array.from(text.matchAll(/#([\wÀ-ÿ-]+)/g)).map((m) => m[1].toLowerCase());
  return [...new Set(tags)];
}

/** Tokenizes text for the memory index (lowercase, stop-word removal). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9à-ÿ]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/**
 * BM25-ranked retrieval over the notes — a real relevance index rather than
 * naive substring matching (the "filesystem" layer of the LLM OS).
 */
/** Semantic ranking via embedding vectors (used when the embedder is loaded). */
export function rankByEmbedding(notes: BrainNote[], queryEmbedding: number[]): BrainNote[] {
  return notes
    .map((n) => ({
      n,
      score: n.embedding ? cosineSimilarity(n.embedding, queryEmbedding) : 0,
    }))
    .filter((x) => x.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.n);
}

export function searchNotes(notes: BrainNote[], query: string): BrainNote[] {
  const q = query.trim();
  if (!q) return notes;
  const queryTerms = tokenize(q);
  if (queryTerms.length === 0) return [];

  const indexed = notes.map((n) => ({
    n,
    tokens: tokenize(n.text),
    tags: n.tags.map((t) => t.toLowerCase()),
  }));
  const N = indexed.length;
  const avgdl = indexed.reduce((sum, d) => sum + d.tokens.length, 0) / Math.max(1, N);

  const df = new Map<string, number>();
  for (const t of queryTerms) {
    df.set(t, indexed.filter((d) => d.tokens.includes(t) || d.tags.includes(t)).length);
  }

  const scored = indexed.map((d) => {
    let score = 0;
    for (const t of queryTerms) {
      let tf = 0;
      for (const tok of d.tokens) if (tok === t) tf++;
      if (d.tags.includes(t)) tf += 2;
      if (tf === 0) continue;
      const n = df.get(t) || 0;
      const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);
      const denom = tf + 1.5 * (1 - 0.75 + 0.75 * (d.tokens.length / avgdl));
      score += (idf * (tf * 2.5)) / denom;
    }
    return { n: d.n, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.n);
}

@Injectable({ providedIn: 'root' })
export class SecondBrainService {
  private readonly storage = inject(StorageService);
  private readonly llm = inject(LlmService);
  private readonly km = inject(KnowledgeManagerService);
  readonly embeddings = inject(EmbeddingService);

  readonly notes = signal<BrainNote[]>(
    (this.storage.get<BrainNote[]>(STORAGE_KEY) ?? []).map((n) => ({
      ...n,
      kind: n.kind ?? 'note',
      folder: n.folder ?? 'Inbox',
    })),
  );

  /** Explicit folder paths (so empty folders can exist), incl. nested ones. */
  readonly folders = signal<string[]>([
    ...new Set([...DEFAULT_FOLDERS, ...(this.storage.get<string[]>(FOLDERS_KEY) ?? [])]),
  ]);

  readonly stats = computed(() => {
    const all = this.notes();
    return {
      total: all.length,
      notes: all.filter((n) => n.kind === 'note').length,
      memories: all.filter((n) => n.kind === 'memory').length,
    };
  });

  constructor() {
    effect(() => {
      this.storage.set(STORAGE_KEY, this.notes());
    });
    effect(() => {
      this.storage.set(FOLDERS_KEY, this.folders());
    });
  }

  /** Creates a (possibly nested) folder path, e.g. "Work/Client X". */
  createFolder(path: string): void {
    const clean = path.trim().replace(/^\/+|\/+$/g, '');
    if (!clean || this.folders().includes(clean)) return;
    this.folders.update((list) => [...list, clean]);
  }

  /** Moves a single note to another folder. */
  moveNote(id: string, folder: string): void {
    this.notes.update((list) => list.map((n) => (n.id === id ? { ...n, folder } : n)));
  }

  /** Renames a folder, updating all its notes and nested subfolders. */
  renameFolder(oldPath: string, newPath: string): void {
    const prefix = oldPath + '/';
    this.notes.update((list) =>
      list.map((n) => {
        if (n.folder === oldPath) return { ...n, folder: newPath };
        if (n.folder.startsWith(prefix))
          return { ...n, folder: newPath + n.folder.slice(oldPath.length) };
        return n;
      }),
    );
    this.folders.update((list) =>
      list.map((f) => {
        if (f === oldPath) return newPath;
        if (f.startsWith(prefix)) return newPath + f.slice(oldPath.length);
        return f;
      }),
    );
  }

  /** Deletes a folder, moving its notes (and nested folders) one level up. */
  deleteFolder(path: string): void {
    const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const prefix = path + '/';
    this.notes.update((list) =>
      list.map((n) => {
        if (n.folder === path) return { ...n, folder: parent };
        if (n.folder.startsWith(prefix))
          return { ...n, folder: parent + n.folder.slice(path.length) };
        return n;
      }),
    );
    this.folders.update((list) => list.filter((f) => f !== path && !f.startsWith(prefix)));
  }

  capture(text: string, source: BrainNote['source'] = 'typed', folder = 'Inbox'): BrainNote {
    const clean = text.trim();
    if (!clean) throw new Error('Empty note');
    const note: BrainNote = {
      id: crypto.randomUUID(),
      text: clean,
      tags: extractTags(clean),
      source,
      date: Date.now(),
      pinned: false,
      kind: 'note',
      folder,
    };
    this.notes.update((list) => [note, ...list]);
    // Embed asynchronously (best-effort) so the note is searchable semantically.
    if (this.embeddings.status() === 'ready') {
      void this.embeddings.embedDocument(clean).then((embedding) => {
        if (!embedding) return;
        this.notes.update((list) => list.map((n) => (n.id === note.id ? { ...n, embedding } : n)));
      });
    }
    return note;
  }

  delete(id: string): void {
    this.notes.update((list) => list.filter((n) => n.id !== id));
  }

  togglePin(id: string): void {
    this.notes.update((list) => list.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  }

  clear(): void {
    this.notes.set([]);
  }

  /** Synchronous BM25 search (used in computed signals / folder browsing). */
  search(query: string): BrainNote[] {
    return searchNotes(this.notes(), query);
  }

  /** Semantic search over notes (async embedding + vector ranking, BM25 fallback). */
  async searchSemantic(query: string): Promise<BrainNote[]> {
    if (this.embeddings.status() !== 'ready') return this.search(query);
    const queryEmbedding = await this.embeddings.embedQuery(query);
    if (!queryEmbedding) return this.search(query);
    const ranked = rankByEmbedding(this.notes(), queryEmbedding);
    return ranked.length ? ranked : this.search(query);
  }

  /** Loads the embedder in the background and backfills missing note embeddings. */
  async initEmbeddings(): Promise<void> {
    try {
      await this.embeddings.init();
    } catch {
      return; // semantic search unavailable — stays on the BM25 index
    }
    const stale = !this.embeddings.isCurrentModel();
    const missing = this.notes().filter((n) => !n.embedding || stale);
    if (missing.length === 0) {
      if (stale) this.embeddings.markCurrentModel();
      return;
    }
    const embeddings = await this.embeddings.embedDocuments(missing.map((n) => n.text));
    const byId = new Map(missing.map((n, i) => [n.id, embeddings[i]]));
    this.notes.update((list) =>
      list.map((n) => {
        if (!byId.has(n.id)) return n;
        const embedding = byId.get(n.id);
        return embedding ? { ...n, embedding } : { ...n, embedding: undefined };
      }),
    );
    this.embeddings.markCurrentModel();
  }

  exportMarkdown(): string {
    const lines = ['# INES — Second Brain', ''];
    for (const n of this.notes()) {
      const kind = n.kind === 'memory' ? '[memory] ' : '';
      const tags = n.tags.length ? '  #' + n.tags.join(' #') : '';
      lines.push(`- ${kind}${n.text}${tags}`);
    }
    return lines.join('\n');
  }

  /**
   * Distillation: compress older working notes into a single long-term memory
   * (Karpathy-style memory consolidation), keeping the most recent notes in
   * working memory.
   */
  async consolidate(keepRecent = 5): Promise<{ consolidated: number; memory: BrainNote } | null> {
    if (!this.llm.isReady()) {
      throw new Error('Load the model to consolidate memories.');
    }
    const working = this.notes()
      .filter((n) => n.kind === 'note')
      .sort((a, b) => b.date - a.date);
    if (working.length <= keepRecent) return null;

    const toCompress = working.slice(keepRecent);
    const content = toCompress.map((n) => `- ${n.text}`).join('\n');
    let summary = '';
    await this.llm.generate(CONSOLIDATE_SYSTEM, content, [], (_, __, full) => {
      summary = full;
    });

    const memory: BrainNote = {
      id: crypto.randomUUID(),
      text: summary.trim() || `Consolidated ${toCompress.length} notes`,
      tags: ['consolidated'],
      source: 'agent',
      date: Date.now(),
      pinned: false,
      kind: 'memory',
      folder: 'Memories',
    };

    const ids = new Set(toCompress.map((n) => n.id));
    this.notes.update((list) => [memory, ...list.filter((n) => !ids.has(n.id))]);
    return { consolidated: toCompress.length, memory };
  }

  /** Recall: search notes + knowledge base, then synthesize an answer with the LLM. */
  async ask(query: string): Promise<string> {
    if (!this.llm.isReady()) {
      throw new Error('Load the model for memory recall.');
    }

    const notes = (await this.searchSemantic(query)).slice(0, 6);
    let chunks: { text: string; docName: string }[] = [];
    try {
      chunks = await this.km.getRelevantChunks(query, 3, 300);
    } catch {
      /* knowledge base is best-effort */
    }

    const parts: string[] = [];
    if (notes.length) parts.push('## Notes\n' + notes.map((n) => `- ${n.text}`).join('\n'));
    if (chunks.length) {
      parts.push(
        '## Documents\n' + chunks.map((c) => `[${c.docName}]\n${c.text}`).join('\n\n---\n\n'),
      );
    }
    const context = parts.join('\n\n');
    const system = RECALL_SYSTEM + (context ? `\n\nMemory contents:\n${context}` : '');

    let answer = '';
    await this.llm.generate(system, query, [], (_, __, full) => {
      answer = full;
    });
    return answer;
  }
}

import { Injectable, signal, inject } from '@angular/core';
import { TextProcessingService } from './text-processing.service';

export interface DocumentChunk {
  text: string;
  source: string;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class RagService {
  private readonly textProc = inject(TextProcessingService);
  private readonly chunks = signal<DocumentChunk[]>([]);

  async processFile(file: File): Promise<void> {
    const text = await this.textProc.extractTextFromFile(file);
    const extension = file.name.split('.').pop()?.toLowerCase();
    const docId = crypto.randomUUID();
    const rawChunks = this.textProc.chunkText(text, file.name, docId);
    const newChunks: DocumentChunk[] = rawChunks.map((c) => ({
      text: c.text,
      source: file.name,
    }));
    this.chunks.update((prev) => [...prev, ...newChunks]);
  }

  getRelevantChunks(query: string, topK: number = 3, maxWords: number = 800): string {
    const allChunks = this.chunks();
    if (allChunks.length === 0) return '';

    // Simple keyword-based ranking for now
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const scoredChunks = allChunks.map((chunk) => {
      let score = 0;
      const chunkTextLower = chunk.text.toLowerCase();
      queryWords.forEach((word) => {
        if (chunkTextLower.includes(word)) score++;
      });
      return { chunk, score };
    });

    const sorted = scoredChunks.sort((a, b) => b.score - a.score);
    const resultChunks: string[] = [];
    let wordCount = 0;

    for (const item of sorted) {
      if (resultChunks.length >= topK) break;
      const chunkWords = item.chunk.text.split(/\s+/).length;
      if (resultChunks.length > 0 && wordCount + chunkWords > maxWords) {
        break;
      }
      resultChunks.push(item.chunk.text);
      wordCount += chunkWords;
    }

    return resultChunks.join('\n\n---\n\n');
  }

  clearContext(): void {
    this.chunks.set([]);
  }

  hasContext(): boolean {
    return this.chunks().length > 0;
  }
}

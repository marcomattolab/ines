import { Injectable, signal } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

// Set up worker for PDF.js - Use local worker for better offline support and to avoid CDN fetch issues
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface DocumentChunk {
  text: string;
  source: string;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class RagService {
  private chunks = signal<DocumentChunk[]>([]);

  async processFile(file: File): Promise<void> {
    let text = '';
    if (file.type === 'application/pdf') {
      text = await this.extractTextFromPdf(file);
    } else if (file.type === 'text/html') {
      text = await this.extractTextFromHtml(file);
    } else if (file.type === 'text/plain') {
      text = await file.text();
    } else {
      throw new Error('Unsupported file type');
    }

    const newChunks = this.chunkText(text, file.name);
    this.chunks.update(prev => [...prev, ...newChunks]);
  }

  private async extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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

  private chunkText(text: string, source: string, chunkSize: number = 500, overlap: number = 50): DocumentChunk[] {
    const words = text.split(/\s+/);
    const chunks: DocumentChunk[] = [];

    for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
      const chunkWords = words.slice(i, i + chunkSize);
      chunks.push({
        text: chunkWords.join(' '),
        source: source
      });
      if (i + chunkSize >= words.length) break;
    }

    return chunks;
  }

  getRelevantChunks(query: string, topK: number = 3): string {
    const allChunks = this.chunks();
    if (allChunks.length === 0) return '';

    // Simple keyword-based ranking for now
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    const scoredChunks = allChunks.map(chunk => {
      let score = 0;
      const chunkTextLower = chunk.text.toLowerCase();
      queryWords.forEach(word => {
        if (chunkTextLower.includes(word)) score++;
      });
      return { chunk, score };
    });

    return scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => item.chunk.text)
      .join('\n\n---\n\n');
  }

  clearContext(): void {
    this.chunks.set([]);
  }

  hasContext(): boolean {
    return this.chunks().length > 0;
  }
}

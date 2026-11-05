import { Injectable, signal } from '@angular/core';

export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Local OCR via Tesseract.js. The library is lazy-loaded on first use so the
 * main bundle stays small; language data (`ita+eng`) is fetched once and
 * cached by the browser, then recognition runs fully offline.
 */
@Injectable({ providedIn: 'root' })
export class OcrService {
  readonly busy = signal(false);
  readonly progress = signal(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private worker: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private workerPromise: Promise<any> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getWorker(): Promise<any> {
    if (this.worker) return this.worker;
    if (this.workerPromise) return this.workerPromise;

    this.workerPromise = (async () => {
      // Dynamic import keeps Tesseract out of the eager bundle and the test graph.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Tesseract: any = await import('tesseract.js');
      const worker = await Tesseract.createWorker('ita+eng', 1, {
        logger: (m: { status?: string; progress?: number }) => {
          if (m?.status === 'recognizing text' && typeof m.progress === 'number') {
            this.progress.set(Math.round(m.progress * 100));
          }
        },
      });
      this.worker = worker;
      return worker;
    })();

    return this.workerPromise;
  }

  async recognize(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) return '';
    this.busy.set(true);
    this.progress.set(0);
    try {
      const worker = await this.getWorker();
      const result = await worker.recognize(file);
      return typeof result?.data?.text === 'string' ? result.data.text.trim() : '';
    } finally {
      this.busy.set(false);
      this.progress.set(0);
    }
  }

  /** OCR con bounding box delle singole parole (per oscurare i dati personali). */
  async recognizeWords(image: File | Blob): Promise<OcrWord[]> {
    this.busy.set(true);
    this.progress.set(0);
    try {
      const worker = await this.getWorker();
      const result = await worker.recognize(image, {}, { blocks: true });
      const words: OcrWord[] = [];
      for (const b of result?.data?.blocks ?? [])
        for (const p of b.paragraphs ?? [])
          for (const l of p.lines ?? [])
            for (const w of l.words ?? []) {
              if (w.text?.trim())
                words.push({
                  text: w.text,
                  x0: w.bbox.x0,
                  y0: w.bbox.y0,
                  x1: w.bbox.x1,
                  y1: w.bbox.y1,
                });
            }
      return words;
    } finally {
      this.busy.set(false);
      this.progress.set(0);
    }
  }
}

import { Injectable, signal } from '@angular/core';

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
}

import { Injectable, signal } from '@angular/core';

interface Pending {
  resolve: (v: string) => void;
  reject: (e: Error) => void;
}

export type CaptionStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Image-to-text via Transformers.js, eseguito in un Web Worker per non
 * bloccare l'interfaccia. Il modello viene scaricato da Hugging Face al primo
 * utilizzo e poi resta in memoria.
 */
@Injectable({ providedIn: 'root' })
export class CaptioningService {
  readonly status = signal<CaptionStatus>('idle');
  readonly progress = signal(0);
  readonly message = signal('');

  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private readyHandlers: { resolve: () => void; reject: (e: Error) => void } | null = null;
  private seq = 0;
  private readonly pending = new Map<number, Pending>();

  ensure(
    modelId = 'Xenova/vit-gpt2-image-captioning',
    device: 'webgpu' | 'wasm' = 'wasm',
  ): Promise<void> {
    if (this.worker && this.ready) return this.ready;

    this.worker?.terminate();
    this.status.set('loading');
    this.progress.set(0);
    this.message.set('Avvio…');

    const worker = new Worker(new URL('./captioning.worker', import.meta.url), { type: 'module' });
    this.worker = worker;
    worker.onmessage = ({ data }) => this.onMessage(data);
    worker.onerror = (e) => this.fail(new Error(e.message || 'Errore nel worker'));

    this.ready = new Promise<void>((resolve, reject) => (this.readyHandlers = { resolve, reject }));
    this.ready.catch(() => undefined);
    worker.postMessage({ type: 'init', modelId, device });
    return this.ready;
  }

  async caption(image: ImageData): Promise<string> {
    await this.ensure();
    const id = ++this.seq;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      // Il buffer dei pixel viene trasferito (non copiato) al worker.
      this.worker!.postMessage(
        { type: 'caption', id, width: image.width, height: image.height, data: image.data },
        [image.data.buffer as ArrayBuffer],
      );
    });
  }

  private onMessage(data: {
    type: string;
    id?: number;
    text?: string;
    message?: string;
    p?: any;
  }): void {
    switch (data.type) {
      case 'progress': {
        const p = data.p ?? {};
        if (p.status === 'progress' && typeof p.progress === 'number') {
          this.progress.set(Math.round(p.progress));
          this.message.set(p.file ?? 'Download…');
        }
        break;
      }
      case 'ready':
        this.status.set('ready');
        this.progress.set(100);
        this.message.set('Modello pronto');
        this.readyHandlers?.resolve();
        break;
      case 'result':
        this.pending.get(data.id!)?.resolve(data.text ?? '');
        this.pending.delete(data.id!);
        break;
      case 'error': {
        const err = new Error(data.message);
        if (data.id !== undefined && this.pending.has(data.id)) {
          this.pending.get(data.id)!.reject(err);
          this.pending.delete(data.id);
        } else {
          this.fail(err);
        }
        break;
      }
    }
  }

  private fail(err: Error): void {
    this.status.set('error');
    this.message.set(err.message);
    this.readyHandlers?.reject(err);
    this.pending.forEach((p) => p.reject(err));
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }
}

import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private next = 0;

  show(msg: string, durationMs = 2800): void {
    const id = ++this.next;
    this.toasts.update((t) => [...t, { id, msg, type: 'info' }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), durationMs);
  }

  success(msg: string, durationMs = 2800): void {
    const id = ++this.next;
    this.toasts.update((t) => [...t, { id, msg, type: 'success' }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), durationMs);
  }

  error(msg: string, durationMs = 4000): void {
    const id = ++this.next;
    this.toasts.update((t) => [...t, { id, msg, type: 'error' }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}

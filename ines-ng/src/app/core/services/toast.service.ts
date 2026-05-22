import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  msg: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private next = 0;

  show(msg: string, durationMs = 2800): void {
    const id = ++this.next;
    this.toasts.update((t) => [...t, { id, msg }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), durationMs);
  }

  success(msg: string, durationMs = 2800): void {
    this.show(`✅ ${msg}`, durationMs);
  }

  error(msg: string, durationMs = 4000): void {
    this.show(`❌ ${msg}`, durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}

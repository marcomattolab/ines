import { Injectable, inject } from '@angular/core';
import { PrivacyService } from './privacy.service';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly privacy = inject(PrivacyService);

  get<T>(key: string): T | null {
    if (this.privacy.enabled()) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  set(key: string, value: unknown): void {
    if (this.privacy.enabled()) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota exceeded or storage unavailable */
    }
  }

  remove(key: string): void {
    if (this.privacy.enabled()) return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }
}

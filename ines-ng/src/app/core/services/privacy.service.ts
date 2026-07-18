import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PrivacyService {
  readonly enabled = signal(sessionStorage.getItem('ines_privacy_mode') === 'true');

  toggle() {
    this.enabled.update((v) => !v);
    try {
      sessionStorage.setItem('ines_privacy_mode', String(this.enabled()));
    } catch {
      /* best effort */
    }
  }
}

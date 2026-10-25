import { Injectable, inject, signal, effect } from '@angular/core';
import { StorageService } from './storage.service';
import { SpeechService } from './speech.service';
import { ToastService } from './toast.service';

export interface Reminder {
  id: string;
  text: string;
  at: number;
}

const STORAGE_KEY = 'ines_reminders';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly storage = inject(StorageService);
  private readonly speech = inject(SpeechService);
  private readonly toast = inject(ToastService);

  readonly reminders = signal<Reminder[]>(this.storage.get<Reminder[]>(STORAGE_KEY) ?? []);
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    // Re-arm persisted reminders; drop the ones already in the past.
    for (const r of this.reminders()) {
      if (r.at > Date.now()) this.arm(r);
      else this.remove(r.id);
    }
    effect(() => {
      this.storage.set(STORAGE_KEY, this.reminders());
    });
  }

  schedule(text: string, at: number): Reminder {
    const reminder: Reminder = { id: crypto.randomUUID(), text, at };
    this.reminders.update((list) => [...list, reminder]);
    this.arm(reminder);
    return reminder;
  }

  cancel(id: string): void {
    this.remove(id);
  }

  private arm(reminder: Reminder): void {
    const delay = Math.max(0, reminder.at - Date.now());
    const timer = setTimeout(() => this.fire(reminder.id), delay);
    this.timers.set(reminder.id, timer);
  }

  private fire(id: string): void {
    const reminder = this.reminders().find((r) => r.id === id);
    if (!reminder) return;
    this.remove(id);
    this.toast.show(`⏰ ${reminder.text}`);
    this.speech.speak(`reminder-${id}`, `Reminder: ${reminder.text}`);
  }

  private remove(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.reminders.update((list) => list.filter((r) => r.id !== id));
  }
}

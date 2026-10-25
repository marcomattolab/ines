import { Injectable, inject, signal, effect } from '@angular/core';
import { StorageService } from './storage.service';

const HIDDEN_TABS_KEY = 'ines_hidden_tabs';
const TAB_ORDER_KEY = 'ines_tab_order';
const LANG_KEY = 'ines_lang';
const THEME_KEY = 'ines_light_theme';
const WAKE_KEY = 'ines_wake_on_startup';

/**
 * Global app settings, persisted in localStorage:
 * - hidden tabs (UI personalization)
 * - tab order
 * - default voice language
 * - theme (dark/light)
 * - wake word at startup
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storage = inject(StorageService);

  readonly hiddenTabs = signal<string[]>(this.storage.get<string[]>(HIDDEN_TABS_KEY) ?? []);
  readonly tabOrder = signal<string[]>(this.storage.get<string[]>(TAB_ORDER_KEY) ?? []);
  readonly lang = signal<string>(this.storage.get<string>(LANG_KEY) ?? 'en-US');
  readonly lightTheme = signal<boolean>(this.storage.get<boolean>(THEME_KEY) ?? false);
  readonly wakeOnStartup = signal<boolean>(this.storage.get<boolean>(WAKE_KEY) ?? false);

  constructor() {
    effect(() => this.storage.set(HIDDEN_TABS_KEY, this.hiddenTabs()));
    effect(() => this.storage.set(TAB_ORDER_KEY, this.tabOrder()));
    effect(() => this.storage.set(LANG_KEY, this.lang()));
    effect(() => this.storage.set(THEME_KEY, this.lightTheme()));
    effect(() => this.storage.set(WAKE_KEY, this.wakeOnStartup()));
  }

  isVisible(tabId: string): boolean {
    return !this.hiddenTabs().includes(tabId);
  }

  toggle(tabId: string): void {
    this.hiddenTabs.update((list) =>
      list.includes(tabId) ? list.filter((x) => x !== tabId) : [...list, tabId],
    );
  }

  setOrder(order: string[]): void {
    this.tabOrder.set(order);
  }

  reset(): void {
    this.hiddenTabs.set([]);
    this.tabOrder.set([]);
  }
}

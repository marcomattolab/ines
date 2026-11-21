import { Injectable, computed, inject } from '@angular/core';
import { SettingsService } from './settings.service';

/**
 * Lightweight bilingual UI strings for the app shell chrome (EN/IT).
 * The rest of the app keeps its existing copy; this is the first step toward
 * a full i18n pass. The active language follows the global SettingsService.
 */
const STRINGS: Record<string, { en: string; it: string }> = {
  'offline.banner': {
    en: 'You are offline — AI model still works locally, but remote features are unavailable',
    it: 'Sei offline — il modello AI funziona ancora in locale, ma le funzioni remote non sono disponibili',
  },
  'nav.search': { en: 'Search', it: 'Cerca' },
  'nav.settings': { en: 'Settings', it: 'Impostazioni' },
  'nav.all': { en: 'All tabs', it: 'Tutte le schede' },
  'nav.productivity': { en: 'Productivity Workspace', it: 'Area Produttività' },
  'nav.dev': { en: 'Development & Studio', it: 'Sviluppo & Studio' },
  'nav.vision': { en: 'Vision & AI Labs', it: 'Visione & AI Labs' },
  'palette.placeholder': {
    en: 'Search tabs, quick actions (todo:, note:), or tools...',
    it: 'Cerca schede, azioni rapide (todo:, note:) o strumenti...',
  },
  'palette.actions': { en: 'Actions:', it: 'Azioni:' },
  'palette.todo': { en: '+ To-Do', it: '+ Attività' },
  'palette.note': { en: '+ Brain Note', it: '+ Nota Brain' },
  'palette.theme': { en: 'Theme', it: 'Tema' },
  'palette.noResults': { en: 'No results found for', it: 'Nessun risultato per' },
  'palette.try': { en: 'Try typing', it: 'Prova a digitare' },
  'palette.navigate': { en: 'navigate', it: 'naviga' },
  'palette.select': { en: 'select', it: 'seleziona' },
  'palette.close': { en: 'close', it: 'chiudi' },
  'settings.title': { en: 'Settings', it: 'Impostazioni' },
  'settings.general': { en: 'General', it: 'Generale' },
  'settings.lang': { en: 'Default language', it: 'Lingua predefinita' },
  'settings.lightTheme': { en: 'Light theme', it: 'Tema chiaro' },
  'settings.wake': {
    en: 'Enable wake word on startup',
    it: 'Attiva la parola di attivazione all\u2019avvio',
  },
  'settings.tabs': { en: 'Tabs (order & visibility)', it: 'Schede (ordine e visibilità)' },
  'settings.reset': { en: 'Reset', it: 'Ripristina' },
  'footer.powered': { en: 'Powered by', it: 'Creato da' },
  'footer.dark': { en: 'Switch to dark theme', it: 'Passa al tema scuro' },
  'footer.light': { en: 'Switch to light theme', it: 'Passa al tema chiaro' },
  'status.noModel': { en: 'No model loaded', it: 'Nessun modello caricato' },
  'status.loading': { en: 'Loading...', it: 'Caricamento...' },
  'status.loadModel': { en: 'Load Model', it: 'Carica modello' },
  'status.about': { en: 'About INES', it: 'Info su INES' },
  'status.dictate.start': { en: 'Start dictation', it: 'Avvia dettatura' },
  'status.dictate.stop': { en: 'Stop dictation', it: 'Ferma dettatura' },
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly settings = inject(SettingsService);

  readonly isIt = computed(() => (this.settings.lang() || '').toLowerCase().startsWith('it'));

  t(key: string): string {
    const lang = this.isIt() ? 'it' : 'en';
    return STRINGS[key]?.[lang] ?? STRINGS[key]?.en ?? key;
  }
}

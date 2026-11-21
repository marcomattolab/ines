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

  'action.clear': { en: 'Clear', it: 'Svuota' },
  'action.undo': { en: 'Undo', it: 'Annulla' },
  'action.import': { en: 'Import', it: 'Importa' },
  'action.cancel': { en: 'Cancel', it: 'Annulla' },
  'action.save': { en: 'Save', it: 'Salva' },
  'action.copy': { en: 'Copy', it: 'Copia' },
  'action.download': { en: 'Download', it: 'Scarica' },

  'tab.chat.title': { en: 'Ines (General Assistant)', it: 'Ines (Assistente Generale)' },
  'tab.chat.desc': {
    en: 'AI on-device · private · offline',
    it: 'AI on-device · privata · offline',
  },
  'tab.voice.title': { en: 'INES Voice', it: 'INES Voce' },
  'tab.voice.desc': {
    en: 'Voice assistant · dictation & series of tasks',
    it: 'Assistente vocale · dettatura e serie di attività',
  },
  'tab.translate.title': { en: 'Translator', it: 'Traduttore' },
  'tab.translate.desc': {
    en: 'Translate text between any language — completely offline',
    it: 'Traduci testo in qualsiasi lingua — completamente offline',
  },
  'tab.meeting.title': { en: 'Meeting Recorder', it: 'Registratore Riunioni' },
  'tab.meeting.desc': {
    en: 'Vocal transcription + AI-generated summary',
    it: 'Trascrizione vocale + riepilogo generato dall\u2019AI',
  },
  'tab.todo.title': { en: 'Daily Planner', it: 'Pianificatore Giornaliero' },
  'tab.todo.desc': {
    en: 'Organize your day with AI-powered task management',
    it: 'Organizza la tua giornata con la gestione attività basata su AI',
  },
  'tab.brain.title': { en: 'Second Brain', it: 'Second Brain' },
  'tab.learning.title': { en: 'Learning Center', it: 'Centro Apprendimento' },
  'tab.learning.desc': {
    en: 'RAG-powered analysis, Mind Maps, Quizzes & Exercises',
    it: 'Analisi RAG, mappe mentali, quiz ed esercizi',
  },
  'tab.coding.title': {
    en: 'Angular + TypeScript Assistant',
    it: 'Assistente Angular + TypeScript',
  },
  'tab.coding.desc': {
    en: 'Standalone components · signals · inject() · RxJS · Tailwind',
    it: 'Componenti standalone · signals · inject() · RxJS · Tailwind',
  },

  'tab.vision.title': { en: 'Vision Assistant', it: 'Assistente Visione' },
  'tab.vision.desc': {
    en: 'On-device SML vision · Edge AI emotion & gesture analysis',
    it: 'Visione SML on-device · analisi di emozioni e gesti con Edge AI',
  },
  'tab.visionassist.title': { en: 'Visual Assistant', it: 'Assistente Visivo' },
  'tab.visionassist.desc': {
    en: 'Describe a scene or read text aloud · on-device',
    it: 'Descrivi una scena o leggi il testo ad alta voce · on-device',
  },
  'tab.piiocr.title': { en: 'OCR & personal data', it: 'OCR & dati personali' },
  'tab.piiocr.desc': {
    en: 'Read a document (image or PDF) and redact personal data · Tesseract.js on-device',
    it: 'Leggi un documento (immagine o PDF) e oscura i dati personali · Tesseract.js on-device',
  },
  'tab.gestures.title': { en: 'Sicilian Gestures', it: 'Gesti Siciliani' },
  'tab.gestures.desc': {
    en: 'Hand landmarker on-device · Sicilian vocabulary and live actions',
    it: 'Hand landmarker on-device · vocabolario siciliano e azioni live',
  },
  'tab.tris.title': { en: 'Tris', it: 'Tris' },
  'tab.tris.desc': {
    en: 'Two-player tic-tac-toe · mouse, pinch or head cursor',
    it: 'Tris a due giocatori · mouse, pinch o cursore con la testa',
  },
  'tab.headcursor.title': { en: 'Head Cursor', it: 'Cursore Testa' },
  'tab.headcursor.desc': {
    en: 'Move your face to move the pointer · click with eyes or mouth',
    it: 'Muovi il viso per muovere il puntatore · clicca con occhi o bocca',
  },
  'tab.background.title': { en: 'Smart Background', it: 'Sfondo Intelligente' },
  'tab.background.desc': {
    en: 'Real-time segmentation · blur, color or replace background',
    it: 'Segmentazione in tempo reale · sfocatura, colore o sostituzione dello sfondo',
  },
  'tab.pinch.title': { en: 'Pinch & Scroll', it: 'Pinch & Scorri' },
  'tab.pinch.desc': {
    en: 'Scroll and click by pinching thumb and index · MediaPipe Hand Landmarker',
    it: 'Scorri e clicca pizzicando pollice e indice · MediaPipe Hand Landmarker',
  },

  'agents.title': { en: 'Agents', it: 'Agenti' },
  'agents.identity': { en: 'Identity', it: 'Identità' },
  'agents.skills': { en: 'Skills', it: 'Competenze' },
  'agents.searchDocs': { en: 'Search documents...', it: 'Cerca documenti...' },
  'agents.searchSkills': { en: 'Search skills...', it: 'Cerca competenze...' },

  'devagent.title': { en: 'Dev Agent', it: 'Dev Agent' },
  'devagent.searchFiles': { en: 'Search files...', it: 'Cerca file...' },
  'devagent.searchPath': {
    en: 'Search files by name or path...',
    it: 'Cerca file per nome o percorso...',
  },
  'devagent.clearRepo': { en: 'Clear repo', it: 'Svuota repository' },

  'project.back': { en: 'Back to project', it: 'Torna al progetto' },
  'project.searchDocs': { en: 'Search documents...', it: 'Cerca documenti...' },
  'project.ask': {
    en: 'Ask a question about your project docs...',
    it: 'Fai una domanda sui documenti del progetto...',
  },
  'project.export': { en: 'Export project', it: 'Esporta progetto' },
  'project.clearAll': { en: 'Clear all documents', it: 'Svuota tutti i documenti' },
  'project.clearMemory': { en: 'Clear project memory', it: 'Svuota memoria progetto' },
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

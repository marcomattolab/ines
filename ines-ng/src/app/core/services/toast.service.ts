import { Injectable, inject, signal } from '@angular/core';
import { SettingsService } from './settings.service';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}

/** Exact-match translations for the most common static toast messages. */
const TOAST_IT: Record<string, string> = {
  'Agent exported': 'Agente esportato',
  'Agent imported': 'Agente importato',
  'Agent updated': 'Agente aggiornato',
  'All cleared': 'Tutto svuotato',
  'All files copied!': 'Tutti i file copiati!',
  'At least one tab must remain visible': 'Almeno una scheda deve restare visibile',
  'Attach an image or a PDF': "Allega un'immagine o un PDF",
  'Bang! Go Palermo 💥': 'Bang! Forza Palermo 💥',
  'Both name and prompt are required': 'Nome e prompt sono obbligatori',
  'Cached model cleared': 'Cache del modello svuotata',
  'Cannot copy the text': 'Impossibile copiare il testo',
  'Cannot copy': 'Impossibile copiare',
  'Chat cleared': 'Chat svuotata',
  'Clipboard unavailable — select and copy the text manually.':
    'Appunti non disponibili — seleziona e copia il testo manualmente.',
  'Code copied to clipboard': 'Codice copiato negli appunti',
  'Conversation copied!': 'Conversazione copiata!',
  'Copied!': 'Copiato!',
  'Copying is not available': 'Copia non disponibile',
  'Could not delete document': 'Impossibile eliminare il documento',
  'Could not load document preview': "Impossibile caricare l'anteprima del documento",
  'Could not read file. Supported: .txt, .md, .html, .pdf':
    'Impossibile leggere il file. Supportati: .txt, .md, .html, .pdf',
  'Describe what you have to do today': 'Descrivi cosa devi fare oggi',
  'Document moved': 'Documento spostato',
  'Document removed from knowledge base': 'Documento rimosso dalla knowledge base',
  'Document removed from project memory': 'Documento rimosso dalla memoria del progetto',
  'Document removed': 'Documento rimosso',
  Downloaded: 'Scaricato',
  'Exported as .txt': 'Esportato come .txt',
  'Exported as Markdown': 'Esportato come Markdown',
  'Face image loaded': 'Immagine del volto caricata',
  'Failed to clear model cache': 'Impossibile svuotare la cache del modello',
  'Failed to copy': 'Copia non riuscita',
  'Failed to load image': "Impossibile caricare l'immagine",
  'Failed to read file': 'Impossibile leggere il file',
  'Flashcards generated no valid Q&A pairs — try again.':
    'Nessuna coppia domanda/risposta valida generata — riprova.',
  'Folder deleted — contents moved up':
    'Cartella eliminata — contenuto spostato al livello superiore',
  'Folder renamed': 'Cartella rinominata',
  'HTML downloaded': 'HTML scaricato',
  'I did not hear anything — try again': 'Non ho sentito nulla — riprova',
  'Invalid agent file': 'File agente non valido',
  'Invalid chat JSON file': 'File JSON chat non valido',
  'Invalid file. Use a JSON or CSV export from INES.':
    "File non valido. Usa un'esportazione JSON o CSV da INES.",
  'Knowledge base cleared': 'Knowledge base svuotata',
  'Knowledge base exported': 'Knowledge base esportata',
  'Load the model first!': 'Carica prima il modello!',
  'Model is still working on a previous request. Please wait.':
    'Il modello sta ancora elaborando una richiesta precedente. Attendi.',
  'Negative feedback noted.': 'Feedback negativo registrato.',
  'No changes could be applied': 'Nessuna modifica applicabile',
  'No conversation to copy': 'Nessuna conversazione da copiare',
  'No messages to export': 'Nessun messaggio da esportare',
  'No notes to export': 'Nessuna nota da esportare',
  'No patches to download': 'Nessuna patch da scaricare',
  'No summary to export': 'Nessun riepilogo da esportare',
  'No tasks to export': 'Nessun task da esportare',
  'No text detected in the file': 'Nessun testo rilevato nel file',
  'No transcript available': 'Nessuna trascrizione disponibile',
  'No translation to export': 'Nessuna traduzione da esportare',
  'No write access to this file': 'Nessun accesso in scrittura a questo file',
  'No write access. Re-open the folder with write permissions.':
    'Nessun accesso in scrittura. Riapri la cartella con i permessi di scrittura.',
  'Not enough notes to consolidate yet': 'Non ci sono ancora abbastanza note da consolidare',
  'Note moved': 'Nota spostata',
  'Note saved to Second Brain': 'Nota salvata nel Second Brain',
  'Nothing to undo': 'Niente da annullare',
  'Ok, Un ci su probblemi!': 'Ok, nessun problema!',
  'PPTX downloaded!': 'PPTX scaricato!',
  'Patches exported as .md': 'Patch esportate come .md',
  'Positive feedback received!': 'Feedback positivo ricevuto!',
  'Project exported': 'Progetto esportato',
  'Project imported successfully': 'Progetto importato con successo',
  'Project memory cleared': 'Memoria del progetto svuotata',
  'Q&A saved': 'Domanda e risposta salvate',
  'Redacted image downloaded': 'Immagine oscurata scaricata',
  'Saved to your brain': 'Salvato nel tuo brain',
  'Select an agent first': 'Seleziona prima un agente',
  'Settings reset': 'Impostazioni ripristinate',
  'Skill deleted': 'Competenza eliminata',
  'Skill exported as SKILL.md': 'Competenza esportata come SKILL.md',
  'Skill saved': 'Competenza salvata',
  'Skills library exported': 'Libreria competenze esportata',
  'Slide generation failed — try again.': 'Generazione slide non riuscita — riprova.',
  'Snapshot saved': 'Snapshot salvato',
  'TTS not supported': 'TTS non supportato',
  'Template downloaded': 'Template scaricato',
  'Template saved': 'Template salvato',
  'Text copied to clipboard': 'Testo copiato negli appunti',
  'This code block has no associated file name.':
    'Questo blocco di codice non ha un nome file associato.',
  'Undo!': 'Annullato!',
  'Upload documents first.': 'Carica prima i documenti.',
  'Web Speech API not supported in this browser': 'Web Speech API non supportata in questo browser',
  'Write access denied — falling back to read-only mode':
    'Accesso in scrittura negato — passo alla modalità sola lettura',
  'Your daily digest is ready — open the Assistant tab.':
    'Il tuo riepilogo giornaliero è pronto — apri la scheda Assistente.',
};

/** Pattern-based translations for interpolated toast messages. */
const TOAST_TEMPLATES_IT: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Error downloading model: /, () => 'Errore nel download del modello: '],
  [/^Error loading model: /, () => 'Errore nel caricamento del modello: '],
  [/^Export failed: /, () => 'Esportazione non riuscita: '],
  [/^Failed to load Angular docs: /, () => 'Impossibile caricare i documenti Angular: '],
  [/^Failed to save: /, () => 'Salvataggio non riuscito: '],
  [/^Failed to start Vision: /, () => 'Avvio Vision non riuscito: '],
  [/^Failed: /, () => 'Non riuscito: '],
  [/^Flashcard generation failed: /, () => 'Generazione flashcard non riuscita: '],
  [/^Import failed: /, () => 'Importazione non riuscita: '],
  [/^Error processing "([^"]+)": (.*)$/, (m) => `Errore nell'elaborazione di "${m[1]}": ${m[2]}`],
  [/^Error: (.*)$/, (m) => `Errore: ${m[1]}`],
  [/^Exported as \.(.+)$/, (m) => `Esportato come .${m[1]}`],
  [/^Failed to revert "([^"]+)": (.*)$/, (m) => `Ripristino di "${m[1]}" non riuscito: ${m[2]}`],
  [/^Failed to write "([^"]+)": (.*)$/, (m) => `Scrittura di "${m[1]}" non riuscita: ${m[2]}`],
  [
    /^File "([^"]+)" not found in repository\.$/,
    (m) => `File "${m[1]}" non trovato nel repository.`,
  ],
  [/^File not found: (.+)$/, (m) => `File non trovato: ${m[1]}`],
  [/^Folder "(.+)" created$/, (m) => `Cartella "${m[1]}" creata`],
  [/^Imported (\d+) messages$/, (m) => `Importati ${m[1]} messaggi`],
  [/^Imported (\d+) tasks$/, (m) => `Importate ${m[1]} attività`],
  [/^Imported: (.+)$/, (m) => `Importato: ${m[1]}`],
  [/^Indexing (\d+) files\.\.\.$/, (m) => `Indicizzazione di ${m[1]} file...`],
  [/^Loaded: (.+)$/, (m) => `Caricato: ${m[1]}`],
  [/^Presentation generated! (\d+) slides$/, (m) => `Presentazione generata! ${m[1]} slide`],
  [/^Reverted "([^"]+)"$/, (m) => `Ripristinato "${m[1]}"`],
  [/^Saved: (.+)$/, (m) => `Salvato: ${m[1]}`],
  [/^Score: (.+)$/, (m) => `Punteggio: ${m[1]}`],
  [/^To-Do added: "(.+)"$/, (m) => `Attività aggiunta: "${m[1]}"`],
  [/^To-Do added: "(.+)" \(Priority\)$/, (m) => `Attività aggiunta: "${m[1]}" (Priorità)`],
  [
    /^Consolidated (\d+) notes into long-term memory$/,
    (m) => `Consolidate ${m[1]} note nella memoria a lungo termine`,
  ],
  [
    /^Applied (\d+) changes, (\d+) failed$/,
    (m) => `Applicate ${m[1]} modifiche, ${m[2]} non riuscite`,
  ],
  [/^Applied all (\d+) changes$/, (m) => `Applicate tutte le ${m[1]} modifiche`],
  [/^Applied changes to "(.+)"$/, (m) => `Modifiche applicate a "${m[1]}"`],
  [/^"(.+)" added to knowledge base$/, (m) => `"${m[1]}" aggiunto alla knowledge base`],
  [/^"(.+)" added to project memory$/, (m) => `"${m[1]}" aggiunto alla memoria del progetto`],
  [/^"(.+)" added$/, (m) => `"${m[1]}" aggiunto`],
  [/^(.+) copied!$/, (m) => `${m[1]} copiato!`],
  [/^(.+) downloaded$/, (m) => `${m[1]} scaricato`],
  [/^Copied: (.+)$/, (m) => `Copiato: ${m[1]}`],
  [/^Indexed (\d+) files \(.+\)$/, (m) => `Indicizzati ${m[1]} file`],
];

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly settings = inject(SettingsService);

  readonly toasts = signal<Toast[]>([]);
  private next = 0;

  private translate(msg: string): string {
    try {
      const lang = (this.settings.lang() || '').toLowerCase();
      if (!lang.startsWith('it')) return msg;
    } catch {
      return msg;
    }
    const exact = TOAST_IT[msg];
    if (exact) return exact;
    for (const [re, fn] of TOAST_TEMPLATES_IT) {
      const replaced = msg.replace(re, (...args: unknown[]) =>
        fn(args as unknown as RegExpMatchArray),
      );
      if (replaced !== msg) return replaced;
    }
    return msg;
  }

  show(msg: string, durationMs = 2800): void {
    const id = ++this.next;
    this.toasts.update((t) => [...t, { id, msg: this.translate(msg), type: 'info' }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), durationMs);
  }

  success(msg: string, durationMs = 2800): void {
    const id = ++this.next;
    this.toasts.update((t) => [...t, { id, msg: this.translate(msg), type: 'success' }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), durationMs);
  }

  error(msg: string, durationMs = 4000): void {
    const id = ++this.next;
    this.toasts.update((t) => [...t, { id, msg: this.translate(msg), type: 'error' }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}

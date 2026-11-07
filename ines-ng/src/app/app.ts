import { Component, signal, inject, OnInit, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { StatusBarComponent } from './components/status-bar/status-bar.component';
import { LearningTabComponent } from './components/learning-tab/learning-tab.component';
import { LoaderOverlayComponent } from './components/loader-overlay/loader-overlay.component';
import { InfoModalComponent } from './components/info-modal/info-modal.component';
import { ChatTabComponent } from './components/chat-tab/chat-tab.component';
import { EmailTabComponent } from './components/email-tab/email-tab.component';
import { MeetingTabComponent } from './components/meeting-tab/meeting-tab.component';
import { TranslateTabComponent } from './components/translate-tab/translate-tab.component';
import { TodoTabComponent } from './components/todo-tab/todo-tab.component';
import { CodingTabComponent } from './components/coding-tab/coding-tab.component';
import { AgentsTabComponent } from './components/agents-tab/agents-tab.component';
import { VisionTabComponent } from './components/vision-tab/vision-tab.component';
import { SicilianGesturesTabComponent } from './components/sicilian-gestures-tab/sicilian-gestures-tab.component';
import { PinchScrollTabComponent } from './components/pinch-scroll-tab/pinch-scroll-tab.component';
import { HeadCursorTabComponent } from './components/head-cursor-tab/head-cursor-tab.component';
import { BackgroundTabComponent } from './components/background-tab/background-tab.component';
import { PiiOcrTabComponent } from './components/pii-ocr-tab/pii-ocr-tab.component';
import { VisionAssistTabComponent } from './components/vision-assist-tab/vision-assist-tab.component';
import { PresentationTabComponent } from './components/presentation-tab/presentation-tab.component';
import { ProjectTabComponent } from './components/project-tab/project-tab.component';
import { DevAgentTabComponent } from './components/dev-agent-tab/dev-agent-tab.component';
import { ToastService } from './core/services/toast.service';
import { ExpenseService } from './core/services/expense.service';
import { LlmService } from './core/services/llm.service';
import { SettingsService } from './core/services/settings.service';
import { VoiceAssistantService } from './core/services/voice-assistant.service';
import { TodoService } from './core/services/todo.service';
import { SecondBrainService } from './core/services/second-brain.service';
import { VoiceTabComponent } from './components/voice-tab/voice-tab.component';
import { BrainTabComponent } from './components/brain-tab/brain-tab.component';
import { ExpensesTabComponent } from './components/expenses-tab/expenses-tab.component';

export type Tab =
  | 'assistant'
  | 'chat'
  | 'brain'
  | 'email'
  | 'meeting'
  | 'translate'
  | 'todo'
  | 'coding'
  | 'agents'
  | 'vision'
  | 'sicilian'
  | 'pinch-scroll'
  | 'head-cursor'
  | 'background'
  | 'pii-ocr'
  | 'vision-assist'
  | 'learning'
  | 'presentation'
  | 'project'
  | 'dev-agent'
  | 'expenses';

export type TabCategory = 'productivity' | 'dev' | 'vision';
export type WorkspaceFilter = 'all' | 'productivity' | 'dev' | 'vision';

export interface TabDef {
  id: Tab;
  icon: string;
  label: string;
  color: string;
  category: TabCategory;
  categoryLabel: string;
  description: string;
  keywords: string[];
  dividerBefore?: boolean;
}

export interface PaletteItem {
  id: string;
  type: 'tab' | 'quick-action' | 'system';
  title: string;
  subtitle?: string;
  category: string;
  icon: string;
  color?: string;
  shortcut?: string;
  action: () => void | Promise<void>;
}

const TABS: TabDef[] = [
  // Produttività & Workspace
  {
    id: 'chat',
    icon: 'message-square',
    label: 'Chat',
    color: 'var(--tab-chat)',
    category: 'productivity',
    categoryLabel: 'Produttività',
    description: 'Chat conversazionale con AI on-device',
    keywords: ['chat', 'messaggi', 'conversazione', 'ia', 'ai', 'gemma', 'domande'],
  },
  {
    id: 'assistant',
    icon: 'record_voice_over',
    label: 'Voice',
    color: 'var(--tab-assistant)',
    category: 'productivity',
    categoryLabel: 'Produttività',
    description: 'Assistente vocale hands-free con wake word',
    keywords: ['voce', 'voice', 'audio', 'microfono', 'parla', 'assistente', 'dettatura'],
  },
  {
    id: 'brain',
    icon: 'psychology',
    label: 'Brain',
    color: 'var(--tab-brain)',
    category: 'productivity',
    categoryLabel: 'Produttività',
    description: 'Second Brain: note e memoria semantica RAG',
    keywords: ['brain', 'note', 'memoria', 'appunti', 'second brain', 'archivio', 'rag'],
  },
  {
    id: 'todo',
    icon: 'check-square',
    label: 'Todo',
    color: 'var(--tab-todo)',
    category: 'productivity',
    categoryLabel: 'Produttività',
    description: 'Attività, cose da fare e promemoria',
    keywords: ['todo', 'task', 'promemoria', 'compiti', 'attività', 'da fare'],
  },
  {
    id: 'expenses',
    icon: 'receipt_long',
    label: 'Spese',
    color: 'var(--tab-expenses)',
    category: 'productivity',
    categoryLabel: 'Produttività',
    description: 'Tracciamento spese, budget e OCR scontrini',
    keywords: ['spese', 'soldi', 'budget', 'scontrini', 'costi', 'finanze', 'ricevute'],
  },
  {
    id: 'email',
    icon: 'mail',
    label: 'Email',
    color: 'var(--tab-email)',
    category: 'productivity',
    categoryLabel: 'Produttività',
    description: 'Posta elettronica Gmail e riassunti automatici',
    keywords: ['email', 'posta', 'gmail', 'messaggi', 'lettere'],
  },
  {
    id: 'meeting',
    icon: 'mic',
    label: 'Meeting',
    color: 'var(--tab-meeting)',
    category: 'productivity',
    categoryLabel: 'Produttività',
    description: 'Trascrizione e verbale riunioni',
    keywords: ['meeting', 'riunione', 'verbale', 'trascrizione', 'audio'],
  },
  {
    id: 'translate',
    icon: 'languages',
    label: 'Translate',
    color: 'var(--tab-translate)',
    category: 'productivity',
    categoryLabel: 'Produttività',
    description: 'Traduzione istantanea multilingua on-device',
    keywords: ['translate', 'traduttore', 'lingue', 'italiano', 'inglese'],
  },

  // Sviluppo & Studio
  {
    id: 'coding',
    icon: 'code',
    label: 'Code',
    color: 'var(--tab-coding)',
    category: 'dev',
    categoryLabel: 'Sviluppo & Studio',
    description: 'Generazione ed editor di codice assistito',
    keywords: ['code', 'coding', 'programmazione', 'script', 'dev', 'typescript', 'python'],
  },
  {
    id: 'dev-agent',
    icon: 'smart_toy',
    label: 'DevAgent',
    color: 'var(--tab-dev-agent)',
    category: 'dev',
    categoryLabel: 'Sviluppo & Studio',
    description: 'Agente autonomo per task di sviluppo',
    keywords: ['devagent', 'agente', 'developer', 'automation', 'terminale'],
  },
  {
    id: 'presentation',
    icon: 'description',
    label: 'Slides',
    color: 'var(--tab-presentation)',
    category: 'dev',
    categoryLabel: 'Sviluppo & Studio',
    description: 'Generatore slide e presentazioni PPTX',
    keywords: ['slides', 'powerpoint', 'presentazioni', 'deck', 'pptx'],
  },
  {
    id: 'learning',
    icon: 'school',
    label: 'Learning',
    color: 'var(--tab-learning)',
    category: 'dev',
    categoryLabel: 'Sviluppo & Studio',
    description: 'Quiz, flashcard e apprendimento guidato',
    keywords: ['learning', 'studio', 'quiz', 'flashcard', 'corso', 'apprendimento'],
  },
  {
    id: 'project',
    icon: 'folder',
    label: 'Project',
    color: 'var(--tab-project)',
    category: 'dev',
    categoryLabel: 'Sviluppo & Studio',
    description: 'Documenti di progetto e base di conoscenza',
    keywords: ['project', 'progetti', 'documenti', 'cartelle', 'file'],
  },

  // Vision & AI Labs
  {
    id: 'vision-assist',
    icon: 'remove_red_eye',
    label: 'Assistente',
    color: 'var(--tab-vision-assist)',
    category: 'vision',
    categoryLabel: 'Vision & Labs',
    description: 'Descrizione visiva scena e webcam',
    keywords: ['vision assist', 'assistente visivo', 'webcam', 'occhi', 'scena'],
  },
  {
    id: 'pii-ocr',
    icon: 'document_scanner',
    label: 'OCR PII',
    color: 'var(--tab-pii-ocr)',
    category: 'vision',
    categoryLabel: 'Vision & Labs',
    description: 'Riconoscimento testo e oscuramento privacy',
    keywords: ['ocr', 'pii', 'privacy', 'anonimizzazione', 'scanner', 'testo'],
  },
  {
    id: 'vision',
    icon: 'visibility',
    label: 'Vision',
    color: 'var(--tab-vision)',
    category: 'vision',
    categoryLabel: 'Vision & Labs',
    description: 'Computer vision MediaPipe e object detection',
    keywords: ['vision', 'mediapipe', 'oggetti', 'telecamera', 'webcam'],
  },
  {
    id: 'sicilian',
    icon: 'back_hand',
    label: 'Gesti',
    color: 'var(--tab-sicilian)',
    category: 'vision',
    categoryLabel: 'Vision & Labs',
    description: 'Riconoscimento gesti della mano e gesti siciliani',
    keywords: ['gesti', 'mani', 'hand', 'siciliani', 'gesture'],
  },
  {
    id: 'pinch-scroll',
    icon: 'touch_app',
    label: 'Pinch',
    color: 'var(--tab-pinch-scroll)',
    category: 'vision',
    categoryLabel: 'Vision & Labs',
    description: 'Controllo dello scorrimento con gesture pinch',
    keywords: ['pinch', 'scroll', 'gesture', 'mani'],
  },
  {
    id: 'head-cursor',
    icon: 'face',
    label: 'Head Cursor',
    color: 'var(--tab-head-cursor)',
    category: 'vision',
    categoryLabel: 'Vision & Labs',
    description: 'Puntatore mouse controllato con i movimenti della testa',
    keywords: ['head', 'cursor', 'testa', 'faccia', 'puntatore', 'accessibilità'],
  },
  {
    id: 'background',
    icon: 'wallpaper',
    label: 'Sfondo',
    color: 'var(--tab-background)',
    category: 'vision',
    categoryLabel: 'Vision & Labs',
    description: 'Segmentazione e rimozione sfondo in tempo reale',
    keywords: ['sfondo', 'background', 'green screen', 'segmentazione', 'video'],
  },
  {
    id: 'agents',
    icon: 'support_agent',
    label: 'Agents',
    color: 'var(--tab-agents)',
    category: 'vision',
    categoryLabel: 'Vision & Labs',
    description: 'Configurazione agenti autonomi e libreria skills',
    keywords: ['agents', 'agenti', 'skills', 'orchestrator'],
  },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    StatusBarComponent,
    VoiceTabComponent,
    BrainTabComponent,
    LoaderOverlayComponent,
    InfoModalComponent,
    ChatTabComponent,
    EmailTabComponent,
    MeetingTabComponent,
    TranslateTabComponent,
    TodoTabComponent,
    CodingTabComponent,
    PresentationTabComponent,
    ProjectTabComponent,
    DevAgentTabComponent,
    LearningTabComponent,
    AgentsTabComponent,
    VisionTabComponent,
    SicilianGesturesTabComponent,
    PinchScrollTabComponent,
    HeadCursorTabComponent,
    BackgroundTabComponent,
    PiiOcrTabComponent,
    VisionAssistTabComponent,
    ExpensesTabComponent,
    FormsModule,
    MatIconModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:keydown)': 'handleKeyboard($event)',
  },
})
export class AppComponent implements OnInit {
  tabs = TABS;
  activeTab = signal<Tab>('chat');
  overlayOpen = signal(true);
  infoOpen = signal(false);
  commandPaletteOpen = signal(false);
  commandQuery = signal('');
  selectedPaletteIndex = signal<number>(0);
  activeWorkspace = signal<WorkspaceFilter>('all');
  isOnline = signal(navigator.onLine);

  readonly toast = inject(ToastService);
  readonly llm = inject(LlmService);
  readonly assistant = inject(VoiceAssistantService);
  readonly settings = inject(SettingsService);
  readonly expense = inject(ExpenseService);
  readonly todoService = inject(TodoService);
  readonly secondBrain = inject(SecondBrainService);

  settingsOpen = signal(false);
  readonly isLightTheme = this.settings.lightTheme;

  /** Tabs in the user-configured order (falls back to the default order). */
  readonly orderedTabs = computed(() => {
    const order = this.settings.tabOrder();
    if (!order.length) return this.tabs;
    const byId = new Map<string, TabDef>(this.tabs.map((t) => [t.id as string, t]));
    const ordered = order.map((id) => byId.get(id)).filter((t): t is TabDef => !!t);
    // Append tabs that are not in the saved order (e.g. newly added tabs).
    for (const t of this.tabs) {
      if (!order.includes(t.id)) ordered.push(t);
    }
    return ordered;
  });

  /** Only the tabs the user has not hidden (in the configured order). */
  readonly visibleTabs = computed(() =>
    this.orderedTabs().filter((t) => this.settings.isVisible(t.id)),
  );

  /** Visible tabs filtered by active workspace mode. */
  readonly displayTabs = computed(() => {
    const ws = this.activeWorkspace();
    const vis = this.visibleTabs();
    if (ws === 'all') return vis;
    return vis.filter((t) => t.category === ws);
  });

  /** Displayed tabs with computed headers/separators for the sidebar. */
  readonly displayItems = computed(() => {
    const items: { tab: TabDef; divider: boolean; category?: string }[] = [];
    const ws = this.activeWorkspace();
    let lastCategory: string | undefined;
    for (const t of this.displayTabs()) {
      const divider = ws === 'all' && t.categoryLabel !== lastCategory;
      if (divider) lastCategory = t.categoryLabel;
      items.push({ tab: t, divider, category: divider ? t.categoryLabel : undefined });
    }
    return items;
  });

  /** Omnipresent Command Palette items with fuzzy search, quick actions and system commands. */
  readonly paletteItems = computed<PaletteItem[]>(() => {
    const rawQ = this.commandQuery().trim();
    const lowerQ = rawQ.toLowerCase();
    const items: PaletteItem[] = [];

    // 1. Direct Quick Action: Todo
    if (/^(todo|task):\s*/i.test(rawQ)) {
      const text = rawQ.replace(/^(todo|task):\s*/i, '').trim();
      items.push({
        id: 'quick-todo',
        type: 'quick-action',
        title: text ? `Aggiungi to-do: "${text}"` : 'Crea nuova attività To-Do...',
        subtitle: text
          ? 'Premi Invio per salvare subito nella lista To-Do'
          : 'Scrivi il testo dopo todo:',
        category: 'Azione Rapida',
        icon: 'add_task',
        color: 'var(--accent-purple)',
        shortcut: '↵ Invio',
        action: () => {
          if (text) {
            this.parseAndAddTodo(text);
            this.closeCommandPalette();
          }
        },
      });
      return items;
    }

    // 2. Direct Quick Action: Expense
    if (/^(spesa|costo|expense):\s*/i.test(rawQ)) {
      const text = rawQ.replace(/^(spesa|costo|expense):\s*/i, '').trim();
      items.push({
        id: 'quick-expense',
        type: 'quick-action',
        title: text ? `Registra spesa: "${text}"` : 'Registra nuova spesa...',
        subtitle: text
          ? 'Premi Invio per registrare nel database spese'
          : 'Es: spesa: 14.50 pranzo di lavoro',
        category: 'Azione Rapida',
        icon: 'receipt_long',
        color: 'var(--tab-expenses)',
        shortcut: '↵ Invio',
        action: async () => {
          if (text) {
            await this.parseAndAddExpense(text);
            this.closeCommandPalette();
          }
        },
      });
      return items;
    }

    // 3. Direct Quick Action: Brain Note
    if (/^(nota|brain|note):\s*/i.test(rawQ)) {
      const text = rawQ.replace(/^(nota|brain|note):\s*/i, '').trim();
      items.push({
        id: 'quick-note',
        type: 'quick-action',
        title: text ? `Salva nel Second Brain: "${text}"` : 'Cattura pensiero o appunto...',
        subtitle: text
          ? 'Premi Invio per salvare tra le note del Second Brain'
          : 'Scrivi il testo dopo nota:',
        category: 'Azione Rapida',
        icon: 'psychology',
        color: 'var(--tab-brain)',
        shortcut: '↵ Invio',
        action: () => {
          if (text) {
            this.parseAndAddBrainNote(text);
            this.closeCommandPalette();
          }
        },
      });
      return items;
    }

    // Quick Action Prefills when searching action keywords
    if (!lowerQ || 'nuovo todo task promemoria aggiungi'.includes(lowerQ)) {
      items.push({
        id: 'action-suggest-todo',
        type: 'quick-action',
        title: 'Nuova attività To-Do',
        subtitle: 'Digita todo: <testo> per aggiungere un task al volo',
        category: 'Azioni Rapide',
        icon: 'add_task',
        color: 'var(--accent-purple)',
        shortcut: 'todo:',
        action: () => {
          this.commandQuery.set('todo: ');
        },
      });
    }

    if (!lowerQ || 'nuova spesa costo budget scontrino euro'.includes(lowerQ)) {
      items.push({
        id: 'action-suggest-expense',
        type: 'quick-action',
        title: 'Registra nuova spesa',
        subtitle: 'Digita spesa: <importo> <descrizione> per tracciare una spesa',
        category: 'Azioni Rapide',
        icon: 'receipt_long',
        color: 'var(--accent-green)',
        shortcut: 'spesa:',
        action: () => {
          this.commandQuery.set('spesa: ');
        },
      });
    }

    if (!lowerQ || 'nota appunto brain memoria secondo cervello'.includes(lowerQ)) {
      items.push({
        id: 'action-suggest-note',
        type: 'quick-action',
        title: 'Cattura pensiero nel Brain',
        subtitle: 'Digita nota: <testo> per archiviare nel Second Brain',
        category: 'Azioni Rapide',
        icon: 'psychology',
        color: 'var(--tab-brain)',
        shortcut: 'nota:',
        action: () => {
          this.commandQuery.set('nota: ');
        },
      });
    }

    // System actions
    const systemActions: PaletteItem[] = [
      {
        id: 'sys-theme',
        type: 'system',
        title: this.isLightTheme() ? 'Passa al Tema Scuro' : 'Passa al Tema Chiaro',
        subtitle: "Inverte la palette cromatica dell'interfaccia",
        category: 'Sistema',
        icon: this.isLightTheme() ? 'dark_mode' : 'light_mode',
        color: 'var(--accent-amber)',
        action: () => {
          this.toggleTheme();
          this.closeCommandPalette();
        },
      },
      {
        id: 'sys-model',
        type: 'system',
        title: 'Gestione Modello AI On-Device',
        subtitle: `Stato: ${this.llm.modelStatus()} (${this.llm.modelName()})`,
        category: 'Sistema',
        icon: 'bolt',
        color: 'var(--accent-blue)',
        action: () => {
          this.overlayOpen.set(true);
          this.closeCommandPalette();
        },
      },
      {
        id: 'sys-settings',
        type: 'system',
        title: 'Impostazioni & Personalizzazione',
        subtitle: 'Ordina o nascondi le schede, lingua e wake word',
        category: 'Sistema',
        icon: 'settings',
        color: 'var(--text-1)',
        action: () => {
          this.settingsOpen.set(true);
          this.closeCommandPalette();
        },
      },
      {
        id: 'sys-info',
        type: 'system',
        title: 'Informazioni su INES',
        subtitle: 'Architettura edge AI, privacy e dettagli tecnici',
        category: 'Sistema',
        icon: 'info',
        color: 'var(--accent-rose)',
        action: () => {
          this.infoOpen.set(true);
          this.closeCommandPalette();
        },
      },
    ];

    for (const sys of systemActions) {
      if (
        !lowerQ ||
        sys.title.toLowerCase().includes(lowerQ) ||
        sys.subtitle?.toLowerCase().includes(lowerQ)
      ) {
        items.push(sys);
      }
    }

    // Matching Tabs
    const visible = this.visibleTabs();
    const matchingTabs = visible.filter((t) => {
      if (!lowerQ) return true;
      return (
        t.label.toLowerCase().includes(lowerQ) ||
        t.id.toLowerCase().includes(lowerQ) ||
        t.categoryLabel.toLowerCase().includes(lowerQ) ||
        t.description.toLowerCase().includes(lowerQ) ||
        t.keywords.some((k) => k.toLowerCase().includes(lowerQ))
      );
    });

    for (const [idx, t] of matchingTabs.entries()) {
      items.push({
        id: `tab-${t.id}`,
        type: 'tab',
        title: t.label,
        subtitle: t.description,
        category: t.categoryLabel,
        icon: t.icon,
        color: t.color,
        shortcut: idx < 9 ? `⌘${idx + 1}` : undefined,
        action: () => {
          this.selectCommandTab(t.id);
        },
      });
    }

    return items;
  });

  filteredTabs = computed(() => {
    const q = this.commandQuery().toLowerCase();
    const vis = this.visibleTabs();
    if (!q) return vis;
    return vis.filter((t) => t.label.toLowerCase().includes(q));
  });

  toggleTab(id: Tab) {
    if (this.settings.isVisible(id) && this.visibleTabs().length <= 1) {
      this.toast.show('At least one tab must remain visible');
      return;
    }
    this.settings.toggle(id);
  }

  moveTab(id: Tab, dir: -1 | 1) {
    // Operate on the full displayed order (includes tabs missing from the saved order).
    const order = this.orderedTabs().map((t) => t.id);
    const idx = order.indexOf(id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target], next[idx]];
    this.settings.setOrder(next);
  }

  resetTabs() {
    this.settings.reset();
    this.toast.success('Settings reset');
  }

  ngOnInit() {
    window.addEventListener('online', () => this.isOnline.set(true));
    window.addEventListener('offline', () => this.isOnline.set(false));

    try {
      const savedTab = sessionStorage.getItem('ines_active_tab');
      if (savedTab && this.tabs.some((t) => t.id === savedTab)) {
        this.activeTab.set(savedTab as Tab);
      }
      const savedWs = sessionStorage.getItem('ines_active_workspace') as WorkspaceFilter | null;
      if (savedWs && ['all', 'productivity', 'dev', 'vision'].includes(savedWs)) {
        this.activeWorkspace.set(savedWs);
      }
    } catch {
      /* best effort */
    }
    if (this.settings.wakeOnStartup()) {
      try {
        this.assistant.startWake();
      } catch {
        /* mic may require a user gesture */
      }
    }
    // 1. Try to load from IndexedDB cache first
    this.llm
      .initModelFromCache()
      .then((loadedFromCache) => {
        if (loadedFromCache) {
          this.overlayOpen.set(false);
        } else {
          // No cached model. Check if a model was loaded previously in this tab session (e.g. tab refresh in incognito)
          this.checkSessionFallback();
        }
      })
      .catch((err) => {
        console.error('Cache load error:', err);
        this.checkSessionFallback();
      });
  }

  private async checkSessionFallback() {
    try {
      if (sessionStorage.getItem('model_loaded_previously') === 'true') {
        const url = '/models/gemma-4-E2B-it-gpu.litertlm';
        try {
          const res = await fetch(url, { method: 'HEAD' });
          const cl = parseInt(res.headers.get('content-length') || '0', 10);
          // Some dev/static servers omit Content-Length on HEAD; treat a 200 as
          // available in that case instead of silently skipping the load.
          if (res.ok && (cl === 0 || cl > 100 * 1024 * 1024)) {
            await this.llm.initModelFromUrl(url, 'gemma-4-E2B-it-gpu.litertlm');
            this.overlayOpen.set(false);
            return;
          }
        } catch {
          /* URL unreachable — fall through */
        }
      }
    } catch {
      /* sessionStorage unavailable */
    }
    this.llm.modelStatus.set('idle');
    this.llm.modelName.set('No model loaded');
  }

  openCommandPalette() {
    this.commandPaletteOpen.set(true);
    this.commandQuery.set('');
    this.selectedPaletteIndex.set(0);
  }

  closeCommandPalette() {
    this.commandPaletteOpen.set(false);
    this.commandQuery.set('');
    this.selectedPaletteIndex.set(0);
  }

  setWorkspace(ws: WorkspaceFilter) {
    this.activeWorkspace.set(ws);
    try {
      sessionStorage.setItem('ines_active_workspace', ws);
    } catch {
      /* best effort */
    }
  }

  parseAndAddTodo(raw: string): void {
    const clean = raw.trim();
    if (!clean) return;
    const isPriority = /!|urgente|urgent/i.test(clean);
    const text = clean.replace(/!|urgente|urgent/gi, '').trim();
    this.todoService.add(text || clean, isPriority ? 'priority' : 'normal');
    this.toast.success(`To-Do aggiunto: "${text || clean}"${isPriority ? ' (Prioritario)' : ''}`);
  }

  async parseAndAddExpense(raw: string): Promise<void> {
    const clean = raw.trim();
    if (!clean) return;
    const numMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*€|€\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)/);
    let amount = 0;
    let desc = clean;
    if (numMatch) {
      const valStr = numMatch[1] || numMatch[2] || numMatch[3];
      amount = parseFloat(valStr.replace(',', '.'));
      desc = clean.replace(numMatch[0], '').replace(/\s+/g, ' ').trim();
    }
    if (!desc) desc = 'Spesa rapida';
    await this.expense.add({
      amount: isNaN(amount) ? 0 : amount,
      description: desc,
      date: new Date().toISOString().slice(0, 10),
      category: 'altro',
      recurrence: 'once',
      sourceType: 'manual',
    });
    this.toast.success(`Spesa registrata: ${amount > 0 ? amount + ' € ' : ''}(${desc})`);
  }

  parseAndAddBrainNote(raw: string): void {
    const clean = raw.trim();
    if (!clean) return;
    this.secondBrain.capture(clean, 'typed');
    this.toast.success('Nota salvata nel Second Brain');
  }

  handleKeyboard(e: KeyboardEvent) {
    // Open/Toggle Command Palette: Cmd+K or Ctrl+K
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (this.commandPaletteOpen()) {
        this.closeCommandPalette();
      } else {
        this.openCommandPalette();
      }
      return;
    }

    // Keyboard navigation inside Command Palette
    if (this.commandPaletteOpen()) {
      const items = this.paletteItems();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length > 0) {
          this.selectedPaletteIndex.update((i) => (i + 1) % items.length);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length > 0) {
          this.selectedPaletteIndex.update((i) => (i - 1 + items.length) % items.length);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const current = items[this.selectedPaletteIndex()];
        if (current) {
          void current.action();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeCommandPalette();
        return;
      }
    }

    // Numeric shortcuts (Cmd+1..Cmd+9) when Command Palette is closed
    if (e.ctrlKey || e.metaKey) {
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= this.displayTabs().length) {
        e.preventDefault();
        this.selectCommandTab(this.displayTabs()[idx - 1].id);
        return;
      }
    }

    if (e.key === 'Escape') {
      if (this.infoOpen()) this.infoOpen.set(false);
      if (this.overlayOpen()) this.overlayOpen.set(false);
      if (this.settingsOpen()) this.settingsOpen.set(false);
      if (this.commandPaletteOpen()) this.closeCommandPalette();
    }
  }

  selectCommandTab(tab: Tab) {
    this.activeTab.set(tab);
    this.closeCommandPalette();
    try {
      sessionStorage.setItem('ines_active_tab', tab);
    } catch {
      /* best effort */
    }

    // Auto-switch workspace filter if the selected tab belongs to another workspace
    const def = this.tabs.find((t) => t.id === tab);
    if (def && this.activeWorkspace() !== 'all' && def.category !== this.activeWorkspace()) {
      this.setWorkspace(def.category);
    }
  }

  toggleTheme() {
    this.isLightTheme.update((v) => !v);
  }

  private themeEffect = effect(() => {
    document.body.classList.toggle('theme-light', this.isLightTheme());
  });

  private navEffect = effect(() => {
    const tab = this.assistant.requestedTab();
    if (tab && this.tabs.some((t) => t.id === tab)) {
      this.selectCommandTab(tab as Tab);
      this.assistant.requestedTab.set(null);
    }
  });

  private digestEffect = effect(() => {
    if (this.llm.isReady()) {
      void this.assistant.maybeRunDailyDigest();
    }
  });

  /** If the active tab gets hidden, fall back to the first visible one. */
  private visibilityEffect = effect(() => {
    const vis = this.visibleTabs();
    if (vis.length === 0) return;
    if (!vis.some((t) => t.id === this.activeTab())) {
      this.selectCommandTab(vis[0].id);
    }
  });

  private expenseSeenEffect = effect(() => {
    if (this.activeTab() === 'expenses') {
      this.expense.markSeen();
    }
  });
}

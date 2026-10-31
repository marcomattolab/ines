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
import { PresentationTabComponent } from './components/presentation-tab/presentation-tab.component';
import { ProjectTabComponent } from './components/project-tab/project-tab.component';
import { DevAgentTabComponent } from './components/dev-agent-tab/dev-agent-tab.component';
import { ToastService } from './core/services/toast.service';
import { ExpenseService } from './core/services/expense.service';
import { LlmService } from './core/services/llm.service';
import { SettingsService } from './core/services/settings.service';
import { VoiceAssistantService } from './core/services/voice-assistant.service';
import { VoiceTabComponent } from './components/voice-tab/voice-tab.component';
import { BrainTabComponent } from './components/brain-tab/brain-tab.component';
import { ExpensesTabComponent } from './components/expenses-tab/expenses-tab.component';

type Tab =
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
  | 'learning'
  | 'presentation'
  | 'project'
  | 'dev-agent'
  | 'expenses';

interface TabDef {
  id: Tab;
  icon: string;
  label: string;
  color: string;
  dividerBefore?: boolean;
  category?: string;
}

const TABS: TabDef[] = [
  { id: 'assistant', icon: 'record_voice_over', label: 'Voice', color: 'var(--tab-assistant)' },
  { id: 'chat', icon: 'message-square', label: 'Chat', color: 'var(--tab-chat)' },
  { id: 'email', icon: 'mail', label: 'Email', color: 'var(--tab-email)' },
  { id: 'meeting', icon: 'mic', label: 'Meeting', color: 'var(--tab-meeting)' },
  { id: 'translate', icon: 'languages', label: 'Translate', color: 'var(--tab-translate)' },
  { id: 'todo', icon: 'check-square', label: 'Todo', color: 'var(--tab-todo)' },
  { id: 'expenses', icon: 'receipt_long', label: 'Spese', color: 'var(--tab-expenses)' },
  {
    id: 'coding',
    icon: 'code',
    label: 'Code',
    color: 'var(--tab-coding)',
    dividerBefore: true,
    category: 'Development',
  },
  { id: 'agents', icon: 'support_agent', label: 'Agents', color: 'var(--tab-agents)' },
  { id: 'vision', icon: 'visibility', label: 'Vision', color: 'var(--tab-vision)' },
  {
    id: 'learning',
    icon: 'school',
    label: 'Learning',
    color: 'var(--tab-learning)',
    dividerBefore: true,
    category: 'Content',
  },
  { id: 'presentation', icon: 'description', label: 'Slides', color: 'var(--tab-presentation)' },
  { id: 'project', icon: 'folder', label: 'Project', color: 'var(--tab-project)' },
  { id: 'brain', icon: 'psychology', label: 'Brain', color: 'var(--tab-brain)' },
  {
    id: 'dev-agent',
    icon: 'smart_toy',
    label: 'DevAgent',
    color: 'var(--tab-dev-agent)',
    dividerBefore: true,
    category: 'AI',
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
  isOnline = signal(navigator.onLine);
  readonly toast = inject(ToastService);
  readonly llm = inject(LlmService);
  readonly assistant = inject(VoiceAssistantService);
  readonly settings = inject(SettingsService);
  readonly expense = inject(ExpenseService);

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

  /** Visible tabs with computed dividers/categories for the sidebar. */
  readonly displayItems = computed(() => {
    const items: { tab: TabDef; divider: boolean; category?: string }[] = [];
    let lastCategory: string | undefined;
    for (const t of this.visibleTabs()) {
      const divider = !!t.category && t.category !== lastCategory;
      if (divider) lastCategory = t.category;
      items.push({ tab: t, divider, category: divider ? t.category : undefined });
    }
    return items;
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

  filteredTabs = computed(() => {
    const q = this.commandQuery().toLowerCase();
    const vis = this.visibleTabs();
    if (!q) return vis;
    return vis.filter((t) => t.label.toLowerCase().includes(q));
  });

  handleKeyboard(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      this.commandPaletteOpen.update((v) => !v);
      this.commandQuery.set('');
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= this.visibleTabs().length) {
        e.preventDefault();
        this.activeTab.set(this.visibleTabs()[idx - 1].id);
      }
    }
    if (e.key === 'Escape') {
      if (this.infoOpen()) this.infoOpen.set(false);
      if (this.overlayOpen()) this.overlayOpen.set(false);
      if (this.commandPaletteOpen()) this.commandPaletteOpen.set(false);
    }
  }

  selectCommandTab(tab: Tab) {
    this.activeTab.set(tab);
    this.commandPaletteOpen.set(false);
    this.commandQuery.set('');
    try {
      sessionStorage.setItem('ines_active_tab', tab);
    } catch {
      /* best effort */
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

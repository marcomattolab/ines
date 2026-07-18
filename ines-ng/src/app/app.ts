import { Component, signal, inject, OnInit, HostListener } from '@angular/core';
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
import { KnowledgeManagerTabComponent } from './components/knowledge-manager-tab/knowledge-manager-tab.component';
import { ProjectTabComponent } from './components/project-tab/project-tab.component';
import { DevAgentTabComponent } from './components/dev-agent-tab/dev-agent-tab.component';
import { ToastService } from './core/services/toast.service';
import { LlmService } from './core/services/llm.service';

type Tab =
  | 'chat'
  | 'email'
  | 'meeting'
  | 'translate'
  | 'todo'
  | 'coding'
  | 'agents'
  | 'vision'
  | 'learning'
  | 'presentation'
  | 'knowledge'
  | 'project'
  | 'dev-agent';

interface TabDef {
  id: Tab;
  icon: string;
  label: string;
  color: string;
  dividerBefore?: boolean;
  category?: string;
}

const TABS: TabDef[] = [
  { id: 'chat', icon: 'message-square', label: 'Chat', color: 'var(--tab-chat)' },
  { id: 'email', icon: 'mail', label: 'Email', color: 'var(--tab-email)' },
  { id: 'meeting', icon: 'mic', label: 'Meeting', color: 'var(--tab-meeting)' },
  { id: 'translate', icon: 'languages', label: 'Translate', color: 'var(--tab-translate)' },
  { id: 'todo', icon: 'check-square', label: 'Todo', color: 'var(--tab-todo)' },
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
  { id: 'knowledge', icon: 'auto_stories', label: 'Knowledge', color: 'var(--tab-knowledge)' },
  { id: 'project', icon: 'folder', label: 'Project', color: 'var(--tab-project)' },
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
    LoaderOverlayComponent,
    InfoModalComponent,
    ChatTabComponent,
    EmailTabComponent,
    MeetingTabComponent,
    TranslateTabComponent,
    TodoTabComponent,
    CodingTabComponent,
    PresentationTabComponent,
    KnowledgeManagerTabComponent,
    ProjectTabComponent,
    DevAgentTabComponent,
    LearningTabComponent,
    AgentsTabComponent,
    VisionTabComponent,
    MatIconModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent implements OnInit {
  tabs = TABS;
  activeTab = signal<Tab>('chat');
  overlayOpen = signal(true); // show on load
  infoOpen = signal(false);
  readonly toast = inject(ToastService);
  readonly llm = inject(LlmService);

  ngOnInit() {
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
        const url = '/models/gemma3-1b-it-int8-web.task';
        try {
          const res = await fetch(url, { method: 'HEAD' });
          const cl = parseInt(res.headers.get('content-length') || '0', 10);
          if (res.ok && cl > 100 * 1024 * 1024) {
            await this.llm.initModelFromUrl(url, 'gemma3-1b-it-int8-web.task');
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

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey) {
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= this.tabs.length) {
        e.preventDefault();
        this.activeTab.set(this.tabs[idx - 1].id);
      }
    }
    if (e.key === 'Escape') {
      if (this.infoOpen()) this.infoOpen.set(false);
      if (this.overlayOpen()) this.overlayOpen.set(false);
    }
  }
}

import { Component, signal, inject } from '@angular/core';
import { StatusBarComponent } from './components/status-bar/status-bar.component';
import { LoaderOverlayComponent } from './components/loader-overlay/loader-overlay.component';
import { ChatTabComponent } from './components/chat-tab/chat-tab.component';
import { EmailTabComponent } from './components/email-tab/email-tab.component';
import { MeetingTabComponent } from './components/meeting-tab/meeting-tab.component';
import { TranslateTabComponent } from './components/translate-tab/translate-tab.component';
import { TodoTabComponent } from './components/todo-tab/todo-tab.component';
import { ToastService } from './core/services/toast.service';

type Tab = 'chat' | 'email' | 'meeting' | 'translate' | 'todo';

interface TabDef {
  id: Tab;
  icon: string;
  label: string;
  color: string;
}

const TABS: TabDef[] = [
  { id: 'chat',      icon: '💬', label: 'Chat',      color: 'var(--tab-chat)' },
  { id: 'email',     icon: '✉️', label: 'Email',     color: 'var(--tab-email)' },
  { id: 'meeting',   icon: '🎙️', label: 'Meeting',   color: 'var(--tab-meeting)' },
  { id: 'translate', icon: '🌍', label: 'Translate', color: 'var(--tab-translate)' },
  { id: 'todo',      icon: '✅', label: 'Todo',      color: 'var(--tab-todo)' },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    StatusBarComponent,
    LoaderOverlayComponent,
    ChatTabComponent,
    EmailTabComponent,
    MeetingTabComponent,
    TranslateTabComponent,
    TodoTabComponent,
  ],
  template: `
    <app-status-bar (openLoader)="overlayOpen.set(true)" />

    <app-loader-overlay
      [visible]="overlayOpen()"
      (closed)="overlayOpen.set(false)" />

    <div id="app">
      <!-- Sidebar -->
      <nav id="sidebar">
        @for (tab of tabs; track tab.id) {
          <button class="tab-btn"
            [class.active]="activeTab() === tab.id"
            [style.--tab-color]="tab.color"
            (click)="activeTab.set(tab.id)">
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        }
        <div class="sidebar-spacer"></div>
      </nav>

      <!-- Main panels -->
      <main id="main">
        @if (activeTab() === 'chat')      { <app-chat-tab /> }
        @if (activeTab() === 'email')     { <app-email-tab /> }
        @if (activeTab() === 'meeting')   { <app-meeting-tab /> }
        @if (activeTab() === 'translate') { <app-translate-tab /> }
        @if (activeTab() === 'todo')      { <app-todo-tab /> }
      </main>
    </div>

    <!-- Toast notifications -->
    @for (t of toast.toasts(); track t.id) {
      <div class="toast">{{ t.msg }}</div>
    }
  `,
  styleUrl: './app.css'
})
export class AppComponent {
  tabs       = TABS;
  activeTab  = signal<Tab>('chat');
  overlayOpen = signal(true); // show on load
  toast      = inject(ToastService);
}

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
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent {
  tabs       = TABS;
  activeTab  = signal<Tab>('chat');
  overlayOpen = signal(true); // show on load
  toast      = inject(ToastService);
}

import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import {
  VoiceAssistantService,
  VoiceTask,
  VoiceTaskStatus,
} from '../../core/services/voice-assistant.service';
import { GmailService } from '../../core/services/gmail.service';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { DomUtilsService } from '../../core/services/dom-utils.service';

@Component({
  selector: 'app-voice-tab',
  standalone: true,
  imports: [MatIconModule, FormsModule, ButtonComponent],
  templateUrl: './voice-tab.component.html',
  styleUrl: './voice-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class VoiceTabComponent {
  readonly assistant = inject(VoiceAssistantService);
  readonly gmail = inject(GmailService);
  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  private readonly dom = inject(DomUtilsService);

  readonly showSettings = signal(false);
  readonly gmailClientId = signal(this.gmail.clientId());

  readonly langs = [
    { value: 'en-US', label: 'English' },
    { value: 'it-IT', label: 'Italiano' },
    { value: 'fr-FR', label: 'Français' },
    { value: 'de-DE', label: 'Deutsch' },
    { value: 'es-ES', label: 'Español' },
  ];

  doneCount(): number {
    return this.assistant.tasks().filter((t) => t.status === 'done').length;
  }

  statusText(): string {
    if (this.assistant.wakeEnabled()) {
      if (this.assistant.processing()) return 'Thinking…';
      if (this.assistant.speaking()) return 'Speaking…';
      return 'Listening for "INES"…';
    }
    if (this.assistant.listening()) return 'Listening…';
    if (this.assistant.processing()) return 'Thinking…';
    if (this.assistant.speaking()) return 'Speaking…';
    return 'Press the microphone and speak';
  }

  onOrbClick(): void {
    if (this.assistant.wakeEnabled()) this.assistant.stopWake();
    else this.assistant.toggleListening();
  }

  saveGmailClientId(): void {
    this.gmail.saveClientId(this.gmailClientId());
  }

  async testGmail(): Promise<void> {
    if (!this.gmail.configured()) {
      this.gmail.saveClientId(this.gmailClientId());
    }
    try {
      const count = await this.gmail.testConnection();
      this.toast.success(`Gmail connected — ${count} recent email(s) found`);
    } catch {
      /* lastError is already set by GmailService */
    }
  }

  taskIcon(type: VoiceTask['type']): string {
    switch (type) {
      case 'todo':
        return 'check_circle';
      case 'navigate':
        return 'open_in_new';
      case 'list-todos':
        return 'format_list_bulleted';
      case 'answer':
        return 'chat';
      case 'email':
        return 'mail';
      case 'translate':
        return 'translate';
      case 'create-agent':
        return 'smart_toy';
      case 'summarize-gmail':
        return 'mark_email_read';
      case 'remember':
        return 'psychology';
      case 'recall':
        return 'search';
      case 'digest':
        return 'today';
      case 'reminder':
        return 'alarm';
      case 'consolidate':
        return 'compress';
    }
  }

  statusIcon(status: VoiceTaskStatus): string {
    switch (status) {
      case 'queued':
        return 'schedule';
      case 'running':
        return 'hourglass_empty';
      case 'done':
        return 'check_circle';
      case 'error':
        return 'error';
    }
  }

  statusClass(status: VoiceTaskStatus): string {
    switch (status) {
      case 'queued':
        return 'text-[var(--text-2)]';
      case 'running':
        return 'text-accent-blue';
      case 'done':
        return 'text-accent-green';
      case 'error':
        return 'text-accent-rose';
    }
  }

  typeLabel(type: VoiceTask['type']): string {
    switch (type) {
      case 'todo':
        return 'Task';
      case 'navigate':
        return 'Navigate';
      case 'list-todos':
        return 'List';
      case 'answer':
        return 'Question';
      case 'email':
        return 'Email';
      case 'translate':
        return 'Translate';
      case 'create-agent':
        return 'Agent';
      case 'summarize-gmail':
        return 'Gmail';
      case 'remember':
        return 'Memory';
      case 'recall':
        return 'Recall';
      case 'digest':
        return 'Digest';
      case 'reminder':
        return 'Reminder';
      case 'consolidate':
        return 'Consolidate';
    }
  }

  html(text: string): string {
    return this.dom.escapeHtml(text);
  }
}

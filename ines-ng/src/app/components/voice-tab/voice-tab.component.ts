import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import {
  VoiceAssistantService,
  VoiceTask,
  VoiceTaskStatus,
} from '../../core/services/voice-assistant.service';
import { LlmService } from '../../core/services/llm.service';
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
  readonly llm = inject(LlmService);
  private readonly dom = inject(DomUtilsService);

  readonly langs = [
    { value: 'it-IT', label: 'Italiano' },
    { value: 'en-US', label: 'English' },
    { value: 'fr-FR', label: 'Français' },
    { value: 'de-DE', label: 'Deutsch' },
    { value: 'es-ES', label: 'Español' },
  ];

  doneCount(): number {
    return this.assistant.tasks().filter((t) => t.status === 'done').length;
  }

  statusText(): string {
    if (this.assistant.listening()) return 'In ascolto…';
    if (this.assistant.processing()) return 'Sto pensando…';
    if (this.assistant.speaking()) return 'Sto parlando…';
    return 'Premi il microfono e parla';
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
        return 'Compito';
      case 'navigate':
        return 'Navigazione';
      case 'list-todos':
        return 'Elenco';
      case 'answer':
        return 'Domanda';
    }
  }

  html(text: string): string {
    return this.dom.escapeHtml(text);
  }
}

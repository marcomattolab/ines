import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ChatTabComponent } from '../chat-tab/chat-tab.component';
import { VoiceTabComponent } from '../voice-tab/voice-tab.component';
import { I18nService } from '../../core/services/i18n.service';

type AssistantTool = 'chat' | 'voice';
const ACTIVE_TOOL_KEY = 'ines_assistant_tool';

interface AssistantToolDef {
  id: AssistantTool;
  icon: string;
  label: string;
  labelIt: string;
  color: string;
  hex: string;
}

@Component({
  selector: 'app-assistant-tab',
  standalone: true,
  imports: [MatIconModule, ChatTabComponent, VoiceTabComponent],
  templateUrl: './assistant-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class AssistantTabComponent {
  private readonly i18n = inject(I18nService);

  readonly tools: AssistantToolDef[] = [
    {
      id: 'chat',
      icon: 'message-square',
      label: 'Chat',
      labelIt: 'Chat',
      color: 'text-blue-400',
      hex: '#60a5fa',
    },
    {
      id: 'voice',
      icon: 'record_voice_over',
      label: 'Voice',
      labelIt: 'Voce',
      color: 'text-cyan-400',
      hex: '#22d3ee',
    },
  ];

  readonly active = signal<AssistantTool>(this.restoreTool());

  toolLabel(t: AssistantToolDef): string {
    return this.i18n.isIt() ? t.labelIt : t.label;
  }

  setTool(id: AssistantTool): void {
    this.active.set(id);
    try {
      sessionStorage.setItem(ACTIVE_TOOL_KEY, id);
    } catch {
      /* best effort */
    }
  }

  private restoreTool(): AssistantTool {
    try {
      const v = sessionStorage.getItem(ACTIVE_TOOL_KEY);
      if (v === 'chat' || v === 'voice') return v;
    } catch {
      /* best effort */
    }
    return 'chat';
  }
}

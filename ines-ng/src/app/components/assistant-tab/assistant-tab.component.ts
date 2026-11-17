import { Component, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ChatTabComponent } from '../chat-tab/chat-tab.component';
import { VoiceTabComponent } from '../voice-tab/voice-tab.component';

type AssistantTool = 'chat' | 'voice';

@Component({
  selector: 'app-assistant-tab',
  standalone: true,
  imports: [MatIconModule, ChatTabComponent, VoiceTabComponent],
  templateUrl: './assistant-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class AssistantTabComponent {
  readonly tools: { id: AssistantTool; icon: string; label: string; color: string }[] = [
    { id: 'chat', icon: 'message-square', label: 'Chat', color: 'text-blue-400' },
    { id: 'voice', icon: 'record_voice_over', label: 'Voice', color: 'text-cyan-400' },
  ];

  readonly active = signal<AssistantTool>('chat');
}

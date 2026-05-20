import { Component, inject, input, computed } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../../core/services/toast.service';
import { SpeechService } from '../../core/services/speech.service';
import { ButtonComponent } from '../components/button/button.component';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [LucideAngularModule, ButtonComponent],
  templateUrl: './message-bubble.component.html',
  styleUrl: './message-bubble.css'
})
export class MessageBubbleComponent {
  role      = input.required<'user' | 'ai'>();
  text      = input<string>('');
  streaming = input<boolean>(false);

  private toast = inject(ToastService);
  private speech = inject(SpeechService);

  readonly msgId = 'msg-' + Math.random().toString(36).substring(2, 9);
  readonly isSpeaking = computed(() => this.speech.speaking() && this.speech.activeId() === this.msgId);

  safeHtml(): string {
    return String(this.text())
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/\n/g,'<br>');
  }

  copy() {
    navigator.clipboard.writeText(this.text()).then(() => this.toast.show('📋 Copied!'));
  }

  toggleSpeak() {
    this.speech.toggle(this.msgId, this.text());
  }
}

import { Component, inject, input, computed, output } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { ToastService } from '../../core/services/toast.service';
import { SpeechService } from '../../core/services/speech.service';
import { ButtonComponent } from '../components/button/button.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './message-bubble.component.html',
  styleUrl: './message-bubble.css',
})
export class MessageBubbleComponent {
  role = input.required<'user' | 'ai'>();
  text = input<string>('');
  streaming = input<boolean>(false);
  readonly onEdit = output<void>();

  private readonly toast = inject(ToastService);
  private readonly speech = inject(SpeechService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly msgId = 'msg-' + Math.random().toString(36).substring(2, 9);
  readonly isSpeaking = computed(
    () => this.speech.speaking() && this.speech.activeId() === this.msgId,
  );

  safeHtml(): SafeHtml {
    const raw = this.text();
    if (!raw) return '';
    if (this.role() === 'user') {
      return this.sanitizer.bypassSecurityTrustHtml(
        String(raw)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/\n/g, '<br>'),
      );
    }
    const html = marked.parse(raw, { breaks: true }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  copy() {
    navigator.clipboard.writeText(this.text()).then(() => this.toast.success('Copied!'));
  }

  toggleSpeak() {
    this.speech.toggle(this.msgId, this.text());
  }
}

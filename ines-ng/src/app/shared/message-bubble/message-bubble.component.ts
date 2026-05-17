import { Component, inject, input } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  template: `
    <div class="message" [class.user]="role() === 'user'" [class.ai]="role() === 'ai'">
      <div class="msg-avatar">{{ role() === 'user' ? '👤' : 'G' }}</div>
      <div class="msg-bubble" [class.cursor-blink]="streaming()">
        <span [innerHTML]="safeHtml()"></span>
        @if (role() === 'ai' && text()) {
          <button class="msg-copy" (click)="copy()">📋</button>
        }
      </div>
    </div>
  `,
  styleUrl: './message-bubble.css'
})
export class MessageBubbleComponent {
  role      = input.required<'user' | 'ai'>();
  text      = input<string>('');
  streaming = input<boolean>(false);

  private toast = inject(ToastService);

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
}

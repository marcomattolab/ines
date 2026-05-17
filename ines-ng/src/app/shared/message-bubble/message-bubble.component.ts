import { Component, inject, input } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  templateUrl: './message-bubble.component.html',
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

import { Directive, HostListener, output } from '@angular/core';

/**
 * Shared chat textarea behaviour: auto-grow on input and Enter-to-send.
 * Usage: <textarea appChatInput (send)="send()"></textarea>
 */
@Directive({
  selector: 'textarea[appChatInput]',
  standalone: true,
})
export class ChatInputDirective {
  readonly send = output<void>();

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send.emit();
    }
  }

  @HostListener('input', ['$event'])
  onInput(event: Event) {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }
}

import {
  Component,
  inject,
  input,
  computed,
  output,
  SecurityContext,
  AfterViewChecked,
  ElementRef,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { ToastService } from '../../core/services/toast.service';
import { SpeechService } from '../../core/services/speech.service';
import { ButtonComponent } from '../components/button/button.component';
import { MatIconModule } from '@angular/material/icon';

/**
 * Renders a message as sanitized HTML.
 *
 * Extracted from the component so the security-critical pipeline (user text
 * escaping, markdown parsing, HTML sanitization) can be unit tested directly.
 * `sanitizeHtml` must strip unsafe HTML — the component passes Angular's
 * `DomSanitizer.sanitize(SecurityContext.HTML, …)`.
 */
export function renderMessageHtml(
  raw: string,
  role: 'user' | 'ai',
  sanitizeHtml: (html: string) => string,
): string {
  if (!raw) return '';

  let html: string;
  if (role === 'user') {
    // User text is plain text: escape it, then render newlines.
    html = String(raw)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  } else {
    // AI text is markdown: parse it, then sanitize the resulting HTML
    // before it is bound with [innerHTML]. marked does NOT sanitize.
    html = marked.parse(raw, { breaks: true }) as string;
  }

  return sanitizeHtml(html);
}

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './message-bubble.component.html',
  styleUrl: './message-bubble.css',
})
export class MessageBubbleComponent implements AfterViewChecked {
  readonly contentEl = viewChild<ElementRef<HTMLDivElement>>('content');

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
    return renderMessageHtml(
      this.text(),
      this.role(),
      (html) => this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '',
    );
  }

  private mermaidP: Promise<any> | null = null;
  private getMermaid(): Promise<any> {
    if (!this.mermaidP) {
      this.mermaidP = import('mermaid').then((m) => {
        m.default.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
        return m.default;
      });
    }
    return this.mermaidP;
  }

  ngAfterViewChecked() {
    if (this.role() !== 'ai' || this.streaming()) return;
    const el = this.contentEl()?.nativeElement;
    if (!el) return;
    const blocks = el.querySelectorAll('code.language-mermaid:not([data-rendered])');
    blocks.forEach((block) => this.renderMermaidBlock(block as HTMLElement));
  }

  private async renderMermaidBlock(block: HTMLElement) {
    const code = (block.textContent || '').trim();
    if (!code) return;
    block.setAttribute('data-rendered', 'true');
    const pre = block.closest('pre') ?? block;
    try {
      const mermaid = await this.getMermaid();
      const id = 'mm-' + Math.random().toString(36).slice(2, 10);
      const { svg } = await mermaid.render(id, code);
      const container = document.createElement('div');
      container.className = 'mermaid-diagram';
      container.innerHTML = svg;
      pre.replaceWith(container);
    } catch {
      pre.classList.add('mermaid-failed');
    }
  }

  copy() {
    navigator.clipboard.writeText(this.text()).then(() => this.toast.success('Copied!'));
  }

  toggleSpeak() {
    this.speech.toggle(this.msgId, this.text());
  }
}

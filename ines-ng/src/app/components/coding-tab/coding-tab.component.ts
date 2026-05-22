import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  AfterViewChecked,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

interface UiMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
  streaming?: boolean;
}

const SYSTEM_CODING = `You are INES Coding Assistant, an elite client-side AI web developer and front-end architect.
You specialize in modern, responsive, and gorgeous web designs.
Always write clean, clean, production-ready code.
Wrap all your code inside single self-contained HTML markdown blocks:
\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Add rich, modern CSS styling here */
  </style>
</head>
<body>
  <!-- Structure -->
  <script>
    // Modern JS logic here
  </script>
</body>
</html>
\`\`\`
Ensure all designs are visually stunning: use smooth CSS gradients, dark mode aesthetics, glassmorphism, responsive grid/flexbox layouts, elegant typography, and subtle micro-animations.
Keep explanations extremely brief and let your premium code speak for itself. Always answer in the same language as the user.`;

@Component({
  selector: 'app-coding-tab',
  standalone: true,
  imports: [MessageBubbleComponent, TypingIndicatorComponent, MatIconModule, ButtonComponent],
  templateUrl: './coding-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
  styleUrl: './coding-tab.css',
})
export class CodingTabComponent implements AfterViewChecked {
  readonly chatArea = viewChild.required<ElementRef<HTMLDivElement>>('chatArea');
  readonly inputEl = viewChild.required<ElementRef<HTMLTextAreaElement>>('inputEl');

  llm = inject(LlmService);
  toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);

  messages = signal<UiMessage[]>([
    {
      id: 0,
      role: 'ai',
      text: "Hey developer! I'm INES, your client-side Coding Assistant. I can write premium, fully styled, and interactive web widgets. Describe what you want me to build, and you will see the live preview on the right!",
    },
  ]);
  typing = signal(false);
  generating = signal(false);
  tokenInfo = signal('');

  extractedCode = signal<string>('');
  playgroundTab = signal<'code' | 'preview'>('preview');

  private history: ChatMessage[] = [];
  private nextId = 1;
  private shouldScroll = false;

  rightPanelWidth = signal<number>(window.innerWidth * 0.58);
  inputAreaHeight = signal<number>(85);
  readonly codeLines = computed(() => this.extractedCode().split('\n'));
  readonly safeHtml = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.extractedCode()));
  private isResizing = false;
  private isHResizing = false;

  startResize(e: MouseEvent) {
    this.isResizing = true;
    e.preventDefault();
    document.addEventListener('mousemove', this.doResize);
    document.addEventListener('mouseup', this.stopResize);
  }

  private doResize = (e: MouseEvent) => {
    if (!this.isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 300 && newWidth <= window.innerWidth - 380) {
      this.rightPanelWidth.set(newWidth);
    }
  };

  private stopResize = () => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.doResize);
    document.removeEventListener('mouseup', this.stopResize);
  };

  startHResize(e: MouseEvent) {
    this.isHResizing = true;
    e.preventDefault();
    document.addEventListener('mousemove', this.doHResize);
    document.addEventListener('mouseup', this.stopHResize);
  }

  private doHResize = (e: MouseEvent) => {
    if (!this.isHResizing) return;
    const newHeight = window.innerHeight - e.clientY - 32; // Subtract footer height
    if (newHeight >= 60 && newHeight <= window.innerHeight - 150) {
      this.inputAreaHeight.set(newHeight);
    }
  };

  private stopHResize = () => {
    this.isHResizing = false;
    document.removeEventListener('mousemove', this.doHResize);
    document.removeEventListener('mouseup', this.stopHResize);
  };

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      const el = this.chatArea()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  autoResize(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  async send() {
    if (this.generating()) return;
    const text = this.inputEl().nativeElement.value.trim();
    if (!text) return;
    if (!this.llm.isReady()) {
      this.toast.show('⚠️ Load the model first!');
      return;
    }

    this.generating.set(true);
    this.inputEl().nativeElement.value = '';
    this.inputEl().nativeElement.style.height = '';

    this.history.push({ role: 'user', content: text });
    this.messages.update((m) => [...m, { id: this.nextId++, role: 'user', text }]);
    this.typing.set(true);
    this.shouldScroll = true;

    const prompt = this.llm.buildPrompt(SYSTEM_CODING, text, this.history.slice(-6, -1));
    const aiId = this.nextId++;

    try {
      let full = '';
      await this.llm.generate(prompt, (_, done, fullText) => {
        full = fullText;
        this.updateExtractedCode(fullText);

        if (this.typing()) {
          this.typing.set(false);
          this.messages.update((m) => [
            ...m,
            { id: aiId, role: 'ai', text: fullText, streaming: true },
          ]);
        } else {
          this.messages.update((m) =>
            m.map((msg) => (msg.id === aiId ? { ...msg, text: fullText, streaming: !done } : msg)),
          );
        }
        this.shouldScroll = true;
      });
      this.history.push({ role: 'assistant', content: full });
      this.tokenInfo.set(`${this.history.length} messages in history`);
    } catch (e: any) {
      this.typing.set(false);
      this.messages.update((m) => [
        ...m,
        { id: this.nextId++, role: 'ai', text: '❌ ' + e.message },
      ]);
    }

    this.generating.set(false);
  }

  private updateExtractedCode(text: string) {
    const match = text.match(/```html([\s\S]*?)```/) || text.match(/```([\s\S]*?)```/);
    if (match) {
      this.extractedCode.set(match[1].trim());
      return;
    }
    const streamMatch = text.match(/```html([\s\S]*)/) || text.match(/```([\s\S]*)/);
    if (streamMatch) {
      this.extractedCode.set(streamMatch[1].trim());
    }
  }

  copyCode() {
    if (!this.extractedCode()) return;
    navigator.clipboard.writeText(this.extractedCode()).then(() => {
      this.toast.show('📋 Code copied to clipboard!');
    });
  }

  downloadCode() {
    if (!this.extractedCode()) return;
    const blob = new Blob([this.extractedCode()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated_webpage.html';
    a.click();
    URL.revokeObjectURL(url);
    this.toast.show('💾 File download started!');
  }

  clear() {
    this.history = [];
    this.messages.set([
      { id: this.nextId++, role: 'ai', text: "Cleaned. Let's build something else!" },
    ]);
    this.tokenInfo.set('');
    this.extractedCode.set('');
  }
}

import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  AfterViewChecked,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { DocFetchService } from '../../core/services/doc-fetch.service';
import { KnowledgeManagerService } from '../../core/services/knowledge-manager.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

interface UiMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
  streaming?: boolean;
}

interface CodeFile {
  name: string;
  language: string;
  content: string;
}

const SYSTEM_CODING = `You are INES Coding Assistant, an expert Angular + TypeScript architect and senior frontend engineer.

Your specialties:
- Angular 17+ standalone components with signals, inject(), and OnPush change detection
- TypeScript 5+ with strict mode, generics, utility types, and discriminated unions
- RxJS observables, operators, subjects, and async patterns
- Angular Router, HTTP client, forms (reactive + template), and DI
- Tailwind CSS for styling, CSS custom properties for theming
- Vitest for unit testing, Cypress for E2E
- Clean architecture patterns: services, repositories, facades

CODE OUTPUT RULES (strict):
1. Always output at least TWO code blocks: the TypeScript component AND its HTML template.
2. If relevant, also include a CSS/SCSS block and/or a service block.
3. Each code block MUST start with a file-name comment on the FIRST line:
   \`\`\`typescript
   // my-component.component.ts
   import { Component, signal, inject } from '@angular/core';
   ...
   \`\`\`
4. Use these language tags exactly: \`\`\`typescript, \`\`\`html, \`\`\`css, \`\`\`scss
5. Write clean, production-ready code. Use Angular standalone components (no NgModules). Prefer signals over decorators. Use inject() for DI.
6. Keep explanations BRIEF — let the code speak. 1-2 sentences max before code blocks.
7. Answer in the same language as the user.
8. NEVER use markdown backticks inside explanations that could be confused with code blocks.

ANGULAR PATTERNS TO USE:
- standalone: true in @Component
- signal() for state, computed() for derivations
- inject() instead of constructor DI
- host: { class: '...' } for host bindings
- styleUrl / styleUrls for component styles
- viewChild / model / input / output signals
- AsyncPipe for observables in templates
- @if / @for / @switch control flow in templates
- provideHttpClient() etc. for providers`;

@Component({
  selector: 'app-coding-tab',
  standalone: true,
  imports: [MessageBubbleComponent, TypingIndicatorComponent, MatIconModule, ButtonComponent],
  templateUrl: './coding-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
  styleUrl: './coding-tab.css',
})
export class CodingTabComponent implements AfterViewChecked, OnDestroy {
  readonly chatArea = viewChild.required<ElementRef<HTMLDivElement>>('chatArea');
  readonly inputEl = viewChild.required<ElementRef<HTMLTextAreaElement>>('inputEl');

  llm = inject(LlmService);
  toast = inject(ToastService);
  docFetch = inject(DocFetchService);
  km = inject(KnowledgeManagerService);

  messages = signal<UiMessage[]>([
    {
      id: 0,
      role: 'ai',
      text: "Hey! I'm INES, your Angular + TypeScript coding assistant. Describe the component, service, or feature you need — I'll generate clean, standalone Angular code with signals, templates, and styles. The code appears on the right as file tabs.",
    },
  ]);
  typing = signal(false);
  generating = signal(false);
  tokenInfo = signal('');

  files = signal<CodeFile[]>([]);
  activeFileIndex = signal(0);

  rightPanelWidth = signal<number>(window.innerWidth * 0.58);
  inputAreaHeight = signal<number>(85);
  readonly activeFile = computed(() => this.files()[this.activeFileIndex()] ?? null);
  readonly codeLines = computed(() => {
    const f = this.activeFile();
    return f ? f.content.split('\n') : [];
  });

  private history: ChatMessage[] = [];
  private nextId = 1;
  private shouldScroll = false;
  showScrollBtn = signal(false);

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      const el = this.chatArea()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  onScroll() {
    const el = this.chatArea()?.nativeElement;
    if (!el) return;
    this.showScrollBtn.set(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
  }

  scrollToBottom() {
    const el = this.chatArea()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
      this.showScrollBtn.set(false);
    }
  }

  startResize(e: MouseEvent) {
    e.preventDefault();
    const doResize = (ev: MouseEvent) => {
      const newWidth = window.innerWidth - ev.clientX;
      if (newWidth >= 300 && newWidth <= window.innerWidth - 380) {
        this.rightPanelWidth.set(newWidth);
      }
    };
    const stopResize = () => {
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
    };
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
  }

  startHResize(e: MouseEvent) {
    e.preventDefault();
    const doResize = (ev: MouseEvent) => {
      const newHeight = window.innerHeight - ev.clientY - 32;
      if (newHeight >= 60 && newHeight <= window.innerHeight - 150) {
        this.inputAreaHeight.set(newHeight);
      }
    };
    const stopResize = () => {
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
    };
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
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

    let systemPrompt = SYSTEM_CODING;

    if (this.docFetch.docsLoaded() && this.km.documents().length > 0) {
      try {
        const chunks = await this.km.getRelevantChunks(text, 2, 200);
        if (chunks.length > 0) {
          const context = chunks.map((c) => c.text).join('\n\n---\n\n');
          systemPrompt += `\n\nANGULAR DOCS CONTEXT (use these APIs/precise signatures from official docs):\n${context}`;
        }
      } catch {
        /* RAG best-effort */
      }
    }

    const trimmed = this.llm.trimConversation(systemPrompt, text, this.history.slice(-6, -1));
    const prompt = this.llm.buildPrompt(systemPrompt, text, trimmed);
    const aiId = this.nextId++;

    try {
      let full = '';
      await this.llm.generate(prompt, (_, done, fullText) => {
        full = fullText;
        this.updateExtractedFiles(fullText);

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
      const msg = e.message?.includes('INVALID_ARGUMENT')
        ? '⚠️ The conversation is too long for this model. I cleared older messages — try asking again.'
        : '❌ ' + e.message;
      this.messages.update((m) => [...m, { id: this.nextId++, role: 'ai', text: msg }]);
    }

    this.generating.set(false);
  }

  private updateExtractedFiles(text: string) {
    const parsed = this.parseCodeBlocks(text);
    if (parsed.length > 0) {
      this.files.set(parsed);
      this.activeFileIndex.set(0);
    }
  }

  private parseCodeBlocks(text: string): CodeFile[] {
    const files: CodeFile[] = [];
    const regex = /```(\w+)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const language = match[1].toLowerCase();
      let content = match[2].trim();

      let name = this.fileNameForLang(language);
      const firstLine = content.split('\n')[0]?.trim() ?? '';
      if (firstLine.startsWith('//') && firstLine.includes('.')) {
        const candidate = firstLine.replace(/^\/\/\s*/, '').trim();
        if (/\.(ts|html|css|scss)$/.test(candidate)) {
          name = candidate;
        }
      }

      const existing = files.find((f) => f.name === name);
      if (existing) {
        existing.content += '\n\n' + content;
      } else {
        files.push({ name, language, content });
      }
    }

    return files;
  }

  private fileNameForLang(lang: string): string {
    switch (lang) {
      case 'typescript':
      case 'ts':
        return 'component.ts';
      case 'html':
        return 'component.html';
      case 'css':
        return 'component.css';
      case 'scss':
        return 'component.scss';
      case 'javascript':
      case 'js':
        return 'script.js';
      default:
        return `code.${lang}`;
    }
  }

  selectFile(index: number) {
    this.activeFileIndex.set(index);
  }

  copyFile(file: CodeFile) {
    navigator.clipboard.writeText(file.content).then(() => {
      this.toast.show(`📋 ${file.name} copied!`);
    });
  }

  copyAllCode() {
    const all = this.files()
      .map((f) => `// ${f.name}\n${f.content}`)
      .join('\n\n');
    if (!all) return;
    navigator.clipboard.writeText(all).then(() => {
      this.toast.show('📋 All files copied!');
    });
  }

  clear() {
    this.history = [];
    this.messages.set([
      { id: this.nextId++, role: 'ai', text: 'Cleaned. What Angular component should I build?' },
    ]);
    this.tokenInfo.set('');
    this.files.set([]);
    this.activeFileIndex.set(0);
  }

  async loadAngularDocs() {
    if (this.docFetch.isFetching()) return;
    try {
      await this.docFetch.fetchAngularDocs();
      await this.km.loadDocuments();
    } catch (err: any) {
      this.toast.error('Failed to load Angular docs: ' + err.message);
    }
  }

  codeColor(lang: string): string {
    switch (lang) {
      case 'typescript':
      case 'ts':
        return '#82b7ff';
      case 'html':
        return '#ff7aa8';
      case 'css':
      case 'scss':
        return '#56d9ff';
      case 'javascript':
      case 'js':
        return '#ffd869';
      default:
        return '#94a5c2';
    }
  }

  ngOnDestroy() {}
}

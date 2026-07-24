import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  AfterViewChecked,
  OnDestroy,
  viewChild,
  OnInit,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { DocFetchService } from '../../core/services/doc-fetch.service';
import { KnowledgeManagerService } from '../../core/services/knowledge-manager.service';
import { DomUtilsService } from '../../core/services/dom-utils.service';
import { SyntaxHighlightService } from '../../core/services/syntax-highlight.service';
import { StorageService } from '../../core/services/storage.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

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

const SYSTEM_CODING = `You are INES Coding Assistant, an expert software engineer skilled in Angular 22+, TypeScript, React, Next.js, Python, Rust, Go, Node.js, and modern web technologies.

You follow official style guides and community best practices for each language/framework.

When generating code, ALWAYS:
- Use the latest stable APIs and patterns for the requested language
- Output complete, production-ready files with imports and types
- Include the file name as a comment on line 1 of each code block
- Match the project's existing conventions when context is provided
- Keep explanations brief — 1-2 sentences max before code
- Answer in the same language as the user`;

@Component({
  selector: 'app-coding-tab',
  standalone: true,
  imports: [
    MessageBubbleComponent,
    TypingIndicatorComponent,
    MatIconModule,
    ButtonComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './coding-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
  styleUrl: './coding-tab.css',
})
export class CodingTabComponent implements AfterViewChecked, OnDestroy, OnInit {
  readonly chatArea = viewChild.required<ElementRef<HTMLDivElement>>('chatArea');
  readonly inputEl = viewChild.required<ElementRef<HTMLTextAreaElement>>('inputEl');

  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  readonly docFetch = inject(DocFetchService);
  readonly km = inject(KnowledgeManagerService);
  private readonly dom = inject(DomUtilsService);
  private readonly highlight = inject(SyntaxHighlightService);
  private readonly storage = inject(StorageService);

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

  readonly suggestionChips = [
    'React component with hooks and TypeScript',
    'Python FastAPI endpoint with validation',
    'Rust CLI tool with clap',
    'Go HTTP server with middleware',
    'Angular signal-based data table',
    'Node.js Express API with JWT auth',
    'React custom hook for data fetching',
  ];

  readonly highlightedCode = computed(() => {
    const f = this.activeFile();
    if (!f) return '';
    return this.highlight.highlight(f.content, f.language);
  });

  private history: ChatMessage[] = [];
  private nextId = 1;
  private shouldScroll = false;
  showScrollBtn = signal(false);
  showClearConfirm = signal(false);

  ngOnInit() {
    const stored = this.storage.get<CodeFile[]>('ines_coding_files');
    if (Array.isArray(stored) && stored.length > 0) {
      this.files.set(stored);
    }
  }

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
      this.toast.show('Load the model first!');
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
        const context = await this.km.getRagContext(text, 2, 200);
        if (context) {
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
      this.persistFiles();
    }
  }

  private persistFiles() {
    const current = this.files();
    if (current.length > 0) {
      this.storage.set('ines_coding_files', current);
    } else {
      this.storage.remove('ines_coding_files');
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

  useSuggestion(chip: string) {
    const el = this.inputEl()?.nativeElement;
    if (el) {
      el.value = chip;
      el.focus();
      el.dispatchEvent(new Event('input'));
    }
  }

  fileIcon(file: CodeFile): string {
    switch (file.language) {
      case 'typescript':
      case 'ts':
        return 'description';
      case 'html':
        return 'code';
      case 'css':
      case 'scss':
        return 'palette';
      case 'javascript':
      case 'js':
        return 'javascript';
      case 'json':
        return 'data_object';
      default:
        return 'insert_drive_file';
    }
  }

  closeFile(index: number, event: MouseEvent) {
    event.stopPropagation();
    const current = [...this.files()];
    current.splice(index, 1);
    this.files.set(current);
    this.persistFiles();
    if (this.activeFileIndex() >= current.length) {
      this.activeFileIndex.set(Math.max(0, current.length - 1));
    }
  }

  downloadFile(file: CodeFile) {
    this.dom.downloadText(file.content, file.name);
    this.toast.success(`${file.name} downloaded`);
  }

  regenerate() {
    const msgs = this.messages();
    if (msgs.length < 2) return;
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;

    this.messages.update((m) =>
      m.filter(
        (msg) => msg.role !== 'ai' || m.indexOf(msg) < m.findIndex((x) => x.id === lastUser.id),
      ),
    );
    this.history = this.history.filter((h) => h.role !== 'assistant');

    const el = this.inputEl()?.nativeElement;
    if (el) {
      el.value = lastUser.text;
      this.send();
    }
  }

  selectFile(index: number) {
    this.activeFileIndex.set(index);
  }

  copyFile(file: CodeFile) {
    this.dom.copyToClipboard(file.content).then(() => {
      this.toast.success(`${file.name} copied!`);
    });
  }

  copyAllCode() {
    const all = this.files()
      .map((f) => `// ${f.name}\n${f.content}`)
      .join('\n\n');
    if (!all) return;
    this.dom.copyToClipboard(all).then(() => {
      this.toast.success('All files copied!');
    });
  }

  clear() {
    this.history = [];
    this.messages.set([
      {
        id: this.nextId++,
        role: 'ai',
        text: 'Cleaned. What Angular 22 component should I build?',
      },
    ]);
    this.tokenInfo.set('');
    this.files.set([]);
    this.activeFileIndex.set(0);
    this.storage.remove('ines_coding_files');
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

  ngOnDestroy() {
    this.persistFiles();
  }
}

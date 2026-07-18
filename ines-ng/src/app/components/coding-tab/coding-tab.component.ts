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

const SYSTEM_CODING = `You are INES Coding Assistant, an expert Angular 22+ architect and senior frontend engineer.

You follow the official Angular Style Guide (https://angular.dev/style-guide), Google's TypeScript Style Guide, and the conventions of the Angular GitHub repository (https://github.com/angular/angular).

═══════════════════════════════════════
SECTION 1 — ANGULAR 22 FRAMEWORK KNOWLEDGE
═══════════════════════════════════════
- Standalone components only — no NgModules (https://angular.dev/guide/standalone-components)
- Signals for state: signal(), computed(), linkedSignal(), resource()
- Signal component API: input(), model(), output() — never @Input/@Output decorators
- inject() for all DI — never constructor parameter injection (https://angular.dev/style-guide#prefer-the-inject-function-over-constructor-parameter-injection)
- Zoneless change detection — signals + async pipe drive reactivity
- Control flow: @if, @for (with track), @switch, @defer — never *ngIf/*ngFor/*ngSwitch
- Lifecycle: afterRender(), afterNextRender() for browser-only DOM access
- RxJS: takeUntilDestroyed(), toSignal(), toObservable(), outputFromObservable()
- Router: functional guards/resolvers with inject(), provideRouter()
- HTTP: provideHttpClient(withFetch())
- Animations: provideAnimations() — no BrowserAnimationsModule
- Host bindings: host: { class: '...' } in @Component

═══════════════════════════════════════
SECTION 2 — NAMING & FILE CONVENTIONS
(per https://angular.dev/style-guide#naming)
═══════════════════════════════════════
- File names use kebab-case: user-profile.component.ts, auth.service.ts, sort.pipe.ts
- Test files suffix .spec.ts in the same directory: user-profile.component.spec.ts
- One concept per file (one component/directive/service/pipe per file)
- Component selector prefix: app- (e.g., selector: 'app-user-profile')
- Class names: PascalCase (UserProfileComponent)
- Properties/methods: camelCase (userName, getUserById)
- Interfaces: PascalCase, no 'I' prefix (User, not IUser)
- Enums: PascalCase, members PascalCase (Status.Active)
- Constants: UPPER_SNAKE_CASE or SCREAMING_SNAKE_CASE

═══════════════════════════════════════
SECTION 3 — COMPONENT STRUCTURE
(per https://angular.dev/style-guide#components-and-directives)
═══════════════════════════════════════
// Correct component structure order:
@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [...],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.css',
  host: { class: 'block' },
})
export class UserProfile implements OnInit {
  // 1. Injected dependencies (readonly)
  readonly http = inject(HttpClient);
  readonly router = inject(Router);

  // 2. Input signals (readonly + required where needed)
  readonly userId = input.required<string>();
  readonly mode = input<'edit' | 'view'>('view');

  // 3. Outputs (readonly)
  readonly saved = output<User>();
  readonly cancelled = output<void>();

  // 4. Model signals (readonly for two-way binding)
  readonly userName = model('');
  readonly userEmail = model('');

  // 5. View queries (readonly)
  readonly formRef = viewChild.required<ElementRef>('form');

  // 6. Private/computed state signals
  private readonly store = inject(UserStore);
  readonly isLoading = this.store.loading;
  protected isFormValid = computed(() => /* ... */);

  // 7. Lifecycle hooks (implement the interface)
  ngOnInit() { this.initialize(); }

  // 8. Methods (protected for template-only, public for API)
  protected save() { this.saved.emit(/* ... */); }
  protected cancel() { this.cancelled.emit(); }
}
- Use readonly on ALL injected deps, inputs, outputs, models, queries
- Use protected on members only consumed by the template
- Keep components focused on UI — extract business logic to services
- Avoid complex logic in templates — use computed() instead
- Name event handlers for what they DO: saveUser() not handleClick()
- Keep lifecycle hooks short — delegate to named private methods
- Implement the TypeScript interface for every lifecycle hook: implements OnInit, OnDestroy

═══════════════════════════════════════
SECTION 4 — TYPESCRIPT CONVENTIONS
(per Google TypeScript Style Guide)
═══════════════════════════════════════
- strict: true in tsconfig — never use 'any' without explicit reason
- Explicit return types on public methods: saveUser(): void
- Prefer const assertions: [1, 2, 3] as const
- discriminated unions over optional properties: { kind: 'A'; a: string } | { kind: 'B'; b: number }
- Use readonly arrays: readonly string[]
- Use Readonly<>, Partial<>, Required<>, Pick<>, Omit<> utility types
- Never use var — always const or let
- Prefer template literal types: type Event = \`\${Prefix}\${string}\`
- Prefer satisfies operator for type validation: const config = { ... } satisfies AppConfig
- Use null for intentionally empty, undefined for not-yet-set
- Use optional chaining and nullish coalescing: user?.address?.city ?? 'Unknown'
- No side effects in computed() — pure derivations only
- Type guards with is: function isUser(val: unknown): val is User
- Generics named descriptively: <TElement, TValue> not <T, U>

═══════════════════════════════════════
SECTION 5 — TEMPLATE CONVENTIONS
═══════════════════════════════════════
- Prefer [class.foo]="condition" and [style.color]="expr" over ngClass/ngStyle
- Use @if/@else, @for (with track), @switch/@case/@default in templates
- Use @defer for lazy-loading heavy sections with @placeholder, @loading, @error
- Avoid calling functions in template expressions — use computed() or pre-compute
- Use Angular Material Icons via <mat-icon fontIcon="name" />
- Bind via signals directly: {{ userId() }} not {{ userId }}
- Event binding: (click)="saveUser()" with descriptive handler names
- Two-way bind with model(): [(userName)]="modelSignal"
- Never use $any() cast in templates

═══════════════════════════════════════
SECTION 6 — SERVICE & ARCHITECTURE CONVENTIONS
═══════════════════════════════════════
- Services: @Injectable({ providedIn: 'root' }) — no module providers
- Keep services focused on a single responsibility
- Use private signal state exposed as readonly computed/callable
- Http calls via signal-based resource() or rxResource()
- Always handle errors — never leave promises uncaught
- Use DestroyRef + takeUntilDestroyed() for cleanup — no manual unsubscribe
- Prefer functional interceptors: withInterceptors([loggingInterceptor])
- Provide services at root level with providedIn: 'root'

═══════════════════════════════════════
SECTION 7 — CODE OUTPUT RULES (STRICT)
═══════════════════════════════════════
1. ALWAYS output at least TWO code blocks: TS component + HTML template.
2. Include CSS/SCSS and service/pipe/directive blocks when relevant.
3. Each code block MUST start with file-name comment on LINE 1:
   \`\`\`typescript
   // user-profile.component.ts
   import { Component, signal, inject, input, output } from '@angular/core';
   ...
   \`\`\`
4. Language tags: \`\`\`typescript, \`\`\`html, \`\`\`css, \`\`\`scss
5. Write production-ready Angular 22+ code following ALL sections above.
6. Keep explanations VERY BRIEF — 1-2 sentences before code blocks max.
7. Answer in the same language as the user.
8. Never use backticks inside explanations that could be confused with code blocks.
9. Match file names (kebab-case) to the class name (PascalCase): UserProfile → user-profile.component.ts
10. Include relevant spec file when asked: user-profile.component.spec.ts`;

@Component({
  selector: 'app-coding-tab',
  standalone: true,
  imports: [MessageBubbleComponent, TypingIndicatorComponent, MatIconModule, ButtonComponent],
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
    'Signal-based data table with sorting and pagination',
    'Auth service using resource() and signals',
    'Two-way binding form with model() inputs',
    'HTTP interceptor with inject() and takeUntilDestroyed()',
    'Reusable card component with input() and output()',
    'Route guard with inject() and functional resolver',
    '@defer block for lazy loading a heavy widget',
  ];

  readonly highlightedCode = computed(() => {
    const f = this.activeFile();
    if (!f) return '';
    return highlightCode(f.content, f.language);
  });

  private history: ChatMessage[] = [];
  private nextId = 1;
  private shouldScroll = false;
  showScrollBtn = signal(false);

  ngOnInit() {
    const raw = localStorage.getItem('ines_coding_files');
    if (!raw) return;
    try {
      const stored = JSON.parse(raw);
      if (Array.isArray(stored) && stored.length > 0) {
        this.files.set(stored);
      }
    } catch {
      localStorage.removeItem('ines_coding_files');
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
      this.persistFiles();
    }
  }

  private persistFiles() {
    try {
      const current = this.files();
      if (current.length > 0) {
        localStorage.setItem('ines_coding_files', JSON.stringify(current));
      } else {
        localStorage.removeItem('ines_coding_files');
      }
    } catch {
      // localStorage full or unavailable
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
    this.toast.show(`📥 ${file.name} downloaded`);
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
      this.toast.show(`📋 ${file.name} copied!`);
    });
  }

  copyAllCode() {
    const all = this.files()
      .map((f) => `// ${f.name}\n${f.content}`)
      .join('\n\n');
    if (!all) return;
    this.dom.copyToClipboard(all).then(() => {
      this.toast.show('📋 All files copied!');
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
    localStorage.removeItem('ines_coding_files');
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

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightCode(code: string, lang: string): string {
  const escaped = escapeHtml(code);

  switch (lang) {
    case 'typescript':
    case 'ts':
      return escaped
        .replace(
          /(&quot;[^&]*&quot;|&#39;[^&]*&#39;|`[^`]*`)/g,
          '<span class="hl-string">$1</span>',
        )
        .replace(/(\/\/.*)/g, '<span class="hl-comment">$1</span>')
        .replace(
          /\b(import|export|default|from|const|let|var|function|return|if|else|class|interface|type|enum|extends|implements|new|this|super|async|await|try|catch|throw|finally|typeof|instanceof|readonly|private|protected|public|static|abstract|as|in|of|void|never|unknown|any|boolean|string|number|symbol|null|undefined|true|false|switch|case|break|continue|for|while|do|yield|get|set)\b/g,
          '<span class="hl-keyword">$1</span>',
        )
        .replace(
          /\b(@Component|@Directive|@Pipe|@Injectable|@Input|@Output|@ViewChild|@HostListener|@HostBinding|@NgModule|signal|computed|linkedSignal|input|output|model|viewChild|viewChildren|contentChild|contentChildren|effect|inject|resource|afterRender|afterNextRender|takeUntilDestroyed|outputFromObservable|toSignal|toObservable)\b/g,
          '<span class="hl-decorator">$1</span>',
        )
        .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');

    case 'html':
      return escaped
        .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="hl-tag">$2</span>')
        .replace(/\/?&gt;/g, '<span class="hl-tag">$&</span>')
        .replace(
          /(\s[\w-]+)=(&quot;)/g,
          '<span class="hl-attr">$1</span>=<span class="hl-string">$2',
        )
        .replace(/&quot;/g, '&quot;</span>')
        .replace(/@(\w+)/g, '<span class="hl-decorator">@$1</span>')
        .replace(
          /\b(let|@if|@for|@switch|@defer|@placeholder|@loading|@error|@case|@default|@empty|track)\b/g,
          '<span class="hl-keyword">$1</span>',
        )
        .replace(/({{|}})/g, '<span class="hl-brace">$1</span>');

    case 'css':
    case 'scss':
      return escaped
        .replace(/([.#@]?[\w-]+)(?=\s*[{:,])/g, '<span class="hl-selector">$1</span>')
        .replace(/(:\s*)([^;{}]+)/g, '$1<span class="hl-value">$2</span>')
        .replace(/\/\*[\s\S]*?\*\//g, '<span class="hl-comment">$&</span>')
        .replace(
          /@(media|keyframes|import|supports|layer|container|apply|font-face|page|charset|namespace)\b/g,
          '<span class="hl-decorator">$&</span>',
        )
        .replace(/!important/g, '<span class="hl-keyword">!important</span>')
        .replace(
          /(\d+\.?\d*)(px|em|rem|%|vh|vw|ch|ex|deg|s|ms)/g,
          '<span class="hl-number">$1</span>$2',
        );

    case 'javascript':
    case 'js':
      return escaped
        .replace(
          /(&quot;[^&]*&quot;|&#39;[^&]*&#39;|`[^`]*`)/g,
          '<span class="hl-string">$1</span>',
        )
        .replace(/(\/\/.*)/g, '<span class="hl-comment">$1</span>')
        .replace(
          /\b(const|let|var|function|return|if|else|class|extends|new|this|async|await|try|catch|throw|import|export|default|from|typeof|instanceof|null|undefined|true|false)\b/g,
          '<span class="hl-keyword">$1</span>',
        )
        .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');

    default:
      return escaped;
  }
}

import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  AfterViewChecked,
  viewChild,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { StorageService } from '../../core/services/storage.service';
import { KnowledgeManagerService } from '../../core/services/knowledge-manager.service';
import { SecondBrainService } from '../../core/services/second-brain.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { DomUtilsService } from '../../core/services/dom-utils.service';
import { OcrService } from '../../core/services/ocr.service';
import { TextProcessingService } from '../../core/services/text-processing.service';
import { ChatInputDirective } from '../../shared/chat-input.directive';

interface UiMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
  streaming?: boolean;
  sources?: string[];
  image?: string;
}

const SYSTEM_CHAT = `You're a general AI assistant, helpful, precise, and friendly.
Respond concisely but completely. Use the same language as the user.
Don't mention that you're an open-source AI model unless asked.`;

const CHAT_STORAGE_KEY = 'ines_chat_history';
const CUSTOM_TEMPLATES_KEY = 'ines_chat_prompt_templates';
const MAX_STORED_MESSAGES = 50;
const MAX_HISTORY_LENGTH = 100;

interface StoredChat {
  messages: { id: number; role: 'user' | 'ai'; text: string }[];
  history: ChatMessage[];
  nextId: number;
}

interface PromptTemplate {
  id: string;
  label: string;
  icon: string;
  category: string;
  text: string;
}

@Component({
  selector: 'app-chat-tab',
  standalone: true,
  imports: [
    MessageBubbleComponent,
    TypingIndicatorComponent,
    MatIconModule,
    ButtonComponent,
    ConfirmDialogComponent,
    ChatInputDirective,
  ],
  templateUrl: './chat-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class ChatTabComponent implements AfterViewChecked, OnInit, OnDestroy {
  readonly chatArea = viewChild.required<ElementRef<HTMLDivElement>>('chatArea');
  readonly inputEl = viewChild.required<ElementRef<HTMLTextAreaElement>>('inputEl');

  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  readonly km = inject(KnowledgeManagerService);
  readonly brain = inject(SecondBrainService);
  private readonly storage = inject(StorageService);
  private readonly dom = inject(DomUtilsService);
  readonly ocr = inject(OcrService);
  private readonly textProc = inject(TextProcessingService);

  messages = signal<UiMessage[]>([
    {
      id: 0,
      role: 'ai',
      text: "Hi! I'm INES, an AI model that runs directly in your browser. Everything you write stays private on your device. How can I help you?",
    },
  ]);
  typing = signal(false);
  generating = signal(false);
  tokenInfo = signal('');
  editingMessageId = signal<number | null>(null);
  readonly attachedFile = signal<{
    kind: 'image' | 'pdf';
    file: File;
    preview?: string;
    name: string;
    text: string | null;
    busy: boolean;
  } | null>(null);

  readonly builtinTemplates: PromptTemplate[] = [
    {
      id: 'summarize',
      label: 'Summarize',
      icon: 'summarize',
      category: 'Writing',
      text: 'Summarize the key points of:',
    },
    {
      id: 'brainstorm',
      label: 'Brainstorm',
      icon: 'lightbulb',
      category: 'Analysis',
      text: 'Brainstorm 5 creative ideas for:',
    },
    {
      id: 'code-review',
      label: 'Code review',
      icon: 'code',
      category: 'Development',
      text: 'Review the following code and suggest concrete improvements:',
    },
    {
      id: 'explain-simple',
      label: 'Explain simply',
      icon: 'school',
      category: 'Learning',
      text: 'Explain this in simple terms, as if I am a complete beginner:',
    },
  ];

  readonly customTemplates = signal<PromptTemplate[]>(
    this.storage.get<PromptTemplate[]>(CUSTOM_TEMPLATES_KEY) ?? [],
  );
  readonly showTemplateForm = signal(false);

  readonly allTemplates = computed(() => [...this.builtinTemplates, ...this.customTemplates()]);

  readonly groupedTemplates = computed(() => {
    const groups: { category: string; templates: PromptTemplate[] }[] = [];
    for (const t of this.allTemplates()) {
      const last = groups[groups.length - 1];
      if (last && last.category === t.category) last.templates.push(t);
      else groups.push({ category: t.category, templates: [t] });
    }
    return groups;
  });

  showClearConfirm = signal(false);
  private abortController: AbortController | null = null;

  private history: ChatMessage[] = [];
  private nextId = 1;
  private shouldScroll = false;
  showScrollBtn = signal(false);

  ngOnInit() {
    const stored = this.storage.get<StoredChat>(CHAT_STORAGE_KEY);
    if (!stored?.messages?.length) return;
    this.messages.set(stored.messages.map((m) => ({ ...m, streaming: false })));
    this.history = stored.history ?? [];
    this.nextId = stored.nextId ?? this.messages().length + 1;
    this.tokenInfo.set(`${this.history.length} messages in history`);
  }

  private persist() {
    const msgs = this.messages()
      .slice(-MAX_STORED_MESSAGES)
      .map(({ streaming, ...rest }) => rest);
    const stored: StoredChat = {
      messages: msgs,
      history: this.history.slice(-MAX_STORED_MESSAGES),
      nextId: this.nextId,
    };
    this.storage.set(CHAT_STORAGE_KEY, stored);
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

  editMessage(msg: UiMessage) {
    if (msg.role !== 'user') return;
    this.editingMessageId.set(msg.id);
    const el = this.inputEl()?.nativeElement;
    if (el) {
      el.value = msg.text;
      el.focus();
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    }
  }

  cancelEdit() {
    this.editingMessageId.set(null);
    const el = this.inputEl()?.nativeElement;
    if (el) {
      el.value = '';
      el.style.height = '';
    }
  }

  async onAttachFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isImage && !isPdf) {
      this.toast.error("Allega un'immagine o un PDF");
      return;
    }
    const preview = isImage ? await this.readFileDataUrl(file) : undefined;
    this.attachedFile.set({
      kind: isImage ? 'image' : 'pdf',
      file,
      preview,
      name: file.name,
      text: null,
      busy: true,
    });
    try {
      const text = isImage
        ? await this.ocr.recognize(file)
        : await this.textProc.extractTextFromPdf(file);
      this.attachedFile.update((a) => (a ? { ...a, text: text || null, busy: false } : a));
      if (!text) this.toast.show('Nessun testo rilevato nel file');
    } catch {
      this.attachedFile.update((a) => (a ? { ...a, text: null, busy: false } : a));
    }
  }

  removeAttachedFile(): void {
    this.attachedFile.set(null);
  }

  private readFileDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  applyTemplate(tmpl: PromptTemplate) {
    const el = this.inputEl()?.nativeElement;
    if (!el) return;
    el.value = tmpl.text + '\n\n';
    el.focus();
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  isCustomTemplate(id: string): boolean {
    return id.startsWith('custom-');
  }

  saveCustomTemplate(name: string, prompt: string) {
    const label = name.trim();
    const text = prompt.trim();
    if (!label || !text) {
      this.toast.show('Both name and prompt are required');
      return;
    }
    const tmpl: PromptTemplate = {
      id: 'custom-' + Date.now().toString(36),
      label,
      icon: 'star',
      category: 'Custom',
      text,
    };
    this.customTemplates.update((list) => [...list, tmpl]);
    this.storage.set(CUSTOM_TEMPLATES_KEY, this.customTemplates());
    this.showTemplateForm.set(false);
    this.toast.success('Template saved');
  }

  removeCustomTemplate(id: string) {
    this.customTemplates.update((list) => list.filter((t) => t.id !== id));
    this.storage.set(CUSTOM_TEMPLATES_KEY, this.customTemplates());
  }

  async send() {
    if (this.generating()) return;
    const text = this.inputEl().nativeElement.value.trim();
    const file = this.attachedFile();
    if (!text && !file) return;
    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }

    // Include the extracted text of the attached image/PDF in the model input.
    let modelText = text;
    if (file) {
      const label = file.kind === 'image' ? 'Immagine allegata' : 'PDF allegato';
      const part = file.text
        ? `\n\n[${label}: ${file.name}]\nTesto estratto:\n${file.text}`
        : `\n\n[${label}: ${file.name} — nessun testo rilevato]`;
      modelText = text ? text + part : part.trim();
    }

    const displayText =
      text || (file ? (file.kind === 'pdf' ? `[PDF: ${file.name}]` : '[Immagine]') : '');

    this.generating.set(true);
    this.abortController = new AbortController();
    this.inputEl().nativeElement.value = '';
    this.inputEl().nativeElement.style.height = '';
    this.attachedFile.set(null);

    const editingId = this.editingMessageId();
    if (editingId !== null) {
      const idx = this.messages().findIndex((m) => m.id === editingId);
      if (idx >= 0) {
        const kept = this.messages().slice(0, idx + 1);
        this.messages.set(kept);
        const userMsgs = kept.filter((m) => m.role === 'user').length;
        const assistantMsgs = kept.filter((m) => m.role === 'ai').length;
        this.history = this.history.slice(0, userMsgs + assistantMsgs - 1);
      }
      this.editingMessageId.set(null);
      this.nextId = this.messages().reduce((max, m) => Math.max(max, m.id), 0) + 1;
    }

    this.history.push({ role: 'user', content: modelText });
    if (this.history.length > MAX_HISTORY_LENGTH)
      this.history = this.history.slice(-MAX_HISTORY_LENGTH);
    this.messages.update((m) => [
      ...m,
      { id: this.nextId++, role: 'user', text: displayText, image: file?.preview },
    ]);
    this.typing.set(true);
    this.shouldScroll = true;

    let systemPrompt = SYSTEM_CHAT;
    let sourceNames: string[] = [];
    const contextParts: string[] = [];

    // Second brain: saved notes
    const notes = (await this.brain.searchSemantic(text)).slice(0, 5);
    if (notes.length > 0) {
      sourceNames.push('Brain');
      contextParts.push('## Saved notes\n' + notes.map((n) => `- ${n.text}`).join('\n'));
    }

    // Knowledge base: documents
    try {
      const chunks = await this.km.getRelevantChunks(text, 3, 300);
      if (chunks.length > 0) {
        sourceNames.push(...chunks.map((c) => c.docName));
        contextParts.push(
          '## Documents\n' + chunks.map((c) => `[${c.docName}]\n${c.text}`).join('\n\n---\n\n'),
        );
      }
    } catch {
      /* RAG is best-effort */
    }

    sourceNames = [...new Set(sourceNames)];
    if (contextParts.length > 0) {
      systemPrompt += `\n\nYou have access to the user's personal knowledge base and second brain (saved notes and documents). Use the provided context when it is relevant and cite the source. If the context doesn't contain the answer, answer from your own knowledge.\n\nContext:\n${contextParts.join('\n\n')}`;
    }

    const trimmed = this.llm.trimConversation(systemPrompt, modelText, this.history.slice(-6, -1));
    const aiId = this.nextId++;

    try {
      let full = '';
      await this.llm.generate(
        systemPrompt,
        modelText,
        trimmed,
        (_, done, fullText) => {
          full = fullText;
          if (this.typing()) {
            this.typing.set(false);
            this.messages.update((m) => [
              ...m,
              { id: aiId, role: 'ai', text: fullText, streaming: true, sources: sourceNames },
            ]);
          } else {
            this.messages.update((m) =>
              m.map((msg) =>
                msg.id === aiId
                  ? { ...msg, text: fullText, streaming: !done, sources: sourceNames }
                  : msg,
              ),
            );
          }
          this.shouldScroll = true;
        },
        this.abortController?.signal,
      );
      this.history.push({ role: 'assistant', content: full });
      if (this.history.length > MAX_HISTORY_LENGTH)
        this.history = this.history.slice(-MAX_HISTORY_LENGTH);
      this.tokenInfo.set(`${this.history.length} messages in history`);
      this.persist();
    } catch (e: any) {
      this.typing.set(false);
      const msg = e.message?.includes('INVALID_ARGUMENT')
        ? '⚠️ The conversation is too long for this model. I cleared older messages — try asking again.'
        : '❌ ' + e.message;
      this.messages.update((m) => [...m, { id: this.nextId++, role: 'ai', text: msg }]);
    }

    this.generating.set(false);
    this.abortController = null;
  }

  stopGeneration() {
    this.abortController?.abort();
  }

  regenerate() {
    const msgs = this.messages();
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    this.messages.update((m) => {
      const idx = m.findIndex((x) => x.id === lastUser.id);
      return idx >= 0 ? m.slice(0, idx) : m;
    });
    let cutIdx = -1;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].role === 'user') {
        cutIdx = i;
        break;
      }
    }
    this.history = cutIdx >= 0 ? this.history.slice(0, cutIdx) : [];
    const el = this.inputEl()?.nativeElement;
    if (el) {
      el.value = lastUser.text;
      this.send();
    }
  }

  clear() {
    this.history = [];
    this.messages.set([{ id: this.nextId++, role: 'ai', text: 'Chat cleaned. Can I help you?' }]);
    this.tokenInfo.set('');
    this.storage.remove(CHAT_STORAGE_KEY);
  }

  exportChat(format: 'md' | 'json') {
    const msgs = this.messages()
      .filter((m) => !m.streaming)
      .map((m) => ({ role: m.role, text: m.text }));
    const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    if (format === 'json') {
      this.dom.downloadText(JSON.stringify(msgs, null, 2), `chat-${ts}.json`);
    } else {
      const md = msgs
        .map((m) => `### ${m.role === 'user' ? 'You' : 'INES'}\n\n${m.text}\n`)
        .join('\n');
      this.dom.downloadText(md, `chat-${ts}.md`);
    }
    this.toast.success(`Exported as .${format}`);
  }

  async importChat(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const raw = Array.isArray(data) ? data : data?.messages;
      if (!Array.isArray(raw)) throw new Error('invalid');
      const imported = raw
        .filter(
          (m: any) =>
            m && typeof m.text === 'string' && ['user', 'ai', 'assistant'].includes(m.role),
        )
        .map((m: any) => ({
          id: this.nextId++,
          role: m.role === 'assistant' ? 'ai' : m.role,
          text: m.text,
        }));
      if (imported.length === 0) throw new Error('empty');
      this.messages.set(imported);
      this.history = imported.map((m) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text,
      }));
      this.tokenInfo.set(`${this.history.length} messages in history`);
      this.persist();
      this.toast.success(`Imported ${imported.length} messages`);
    } catch {
      this.toast.error('Invalid chat JSON file');
    }
    input.value = '';
  }

  ngOnDestroy() {
    this.persist();
  }

  html(text: string) {
    return this.dom.escapeHtml(text);
  }
}

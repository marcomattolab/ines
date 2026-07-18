import {
  Component,
  inject,
  signal,
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
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { DomUtilsService } from '../../core/services/dom-utils.service';

interface UiMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
  streaming?: boolean;
}

const SYSTEM_CHAT = `You're a general AI assistant, helpful, precise, and friendly.
Respond concisely but completely. Use the same language as the user.
Don't mention that you're an open-source AI model unless asked.`;

const CHAT_STORAGE_KEY = 'ines_chat_history';
const MAX_STORED_MESSAGES = 50;
const MAX_HISTORY_LENGTH = 100;

interface StoredChat {
  messages: { id: number; role: 'user' | 'ai'; text: string }[];
  history: ChatMessage[];
  nextId: number;
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
  ],
  templateUrl: './chat-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class ChatTabComponent implements AfterViewChecked, OnInit, OnDestroy {
  readonly chatArea = viewChild.required<ElementRef<HTMLDivElement>>('chatArea');
  readonly inputEl = viewChild.required<ElementRef<HTMLTextAreaElement>>('inputEl');

  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  private readonly storage = inject(StorageService);
  private readonly dom = inject(DomUtilsService);

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
    this.abortController = new AbortController();
    this.inputEl().nativeElement.value = '';
    this.inputEl().nativeElement.style.height = '';

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

    this.history.push({ role: 'user', content: text });
    if (this.history.length > MAX_HISTORY_LENGTH)
      this.history = this.history.slice(-MAX_HISTORY_LENGTH);
    this.messages.update((m) => [...m, { id: this.nextId++, role: 'user', text }]);
    this.typing.set(true);
    this.shouldScroll = true;

    const trimmed = this.llm.trimConversation(SYSTEM_CHAT, text, this.history.slice(-6, -1));
    const prompt = this.llm.buildPrompt(SYSTEM_CHAT, text, trimmed);
    const aiId = this.nextId++;

    try {
      let full = '';
      await this.llm.generate(
        prompt,
        (_, done, fullText) => {
          full = fullText;
          if (this.typing()) {
            this.typing.set(false);
            this.messages.update((m) => [
              ...m,
              { id: aiId, role: 'ai', text: fullText, streaming: true },
            ]);
          } else {
            this.messages.update((m) =>
              m.map((msg) =>
                msg.id === aiId ? { ...msg, text: fullText, streaming: !done } : msg,
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
    this.messages.update((m) =>
      m.filter(
        (msg) => msg.role !== 'ai' || m.indexOf(msg) < m.findIndex((x) => x.id === lastUser.id),
      ),
    );
    this.history = this.history.filter((h) => h.role === 'user');
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

  ngOnDestroy() {
    this.persist();
  }

  html(text: string) {
    return this.dom.escapeHtml(text);
  }
}

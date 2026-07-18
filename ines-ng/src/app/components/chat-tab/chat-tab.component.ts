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
  imports: [MessageBubbleComponent, TypingIndicatorComponent, MatIconModule, ButtonComponent],
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
      await this.llm.generate(prompt, (_, done, fullText) => {
        full = fullText;
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
  }

  clear() {
    this.history = [];
    this.messages.set([{ id: this.nextId++, role: 'ai', text: 'Chat cleaned. Can I help you?' }]);
    this.tokenInfo.set('');
    this.storage.remove(CHAT_STORAGE_KEY);
  }

  ngOnDestroy() {
    this.persist();
  }

  html(text: string) {
    return this.dom.escapeHtml(text);
  }
}

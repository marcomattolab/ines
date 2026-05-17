import { Component, inject, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';

interface UiMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
  streaming?: boolean;
}

const SYSTEM_CHAT = `You're a general AI assistant, helpful, precise, and friendly.
Respond concisely but completely. Use the same language as the user.
Don't mention that you're an open-source AI model unless asked.`;

@Component({
  selector: 'app-chat-tab',
  standalone: true,
  imports: [MessageBubbleComponent, TypingIndicatorComponent],
  template: `
    <div class="tab-panel-inner">
      <div class="panel-header">
        <div>
          <div class="panel-title"><span class="panel-title-icon">💬</span> General Assistant</div>
          <div class="panel-desc">Gemma on-device · private · offline</div>
        </div>
        <button class="pill-btn" (click)="clear()">🗑 Clear</button>
      </div>

      <div class="chat-area" #chatArea>
        @for (msg of messages(); track msg.id) {
          @if (msg.role === 'ai' && msg.streaming) {
            <div class="message ai">
              <div class="msg-avatar">G</div>
              <div class="msg-bubble cursor-blink" [innerHTML]="html(msg.text)"></div>
            </div>
          } @else {
            <app-message-bubble [role]="msg.role" [text]="msg.text" [streaming]="!!msg.streaming" />
          }
        }
        @if (typing()) {
          <div class="message ai">
            <div class="msg-avatar">G</div>
            <div class="msg-bubble"><app-typing-indicator /></div>
          </div>
        }
      </div>

      <div class="token-info">{{ tokenInfo() }}</div>

      <div class="input-zone">
        <textarea class="input-field" #inputEl
          placeholder="Write a message..."
          rows="1"
          (keydown)="onKey($event)"
          (input)="autoResize($event)"></textarea>
        <button class="send-btn" [disabled]="generating()" (click)="send()" title="Send (Enter)">➤</button>
      </div>
    </div>
  `,
  styleUrl: './chat-tab.css'
})
export class ChatTabComponent implements AfterViewChecked {
  @ViewChild('chatArea') chatArea!: ElementRef<HTMLDivElement>;
  @ViewChild('inputEl')  inputEl!: ElementRef<HTMLTextAreaElement>;

  llm   = inject(LlmService);
  toast = inject(ToastService);

  messages  = signal<UiMessage[]>([{ id: 0, role: 'ai', text: "Hi! I'm Gemma, an AI model that runs directly in your browser. Everything you write stays private on your device. How can I help you?" }]);
  typing    = signal(false);
  generating = signal(false);
  tokenInfo = signal('');

  private history: ChatMessage[] = [];
  private nextId = 1;
  private shouldScroll = false;

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      const el = this.chatArea?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
  }

  autoResize(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  async send() {
    if (this.generating()) return;
    const text = this.inputEl.nativeElement.value.trim();
    if (!text) return;
    if (!this.llm.isReady()) {
      this.toast.show('⚠️ Load the model first!');
      return;
    }

    this.generating.set(true);
    this.inputEl.nativeElement.value = '';
    this.inputEl.nativeElement.style.height = '';

    this.history.push({ role: 'user', content: text });
    this.messages.update(m => [...m, { id: this.nextId++, role: 'user', text }]);
    this.typing.set(true);
    this.shouldScroll = true;

    const prompt = this.llm.buildPrompt(SYSTEM_CHAT, text, this.history.slice(-6, -1));
    const aiId = this.nextId++;

    try {
      let full = '';
      await this.llm.generate(prompt, (_, done, fullText) => {
        full = fullText;
        if (this.typing()) {
          this.typing.set(false);
          this.messages.update(m => [...m, { id: aiId, role: 'ai', text: fullText, streaming: true }]);
        } else {
          this.messages.update(m => m.map(msg =>
            msg.id === aiId ? { ...msg, text: fullText, streaming: !done } : msg
          ));
        }
        this.shouldScroll = true;
      });
      this.history.push({ role: 'assistant', content: full });
      this.tokenInfo.set(`${this.history.length} messages in history`);
    } catch (e: any) {
      this.typing.set(false);
      this.messages.update(m => [...m, { id: this.nextId++, role: 'ai', text: '❌ ' + e.message }]);
    }

    this.generating.set(false);
  }

  clear() {
    this.history = [];
    this.messages.set([{ id: this.nextId++, role: 'ai', text: 'Chat cleaned. Can I help you?' }]);
    this.tokenInfo.set('');
  }

  html(text: string) {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }
}

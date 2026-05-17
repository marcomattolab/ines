import { Component, inject, signal, computed } from '@angular/core';
import { TodoService } from '../../core/services/todo.service';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';

interface AiChat { id: number; role: 'user'|'ai'; text: string; typing?: boolean; }

const SYSTEM_TODO = `You are a productivity assistant for planning.
Your task is to generate a list of tasks for the day based on what the user describes.

Respond ONLY with a JSON object (nothing else, no markdown, no backticks) in this format:
{
  "tasks": [
    {"text": "Task description", "priority": "normal"},
    {"text": "Urgent task description", "priority": "priority"}
  ],
  "message": "Brief motivational message (1 sentence)"
}

Generate 4 to 8 concrete, specific and realistic tasks. "priority" can be "normal" or "priority".`;

@Component({
  selector: 'app-todo-tab',
  standalone: true,
  imports: [MessageBubbleComponent, TypingIndicatorComponent],
  template: `
    <div class="tab-panel-inner">
      <div class="panel-header">
        <div>
          <div class="panel-title"><span class="panel-title-icon">✅</span> Daily Planner</div>
          <div class="panel-desc">Organize your day with the help of the AI</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="counter-text">{{ todoSvc.doneCount }}/{{ todoSvc.total }} completed</span>
          <button class="pill-btn" (click)="todoSvc.clearDone()">🧹 Remove completed</button>
        </div>
      </div>

      <div class="todo-layout">
        <div class="todo-left">
          <div class="todo-list">
            @if (todoSvc.todos().length === 0) {
              <div class="empty-state">
                <div class="empty-icon">📋</div>
                <div class="empty-text">No tasks. Add one manually or ask the AI to plan your day!</div>
              </div>
            }
            @for (todo of todoSvc.todos(); track $index) {
              <div class="todo-item" [class.done]="todo.done">
                <div class="todo-cb" [class.checked]="todo.done" (click)="todoSvc.toggle($index)"></div>
                <div class="todo-text">{{ todo.text }}</div>
                <span class="todo-tag" [class]="todo.priority">
                  {{ todo.priority === 'priority' ? '🔥 priority' : '·' }}
                </span>
                <button class="todo-del" (click)="todoSvc.delete($index)" title="Remove">✕</button>
              </div>
            }
          </div>
          <div class="todo-add-row">
            <input class="todo-input" #manualInput
              placeholder="Add a task manually..."
              (keydown.enter)="addManual(manualInput)">
            <select class="pill-select" #prioritySel>
              <option value="normal">normal</option>
              <option value="priority">🔥 priority</option>
            </select>
            <button class="add-btn" (click)="addManual(manualInput, prioritySel)">+ Add</button>
          </div>
        </div>

        <div class="todo-right">
          <div class="todo-pane-label">🤖 GENERATE WITH AI</div>
          <div class="chat-area" #aiChat>
            @for (msg of aiMessages(); track msg.id) {
              @if (msg.typing) {
                <div class="message ai">
                  <div class="msg-avatar">G</div>
                  <div class="msg-bubble"><app-typing-indicator /></div>
                </div>
              } @else {
                <app-message-bubble [role]="msg.role" [text]="msg.text" />
              }
            }
          </div>
          <div class="todo-ai-input-area">
            <textarea class="todo-ai-textarea" #aiInput
              placeholder="Describe your day or ask to plan activities...&#10;Example: 'I have a demo at 3 PM, code review and team call'"
              (keydown)="onAiKey($event, aiInput)"></textarea>
            <button class="add-btn" style="align-self:flex-end" (click)="generate(aiInput)">✨ Generate Plan</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './todo-tab.css'
})
export class TodoTabComponent {
  todoSvc = inject(TodoService);
  llm     = inject(LlmService);
  toast   = inject(ToastService);

  aiMessages = signal<AiChat[]>([]);
  private nextId = 0;

  addManual(input: HTMLInputElement, selEl?: HTMLSelectElement) {
    const text = input.value.trim();
    if (!text) return;
    const priority = (selEl?.value ?? 'normal') as 'normal' | 'priority';
    this.todoSvc.add(text, priority);
    input.value = '';
  }

  onAiKey(e: KeyboardEvent, el: HTMLTextAreaElement) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.generate(el); }
  }

  async generate(textarea: HTMLTextAreaElement) {
    const desc = textarea.value.trim();
    if (!desc) { this.toast.show('⚠️ Describe what you have to do today'); return; }
    if (!this.llm.isReady()) { this.toast.show('⚠️ Load the model first!'); return; }

    const userMsgId = this.nextId++;
    const typingId  = this.nextId++;
    this.aiMessages.update(m => [
      ...m,
      { id: userMsgId, role: 'user', text: desc },
      { id: typingId,  role: 'ai',   text: '',    typing: true },
    ]);
    textarea.value = '';

    const prompt = this.llm.buildPrompt(SYSTEM_TODO, `Today I have to do: ${desc}. Plan my day.`);

    try {
      let fullText = '';
      await this.llm.generate(prompt, (_, done, full) => {
        fullText = full;
        this.aiMessages.update(m => m.map(msg =>
          msg.id === typingId ? { ...msg, typing: false, text: done ? 'Parsing tasks...' : full.substring(0, 80) + '...' } : msg
        ));
      });

      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        this.todoSvc.addMany(data.tasks);
        this.aiMessages.update(m => m.map(msg =>
          msg.id === typingId
            ? { ...msg, text: `✅ Added ${data.tasks.length} tasks! ${data.message || ''}` }
            : msg
        ));
      } else {
        throw new Error('Invalid JSON in response');
      }
    } catch(e: any) {
      this.aiMessages.update(m => m.map(msg =>
        msg.id === typingId ? { ...msg, typing: false, text: '❌ ' + e.message } : msg
      ));
    }
  }
}

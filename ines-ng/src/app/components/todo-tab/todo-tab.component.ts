import {
  Component,
  inject,
  signal,
  computed,
  OnDestroy,
  effect,
  HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { TodoService, Todo } from '../../core/services/todo.service';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { SpeechService } from '../../core/services/speech.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { JsonParserService } from '../../core/services/json-parser.service';

type FilterTab = 'all' | 'active' | 'completed';

interface AiChat {
  id: number;
  role: 'user' | 'ai';
  text: string;
  typing?: boolean;
}

const SYSTEM_TODO = `You are a productivity assistant for planning.
Your task is to generate a list of tasks for the day based on what the user describes.

Respond ONLY with a JSON object (nothing else, no markdown, no backticks) in this format:
{
  "tasks": [
    {"text": "Task description", "priority": "normal", "category": "work"},
    {"text": "Urgent task description", "priority": "priority", "category": "personal"}
  ],
  "message": "Brief motivational message (1 sentence)"
}

Generate 4 to 8 concrete, specific and realistic tasks. "priority" can be "normal" or "priority".
"category" can be "work", "personal", "health", or "other".`;

@Component({
  selector: 'app-todo-tab',
  standalone: true,
  imports: [
    FormsModule,
    MessageBubbleComponent,
    TypingIndicatorComponent,
    MatIconModule,
    ButtonComponent,
    DragDropModule,
    ConfirmDialogComponent,
  ],
  templateUrl: './todo-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
  styleUrl: './todo-tab.css',
})
export class TodoTabComponent implements OnDestroy {
  readonly todoSvc = inject(TodoService);
  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  readonly speech = inject(SpeechService);
  private readonly jsonParser = inject(JsonParserService);
  readonly recording = this.speech.recording;
  readonly timerText = this.speech.recordingTimer;

  aiMessages = signal<AiChat[]>([]);
  rightPanelWidth = signal(320);
  inputAreaHeight = signal(200);
  showClearConfirm = signal(false);
  filterTab = signal<FilterTab>('all');
  editingId = signal<number | null>(null);
  editText = signal('');
  popoverId = signal<number | null>(null);
  popoverType = signal<'priority' | 'category' | null>(null);
  newCategory = signal<Todo['category']>('work');
  newDueDate = signal('');

  readonly categories = [
    { value: 'work' as const, label: 'Work', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    {
      value: 'personal' as const,
      label: 'Personal',
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
    },
    { value: 'health' as const, label: 'Health', color: 'text-green-400', bg: 'bg-green-400/10' },
    { value: 'other' as const, label: 'Other', color: 'text-zinc-400', bg: 'bg-zinc-400/10' },
  ];

  readonly filterOptions: { value: FilterTab; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: 'list' },
    { value: 'active', label: 'Active', icon: 'radio_button_unchecked' },
    { value: 'completed', label: 'Done', icon: 'check_circle' },
  ];

  readonly activeCount = computed(() => this.todoSvc.todos().filter((t) => !t.done).length);
  readonly progressPercent = computed(() => {
    const t = this.todoSvc.total();
    if (t === 0) return 0;
    return Math.round((this.todoSvc.doneCount() / t) * 100);
  });

  readonly filteredTodos = computed(() => {
    const f = this.filterTab();
    return this.todoSvc.todos().filter((t) => {
      if (f === 'active') return !t.done;
      if (f === 'completed') return t.done;
      return true;
    });
  });

  constructor() {
    effect(() => {
      const editing = this.editingId();
      if (editing !== null) {
        this.editText.set(this.todoSvc.todos().find((t) => t.id === editing)?.text || '');
      }
    });
  }

  getCategoryClass(cat?: Todo['category']) {
    const c = this.categories.find((x) => x.value === (cat || 'other'));
    return c ? `${c.color} ${c.bg}` : 'text-zinc-400 bg-zinc-400/10';
  }

  getCategoryLabel(cat?: Todo['category']) {
    const c = this.categories.find((x) => x.value === (cat || 'other'));
    return c ? c.label : 'Other';
  }

  formatDate(date?: string): string {
    if (!date) return '';
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0 && diff <= 7) return `${diff}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  isOverdue(date?: string): boolean {
    if (!date) return false;
    return new Date(date).getTime() < new Date().setHours(0, 0, 0, 0);
  }

  private nextId = 0;
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
    if (newWidth >= 280 && newWidth <= window.innerWidth - 300) {
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
    const newHeight = window.innerHeight - e.clientY - 28;
    if (newHeight >= 100 && newHeight <= window.innerHeight - 200) {
      this.inputAreaHeight.set(newHeight);
    }
  };

  private stopHResize = () => {
    this.isHResizing = false;
    document.removeEventListener('mousemove', this.doHResize);
    document.removeEventListener('mouseup', this.stopHResize);
  };

  drop(event: CdkDragDrop<string[]>) {
    this.todoSvc.reorder(event.previousIndex, event.currentIndex);
  }

  addManual(
    input: HTMLInputElement,
    selEl?: HTMLSelectElement,
    catSel?: HTMLSelectElement,
    dateEl?: HTMLInputElement,
  ) {
    const text = input.value.trim();
    if (!text) return;
    const priority = (selEl?.value ?? 'normal') as 'normal' | 'priority';
    const category = (catSel?.value ?? 'work') as Todo['category'];
    const dueDate = dateEl?.value || undefined;
    this.todoSvc.add(text, priority, category, dueDate);
    input.value = '';
    if (dateEl) dateEl.value = '';
  }

  startEdit(todo: Todo) {
    this.editingId.set(todo.id);
    this.editText.set(todo.text);
  }

  saveEdit(id: number) {
    const text = this.editText().trim();
    if (text) {
      this.todoSvc.updateText(id, text);
    }
    this.editingId.set(null);
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.closePopover();
  }

  togglePopover(todoId: number, type: 'priority' | 'category') {
    if (this.popoverId() === todoId && this.popoverType() === type) {
      this.closePopover();
    } else {
      this.popoverId.set(todoId);
      this.popoverType.set(type);
    }
  }

  closePopover() {
    this.popoverId.set(null);
    this.popoverType.set(null);
  }

  setPriority(todo: Todo, priority: Todo['priority']) {
    this.todoSvc.updatePriority(todo.id, priority);
    this.closePopover();
  }

  setCategory(todo: Todo, category: Todo['category']) {
    this.todoSvc.updateCategory(todo.id, category);
    this.closePopover();
  }

  onEditKey(e: KeyboardEvent, id: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.saveEdit(id);
    } else if (e.key === 'Escape') {
      this.cancelEdit();
    }
  }

  onAiKey(e: KeyboardEvent, el: HTMLTextAreaElement) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.generate(el);
    }
  }

  toggleRecording(textarea: HTMLTextAreaElement) {
    this.speech.recording() ? this.stopRecording() : this.startRecording(textarea);
  }

  startRecording(textarea: HTMLTextAreaElement) {
    const ok = this.speech.startRecording(textarea.value, (text) => {
      textarea.value = text;
    });
    if (!ok) {
      this.toast.show('Web Speech API not supported in this browser');
    }
  }

  stopRecording() {
    this.speech.stopRecording();
  }

  async generate(textarea: HTMLTextAreaElement) {
    if (this.speech.recording()) this.speech.stopRecording();

    const desc = textarea.value.trim();
    if (!desc) {
      this.toast.show('Describe what you have to do today');
      return;
    }
    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }

    const userMsgId = this.nextId++;
    const typingId = this.nextId++;
    this.aiMessages.update((m) => [
      ...m,
      { id: userMsgId, role: 'user', text: desc },
      { id: typingId, role: 'ai', text: '', typing: true },
    ]);
    textarea.value = '';

    const prompt = this.llm.buildPrompt(SYSTEM_TODO, `Today I have to do: ${desc}. Plan my day.`);

    try {
      let fullText = '';
      await this.llm.generate(prompt, (_, done, full) => {
        fullText = full;
        this.aiMessages.update((m) =>
          m.map((msg) =>
            msg.id === typingId
              ? {
                  ...msg,
                  typing: false,
                  text: done ? 'Parsing tasks...' : full.substring(0, 80) + '...',
                }
              : msg,
          ),
        );
      });

      const data = this.jsonParser.parseObject<{
        tasks: { text: string; priority: string; category?: string }[];
        message: string;
      }>(fullText);
      if (data?.tasks) {
        this.todoSvc.addMany(data.tasks);
        this.aiMessages.update((m) =>
          m.map((msg) =>
            msg.id === typingId
              ? { ...msg, text: `Added ${data.tasks.length} tasks! ${data.message || ''}` }
              : msg,
          ),
        );
      } else {
        throw new Error('Invalid JSON in response');
      }
    } catch (e: any) {
      this.aiMessages.update((m) =>
        m.map((msg) =>
          msg.id === typingId ? { ...msg, typing: false, text: '❌ ' + e.message } : msg,
        ),
      );
    }
  }

  undoLast() {
    if (!this.todoSvc.undo()) {
      this.toast.show('Nothing to undo');
    } else {
      this.toast.show('Undo!');
    }
  }

  ngOnDestroy() {
    this.stopResize();
    this.stopHResize();
    this.speech.abortRecording();
  }
}

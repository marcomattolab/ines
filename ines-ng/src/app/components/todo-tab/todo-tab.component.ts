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
import { DomUtilsService } from '../../core/services/dom-utils.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { JsonParserService } from '../../core/services/json-parser.service';
import { trackDragResize } from '../../shared/resize.util';

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
  private readonly dom = inject(DomUtilsService);
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
  readonly ringCircumference = 2 * Math.PI * 15; // donut radius 15

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
  private disposeResize: (() => void) | null = null;
  private disposeHResize: (() => void) | null = null;

  startResize(e: MouseEvent) {
    this.disposeResize?.();
    this.disposeResize = trackDragResize(e, (ev) => {
      const newWidth = window.innerWidth - ev.clientX;
      if (newWidth >= 280 && newWidth <= window.innerWidth - 300) {
        this.rightPanelWidth.set(newWidth);
      }
    });
  }

  startHResize(e: MouseEvent) {
    this.disposeHResize?.();
    this.disposeHResize = trackDragResize(e, (ev) => {
      const newHeight = window.innerHeight - ev.clientY - 28;
      if (newHeight >= 100 && newHeight <= window.innerHeight - 200) {
        this.inputAreaHeight.set(newHeight);
      }
    });
  }

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

  exportTodos(format: 'md' | 'json' | 'csv') {
    const todos = this.todoSvc.todos();
    if (todos.length === 0) {
      this.toast.show('No tasks to export');
      return;
    }
    const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    if (format === 'json') {
      this.dom.downloadText(JSON.stringify(todos, null, 2), `tasks-${ts}.json`);
    } else if (format === 'csv') {
      this.dom.downloadText(this.buildCsv(todos), `tasks-${ts}.csv`, 'text/csv');
    } else {
      const done = todos.filter((t) => t.done).length;
      const lines = [
        `# Daily Planner — ${new Date().toLocaleDateString()}`,
        '',
        `Progress: ${done}/${todos.length} completed`,
        '',
        '## Active',
        ...todos
          .filter((t) => !t.done)
          .map((t) => {
            const cat = t.category ? `[${t.category}] ` : '';
            const due = t.dueDate ? ` · due ${this.formatDate(t.dueDate)}` : '';
            const pri = t.priority === 'priority' ? ' ⭐' : '';
            return `- [ ] ${cat}${t.text}${due}${pri}`;
          }),
        '',
        '## Completed',
        ...todos.filter((t) => t.done).map((t) => `- [x] ${t.text}`),
        '',
        '_Exported from INES_',
      ];
      this.dom.downloadText(lines.join('\n'), `tasks-${ts}.md`);
    }
    this.toast.success(`Exported as .${format}`);
  }

  private csvCell(value: unknown): string {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  private buildCsv(todos: Todo[]): string {
    const header = ['text', 'priority', 'category', 'dueDate', 'done'];
    const rows = todos.map((t) => [
      t.text,
      t.priority,
      t.category ?? 'other',
      t.dueDate ?? '',
      t.done ? 'true' : 'false',
    ]);
    return [header, ...rows]
      .map((row) => row.map((cell) => this.csvCell(cell)).join(','))
      .join('\n');
  }

  private splitCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  private parseCsv(
    text: string,
  ): { text: string; priority: string; category: string; dueDate?: string; done?: boolean }[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const header = this.splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const textIdx = header.indexOf('text');
    if (textIdx === -1) return [];
    return lines
      .slice(1)
      .map((line) => {
        const row = this.splitCsvLine(line);
        const get = (name: string) => {
          const i = header.indexOf(name);
          return i >= 0 ? (row[i] ?? '').trim() : '';
        };
        return {
          text: (row[textIdx] ?? '').trim(),
          priority: get('priority') === 'priority' ? 'priority' : 'normal',
          category: get('category') || 'other',
          dueDate: get('duedate') || undefined,
          done: get('done').toLowerCase() === 'true',
        };
      })
      .filter((r) => r.text);
  }

  async importTodos(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      const mapped = isCsv
        ? this.parseCsv(raw)
        : (() => {
            const data = JSON.parse(raw);
            const items = Array.isArray(data) ? data : data?.tasks;
            if (!Array.isArray(items)) throw new Error('empty');
            return items
              .filter((t: any) => t && typeof t.text === 'string' && t.text.trim())
              .map((t: any) => ({
                text: t.text.trim(),
                priority: t.priority === 'priority' ? 'priority' : 'normal',
                category: ['work', 'personal', 'health', 'other'].includes(t.category)
                  ? t.category
                  : 'other',
                dueDate: t.dueDate || undefined,
                done: !!t.done,
              }));
          })();
      if (!mapped || mapped.length === 0) throw new Error('empty');
      this.todoSvc.addMany(mapped);
      this.toast.success(`Imported ${mapped.length} tasks`);
    } catch {
      this.toast.error('Invalid file. Use a JSON or CSV export from INES.');
    }
    input.value = '';
  }

  ngOnDestroy() {
    this.disposeResize?.();
    this.disposeHResize?.();
    this.speech.abortRecording();
  }
}

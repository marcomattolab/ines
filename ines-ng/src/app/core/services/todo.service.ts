import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { StorageService } from './storage.service';

export interface Todo {
  id: number;
  text: string;
  priority: 'normal' | 'priority';
  done: boolean;
  dueDate?: string;
  category?: 'work' | 'personal' | 'health' | 'other';
}

const STORAGE_KEY = 'localai_todos';
const MAX_UNDO = 20;

type UndoAction =
  | { type: 'add'; ids: number[] }
  | { type: 'delete'; todo: Todo; index: number }
  | { type: 'toggle'; index: number }
  | { type: 'reorder'; from: number; to: number }
  | { type: 'clearDone'; todos: Todo[] };

@Injectable({ providedIn: 'root' })
export class TodoService {
  private readonly storage = inject(StorageService);

  readonly todos = signal<Todo[]>(this.storage.get<Todo[]>(STORAGE_KEY) ?? []);
  private nextId = 0;
  private undoStack: UndoAction[] = [];
  readonly canUndo = signal(false);

  constructor() {
    this.nextId = this.todos().reduce((max, t) => Math.max(max, t.id), 0) + 1;
    effect(() => {
      this.storage.set(STORAGE_KEY, this.todos());
    });
  }

  private pushUndo(action: UndoAction) {
    this.undoStack.push(action);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.canUndo.set(true);
  }

  undo(): boolean {
    const action = this.undoStack.pop();
    if (!action) {
      this.canUndo.set(false);
      return false;
    }
    switch (action.type) {
      case 'add':
        this.todos.update((t) => t.filter((todo) => !action.ids.includes(todo.id)));
        break;
      case 'delete':
        this.todos.update((t) => {
          const list = [...t];
          list.splice(action.index, 0, action.todo);
          return list;
        });
        break;
      case 'toggle':
        this.toggle(action.index);
        break;
      case 'reorder':
        this.reorder(action.to, action.from);
        break;
      case 'clearDone':
        this.todos.update((t) => [...t, ...action.todos]);
        break;
    }
    this.canUndo.set(this.undoStack.length > 0);
    return true;
  }

  add(text: string, priority: 'normal' | 'priority' = 'normal'): void {
    const id = this.nextId++;
    this.todos.update((t) => [...t, { id, text, priority, done: false }]);
    this.pushUndo({ type: 'add', ids: [id] });
  }

  toggle(index: number): void {
    this.todos.update((list) => list.map((t, i) => (i === index ? { ...t, done: !t.done } : t)));
    this.pushUndo({ type: 'toggle', index });
  }

  delete(index: number): void {
    const todo = this.todos()[index];
    if (!todo) return;
    this.todos.update((list) => list.filter((_, i) => i !== index));
    this.pushUndo({ type: 'delete', todo, index });
  }

  clearDone(): void {
    const done = this.todos().filter((t) => t.done);
    if (done.length === 0) return;
    this.todos.update((list) => list.filter((t) => !t.done));
    this.pushUndo({ type: 'clearDone', todos: done });
  }

  reorder(fromIndex: number, toIndex: number): void {
    this.todos.update((list) => {
      const newList = [...list];
      const [moved] = newList.splice(fromIndex, 1);
      newList.splice(toIndex, 0, moved);
      return newList;
    });
    this.pushUndo({ type: 'reorder', from: fromIndex, to: toIndex });
  }

  addMany(items: { text: string; priority: string }[]): void {
    const ids: number[] = [];
    const mapped: Todo[] = items.map((i) => {
      const id = this.nextId++;
      ids.push(id);
      return {
        id,
        text: i.text,
        priority: (i.priority === 'priority' ? 'priority' : 'normal') as Todo['priority'],
        done: false,
      };
    });
    this.todos.update((t) => [...t, ...mapped]);
    this.pushUndo({ type: 'add', ids });
  }

  readonly doneCount = computed(() => this.todos().filter((t) => t.done).length);
  readonly total = computed(() => this.todos().length);
}

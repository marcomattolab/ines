import { Injectable, signal, effect } from '@angular/core';

export interface Todo {
  text: string;
  priority: 'normal' | 'priority';
  done: boolean;
}

const STORAGE_KEY = 'localai_todos';

@Injectable({ providedIn: 'root' })
export class TodoService {
  readonly todos = signal<Todo[]>(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

  constructor() {
    // Persist to localStorage whenever todos change
    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.todos()));
    });
  }

  add(text: string, priority: 'normal' | 'priority' = 'normal'): void {
    this.todos.update((t) => [...t, { text, priority, done: false }]);
  }

  toggle(index: number): void {
    this.todos.update((list) => list.map((t, i) => (i === index ? { ...t, done: !t.done } : t)));
  }

  delete(index: number): void {
    this.todos.update((list) => list.filter((_, i) => i !== index));
  }

  clearDone(): void {
    this.todos.update((list) => list.filter((t) => !t.done));
  }

  reorder(fromIndex: number, toIndex: number): void {
    this.todos.update((list) => {
      const newList = [...list];
      const [moved] = newList.splice(fromIndex, 1);
      newList.splice(toIndex, 0, moved);
      return newList;
    });
  }

  addMany(items: { text: string; priority: string }[]): void {
    const mapped: Todo[] = items.map((i) => ({
      text: i.text,
      priority: (i.priority === 'priority' ? 'priority' : 'normal') as Todo['priority'],
      done: false,
    }));
    this.todos.update((t) => [...t, ...mapped]);
  }

  get doneCount() {
    return this.todos().filter((t) => t.done).length;
  }
  get total() {
    return this.todos().length;
  }
}

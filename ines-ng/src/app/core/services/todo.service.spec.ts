import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TodoService } from './todo.service';
import { StorageService } from './storage.service';

describe('TodoService', () => {
  let service: TodoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [TodoService, StorageService],
    });
    service = TestBed.inject(TodoService);
  });

  it('initializes with empty todos', () => {
    expect(service.todos()).toEqual([]);
    expect(service.canUndo()).toBe(false);
  });

  it('adds and toggles todos', () => {
    service.add('Buy groceries', 'priority', 'personal');
    expect(service.todos()).toHaveLength(1);
    expect(service.todos()[0].text).toBe('Buy groceries');
    expect(service.todos()[0].priority).toBe('priority');
    expect(service.todos()[0].category).toBe('personal');
    expect(service.todos()[0].done).toBe(false);
    expect(service.canUndo()).toBe(true);

    service.toggle(0);
    expect(service.todos()[0].done).toBe(true);
  });

  it('updates text, priority, and category', () => {
    service.add('Initial task');
    const id = service.todos()[0].id;

    service.updateText(id, 'Updated task');
    service.updatePriority(id, 'priority');
    service.updateCategory(id, 'health');

    expect(service.todos()[0].text).toBe('Updated task');
    expect(service.todos()[0].priority).toBe('priority');
    expect(service.todos()[0].category).toBe('health');
  });

  it('supports undoing add, delete, and toggle actions', () => {
    service.add('Task 1');
    expect(service.todos()).toHaveLength(1);

    // Undo add
    expect(service.undo()).toBe(true);
    expect(service.todos()).toHaveLength(0);

    service.add('Task to delete');
    service.delete(0);
    expect(service.todos()).toHaveLength(0);

    // Undo delete
    service.undo();
    expect(service.todos()).toHaveLength(1);
    expect(service.todos()[0].text).toBe('Task to delete');
  });

  it('clears completed todos and allows undo', () => {
    service.add('Task 1');
    service.add('Task 2');
    service.toggle(0); // mark Task 1 done

    service.clearDone();
    expect(service.todos()).toHaveLength(1);
    expect(service.todos()[0].text).toBe('Task 2');

    service.undo();
    expect(service.todos()).toHaveLength(2);
  });

  it('reorders todos', () => {
    service.add('First');
    service.add('Second');
    service.reorder(0, 1);
    expect(service.todos()[0].text).toBe('Second');
    expect(service.todos()[1].text).toBe('First');
  });
});

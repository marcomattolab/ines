import { describe, it, expect } from 'vitest';
import { parseByRules, normalizeType } from './voice-intent';

describe('voice-intent — normalizeType', () => {
  it('maps todo variants', () => {
    expect(normalizeType('todo')).toBe('todo');
    expect(normalizeType('add_todo')).toBe('todo');
    expect(normalizeType('add task')).toBe('todo');
    expect(normalizeType('reminder')).toBe('todo');
  });

  it('maps answer variants', () => {
    expect(normalizeType('answer')).toBe('answer');
    expect(normalizeType('chat')).toBe('answer');
    expect(normalizeType('question')).toBe('answer');
  });

  it('maps navigate variants', () => {
    expect(normalizeType('navigate')).toBe('navigate');
    expect(normalizeType('goto')).toBe('navigate');
    expect(normalizeType('switch_to')).toBe('navigate');
  });

  it('maps list-todos variants', () => {
    expect(normalizeType('list-todos')).toBe('list-todos');
    expect(normalizeType('read_todos')).toBe('list-todos');
  });

  it('returns null for unknown', () => {
    expect(normalizeType('fly-to-the-moon')).toBeNull();
    expect(normalizeType(undefined)).toBeNull();
  });
});

describe('voice-intent — parseByRules', () => {
  it('navigates on "apri email"', () => {
    expect(parseByRules('apri email')).toEqual([{ type: 'navigate', text: 'email' }]);
  });

  it('navigates on "vai su meeting"', () => {
    expect(parseByRules('vai su meeting')).toEqual([{ type: 'navigate', text: 'meeting' }]);
  });

  it('navigates to coding on "mostra codice"', () => {
    expect(parseByRules('mostra il codice')).toEqual([{ type: 'navigate', text: 'coding' }]);
  });

  it('adds a todo', () => {
    expect(parseByRules('aggiungi compra il latte')).toEqual([
      { type: 'todo', text: 'compra il latte' },
    ]);
  });

  it('strips "ricordami di"', () => {
    expect(parseByRules('ricordami di pagare la bolletta')).toEqual([
      { type: 'todo', text: 'pagare la bolletta' },
    ]);
  });

  it('splits multiple todos on "poi"', () => {
    expect(parseByRules('aggiungi compra il latte, poi chiama marco')).toEqual([
      { type: 'todo', text: 'compra il latte' },
      { type: 'todo', text: 'chiama marco' },
    ]);
  });

  it('splits multiple todos on "e poi"', () => {
    expect(parseByRules('aggiungi preparare le slide e poi inviare la mail')).toEqual([
      { type: 'todo', text: 'preparare le slide' },
      { type: 'todo', text: 'inviare la mail' },
    ]);
  });

  it('reads the list', () => {
    expect(parseByRules('che compiti ho?')).toEqual([{ type: 'list-todos', text: '' }]);
    expect(parseByRules('cosa devo fare')).toEqual([{ type: 'list-todos', text: '' }]);
  });

  it('falls back to answer for plain questions', () => {
    expect(parseByRules('quanto fa 2+2?')).toEqual([{ type: 'answer', text: 'quanto fa 2+2?' }]);
  });

  it('does not treat "lista" inside a todo as list-todos', () => {
    expect(parseByRules('aggiungi il pane alla lista')).toEqual([
      { type: 'todo', text: 'il pane alla lista' },
    ]);
  });
});

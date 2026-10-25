import { describe, it, expect } from 'vitest';
import { parseByRules, normalizeType } from './voice-intent';

describe('voice-intent — normalizeType', () => {
  it('maps todo variants', () => {
    expect(normalizeType('todo')).toBe('todo');
    expect(normalizeType('add_todo')).toBe('todo');
    expect(normalizeType('add task')).toBe('todo');
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

  it('maps the new task types', () => {
    expect(normalizeType('email')).toBe('email');
    expect(normalizeType('write_email')).toBe('email');
    expect(normalizeType('translate')).toBe('translate');
    expect(normalizeType('create_agent')).toBe('create-agent');
    expect(normalizeType('summarize_gmail')).toBe('summarize-gmail');
  });

  it('maps remember and recall', () => {
    expect(normalizeType('remember')).toBe('remember');
    expect(normalizeType('save_note')).toBe('remember');
    expect(normalizeType('recall')).toBe('recall');
    expect(normalizeType('search')).toBe('recall');
  });

  it('maps digest', () => {
    expect(normalizeType('digest')).toBe('digest');
    expect(normalizeType('daily_digest')).toBe('digest');
  });

  it('maps reminder', () => {
    expect(normalizeType('reminder')).toBe('reminder');
    expect(normalizeType('remind_me')).toBe('reminder');
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

  // ── New command types ──

  it('drafts an email', () => {
    expect(parseByRules('scrivi una email a marco')).toEqual([
      { type: 'email', text: 'scrivi una email a marco' },
    ]);
    expect(parseByRules('write an email to John')).toEqual([
      { type: 'email', text: 'write an email to John' },
    ]);
  });

  it('translates', () => {
    expect(parseByRules('traduci ciao in francese')).toEqual([
      { type: 'translate', text: 'traduci ciao in francese' },
    ]);
    expect(parseByRules('translate hello into French')).toEqual([
      { type: 'translate', text: 'translate hello into French' },
    ]);
  });

  it('creates an agent', () => {
    expect(parseByRules('crea un agente che scrive codice')).toEqual([
      { type: 'create-agent', text: 'crea un agente che scrive codice' },
    ]);
  });

  it('create-agent wins over gmail even when "email" is mentioned', () => {
    expect(parseByRules('crea un agente che riassume le email')).toEqual([
      { type: 'create-agent', text: 'crea un agente che riassume le email' },
    ]);
  });

  it('summarizes gmail', () => {
    expect(parseByRules('riassumi le email')).toEqual([
      { type: 'summarize-gmail', text: 'riassumi le email' },
    ]);
    expect(parseByRules('summarize my emails')).toEqual([
      { type: 'summarize-gmail', text: 'summarize my emails' },
    ]);
  });

  it('summarizes gmail with informal phrasing', () => {
    expect(parseByRules('riassuntomi le ultime 2 email')).toEqual([
      { type: 'summarize-gmail', text: 'riassuntomi le ultime 2 email' },
    ]);
    expect(parseByRules('fammi il riassunto delle ultime due email')).toEqual([
      { type: 'summarize-gmail', text: 'fammi il riassunto delle ultime due email' },
    ]);
  });

  it('gmail wins over recall for "search my emails"', () => {
    expect(parseByRules('search my emails')).toEqual([
      { type: 'summarize-gmail', text: 'search my emails' },
    ]);
  });

  it('remembers a note', () => {
    expect(parseByRules('remember that the meeting is on Monday')).toEqual([
      { type: 'remember', text: 'remember that the meeting is on Monday' },
    ]);
    expect(parseByRules('ricorda che il meeting è lunedì')).toEqual([
      { type: 'remember', text: 'ricorda che il meeting è lunedì' },
    ]);
  });

  it('keeps "ricordami di" as a todo, not a note', () => {
    expect(parseByRules('ricordami di pagare la bolletta')).toEqual([
      { type: 'todo', text: 'pagare la bolletta' },
    ]);
  });

  it('recalls from the brain', () => {
    expect(parseByRules('search my brain for the project')).toEqual([
      { type: 'recall', text: 'search my brain for the project' },
    ]);
    expect(parseByRules('cerca il progetto')).toEqual([
      { type: 'recall', text: 'cerca il progetto' },
    ]);
  });

  it('navigates to the brain tab', () => {
    expect(parseByRules('apri il brain')).toEqual([{ type: 'navigate', text: 'brain' }]);
  });

  it('daily digest', () => {
    expect(parseByRules('riassumi la giornata')).toEqual([{ type: 'digest', text: '' }]);
    expect(parseByRules('summarize my day')).toEqual([{ type: 'digest', text: '' }]);
    expect(parseByRules('daily digest')).toEqual([{ type: 'digest', text: '' }]);
  });

  it('gmail still wins over digest for "riassumi le email"', () => {
    expect(parseByRules('riassumi le email')).toEqual([
      { type: 'summarize-gmail', text: 'riassumi le email' },
    ]);
  });

  it('sets a reminder when a time is present', () => {
    expect(parseByRules('remind me to call John in 1 hour')).toEqual([
      { type: 'reminder', text: 'remind me to call John in 1 hour' },
    ]);
    expect(parseByRules('ricordami di pagare tra 30 minuti')).toEqual([
      { type: 'reminder', text: 'ricordami di pagare tra 30 minuti' },
    ]);
  });

  it('falls back to a todo when a reminder has no time', () => {
    expect(parseByRules('remind me to call John')).toEqual([{ type: 'todo', text: 'call John' }]);
  });

  it('"ricordami di" without time is still a todo', () => {
    expect(parseByRules('ricordami di pagare la bolletta')).toEqual([
      { type: 'todo', text: 'pagare la bolletta' },
    ]);
  });
});

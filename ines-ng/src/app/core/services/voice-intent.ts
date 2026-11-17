/**
 * Pure, framework-free intent parsing for the INES voice assistant.
 *
 * The primary parsing path is the local LLM (see VoiceAssistantService), but
 * these rules provide a deterministic fallback that also works when no model
 * is loaded, and they are unit-testable without Angular DI.
 */

export type VoiceTaskType =
  | 'answer'
  | 'todo'
  | 'navigate'
  | 'list-todos'
  | 'translate'
  | 'create-agent'
  | 'remember'
  | 'recall'
  | 'digest'
  | 'reminder'
  | 'consolidate';

export interface ParsedTask {
  type: VoiceTaskType;
  text: string;
}

/** Tab ids understood by the app, with a human label for spoken feedback. */
export const TAB_LABELS: Record<string, string> = {
  assistant: 'Assistant',
  knowledge: 'Knowledge',
  todo: 'Todo',
  meeting: 'Meeting',
  translate: 'Translate',
  code: 'Code',
  learning: 'Learning',
  labs: 'Labs',
};

export const VALID_TABS = new Set(Object.keys(TAB_LABELS));

/** Normalizes arbitrary LLM-returned type strings into known task types. */
export function normalizeType(type?: string): VoiceTaskType | null {
  if (!type) return null;
  const v = type.toLowerCase().replace(/[\s_-]/g, '');
  if (['todo', 'add', 'addtodo', 'addtask', 'task', 'createtodo'].includes(v)) {
    return 'todo';
  }
  if (
    ['answer', 'question', 'chat', 'reply', 'conversation', 'ask', 'answerquestion'].includes(v)
  ) {
    return 'answer';
  }
  if (['navigate', 'open', 'goto', 'gototab', 'tab', 'section', 'switchto'].includes(v)) {
    return 'navigate';
  }
  if (['listtodos', 'list', 'readtodos', 'readtasks', 'todos', 'listtasks'].includes(v)) {
    return 'list-todos';
  }
  if (['translate', 'translation', 'translateto'].includes(v)) {
    return 'translate';
  }
  if (['createagent', 'newagent', 'makeagent', 'agent'].includes(v)) {
    return 'create-agent';
  }
  if (['remember', 'note', 'capture', 'savenote', 'addnote', 'memorize', 'memo'].includes(v)) {
    return 'remember';
  }
  if (['recall', 'search', 'find', 'searchbrain', 'askbrain', 'memory', 'retrieve'].includes(v)) {
    return 'recall';
  }
  if (['digest', 'dailydigest', 'summarizeday', 'daydigest', 'summarizejourney'].includes(v)) {
    return 'digest';
  }
  if (
    ['reminder', 'remind', 'remindme', 'setreminder', 'alarm', 'schedulereleminder'].includes(v)
  ) {
    return 'reminder';
  }
  if (
    ['consolidate', 'consolidatememory', 'compressnotes', 'distill', 'consolidatenotes'].includes(v)
  ) {
    return 'consolidate';
  }
  return null;
}

const TAB_KEYWORDS: { pattern: RegExp; tab: string }[] = [
  { pattern: /\b(meeting|meetings|riunione|riunioni|riunione)\b/i, tab: 'meeting' },
  { pattern: /\b(translate|translation|traduttore|traduci|traduzione)\b/i, tab: 'translate' },
  { pattern: /\b(todo|todos|compiti|attivita|attività|task)\b/i, tab: 'todo' },
  { pattern: /\b(coding|code|codice|programmazione|developer|sviluppo)\b/i, tab: 'code' },
  { pattern: /\b(dev\s?agent|sviluppatore)\b/i, tab: 'code' },
  { pattern: /\b(agents|agent|agenti|agente)\b/i, tab: 'code' },
  { pattern: /\b(learning|studio|studi|formazione)\b/i, tab: 'learning' },
  { pattern: /\b(slides|presentation|presentazione|diapositive)\b/i, tab: 'learning' },
  { pattern: /\b(project|progetto|progetti)\b/i, tab: 'knowledge' },
  { pattern: /\b(brain|cervello|second\s+brain|conoscenza|knowledge)\b/i, tab: 'knowledge' },
  { pattern: /\b(vision|vista|immagini|labs|lab|esperimenti|sperimentale)\b/i, tab: 'labs' },
  { pattern: /\b(chat|conversazione)\b/i, tab: 'assistant' },
  { pattern: /\b(voice|voce|assistente)\b/i, tab: 'assistant' },
];

const OPEN_RE =
  /\b(apri|vai\s+(a|su|al|alla|nella|nella\s+sezione)|mostra|mostrami|open|go\s+to|show)\b/i;

const LIST_RE =
  /(che|quali)\s+(compiti|attivita|attività|todo|task)|cosa\s+(devo|ho\s+da)\s+fare|leggi\s+(i\s+|le\s+|la\s+|il\s+)?(compiti|todo|lista|elenco)|i\s+miei\s+compiti|compiti\s+(che|da|in\s+programma|di\s+oggi)/i;

const TODO_RE =
  /(aggiungi|ricordami|segna|appunta|promemoria|crea\s+(un\s+)?compito|nuovo\s+compito|aggiungi\s+(alla\s+lista|ai\s+compiti|al\s+todo|un\s+compito|il\s+compito))/i;

const CREATE_AGENT_RE =
  /\b(crea|create|new|nuovo|make|aggiungi)\s+(un\s+|an?\s+|a\s+)?(agente|agent|assistente personalizzato)\b/i;

const TRANSLATE_RE = /\b(traduci|translate|traduzione|translate\s+this)\b/i;

const REMEMBER_RE =
  /\b(ricorda\s+che|ricordati\s+che|remember\s+that|note\s+that|nota\s+che|scrivi\s+(una\s+|un\s+)?nota|salva\s+(una\s+|un\s+)?nota|nuova\s+nota|take\s+a\s+note|capture|cattura|appunto)\b/i;

const RECALL_RE =
  /\b(cerca|search|find|trova|ricerca|recall|brain|cosa\s+sai\s+di|cosa\s+ho\s+(detto|scritto|salvato)|what\s+did\s+i\s+(say|write|save)|dove\s+ho\s+scritto)\b/i;

const DIGEST_RE =
  /\b(daily\s+digest|riassumi\s+(la\s+|my\s+|the\s+)?(giornata|giorno|day)|summarize\s+(my\s+|the\s+)?day|riepilogo\s+(della\s+|del\s+)?(giornata|giorno)|riassumi\s+la\s+mia\s+giornata|come\s+va\s+la\s+giornata)\b/i;

const CONSOLIDATE_RE =
  /\b(consolida|consolidate|comprimi|compress|distill)\s+(i\s+|my\s+|le\s+|the\s+)?(ricordi|memorie|memories|notes|note|appunti)\b/i;

const REMINDER_RE =
  /\b(remind\s+me\s+to|remind\s+me|ricordami\s+di|ricordami|ricordati\s+di|ricordati|promemoria|set\s+a\s+reminder)\b/i;

const TIME_PHRASE =
  /\b(in\s+\d+|tra\s+\d+|at\s+\d|alle\s+\d|mezz'ora|mezzora|half\s+an?\s+hour|\d+\s+(?:min|hour|ora|minut|second|day|giorn))\b/i;

const TODO_STRIP_RE =
  /^(aggiungi|ricordami|segna|appunta|promemoria|crea\s+(un\s+)?compito|nuovo\s+compito|aggiungi\s+(alla\s+lista|ai\s+compiti|al\s+todo|un\s+compito|il\s+compito))\s*[:,\-]?\s*/i;

const SPLIT_RE = /\s*(?:,\s*)?(?:e\s+)?poi\s*|\s*;\s*|\n+/i;

function matchTab(text: string): string | null {
  for (const { pattern, tab } of TAB_KEYWORDS) {
    if (pattern.test(text)) return tab;
  }
  return null;
}

function splitTodoItems(text: string): string[] {
  let t = text.replace(TODO_STRIP_RE, '');
  t = t.replace(/^di\s+/, '');
  const parts = t
    .split(SPLIT_RE)
    .map((s) => s.replace(/^[\s,.]+|[\s,.]+$/g, '').trim())
    .filter((s) => s.length > 1);
  return parts.length ? parts : [t.trim()].filter(Boolean);
}

/**
 * Deterministic fallback parser. Returns a list of tasks to execute.
 * `list-todos` is checked first so "apri i compiti" navigates but
 * "che compiti ho" reads the list.
 */
export function parseByRules(text: string): ParsedTask[] {
  const clean = text.trim();

  if (LIST_RE.test(clean)) {
    return [{ type: 'list-todos', text: '' }];
  }

  if (CREATE_AGENT_RE.test(clean)) {
    return [{ type: 'create-agent', text: clean }];
  }

  if (DIGEST_RE.test(clean)) {
    return [{ type: 'digest', text: '' }];
  }

  if (OPEN_RE.test(clean)) {
    const tab = matchTab(clean);
    if (tab) return [{ type: 'navigate', text: tab }];
  }

  if (TRANSLATE_RE.test(clean)) {
    return [{ type: 'translate', text: clean }];
  }

  if (REMEMBER_RE.test(clean)) {
    return [{ type: 'remember', text: clean }];
  }

  if (RECALL_RE.test(clean)) {
    return [{ type: 'recall', text: clean }];
  }

  if (CONSOLIDATE_RE.test(clean)) {
    return [{ type: 'consolidate', text: '' }];
  }

  if (REMINDER_RE.test(clean)) {
    if (TIME_PHRASE.test(clean)) {
      return [{ type: 'reminder', text: clean }];
    }
    const msg = clean
      .replace(REMINDER_RE, '')
      .replace(/^\s*(to|di)\s+/i, '')
      .trim();
    if (msg) return [{ type: 'todo', text: msg }];
  }

  if (TODO_RE.test(clean)) {
    return splitTodoItems(clean).map((item) => ({ type: 'todo' as const, text: item }));
  }

  return [{ type: 'answer', text: clean }];
}

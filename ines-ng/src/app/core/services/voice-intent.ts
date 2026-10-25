/**
 * Pure, framework-free intent parsing for the INES voice assistant.
 *
 * The primary parsing path is the local LLM (see VoiceAssistantService), but
 * these rules provide a deterministic fallback that also works when no model
 * is loaded, and they are unit-testable without Angular DI.
 */

export type VoiceTaskType = 'answer' | 'todo' | 'navigate' | 'list-todos';

export interface ParsedTask {
  type: VoiceTaskType;
  text: string;
}

/** Tab ids understood by the app, with a human label for spoken feedback. */
export const TAB_LABELS: Record<string, string> = {
  assistant: 'Voice',
  chat: 'Chat',
  email: 'Email',
  meeting: 'Meeting',
  translate: 'Translate',
  todo: 'Todo',
  coding: 'Code',
  agents: 'Agents',
  vision: 'Vision',
  learning: 'Learning',
  presentation: 'Slides',
  project: 'Project',
  'dev-agent': 'DevAgent',
};

export const VALID_TABS = new Set(Object.keys(TAB_LABELS));

/** Normalizes arbitrary LLM-returned type strings into known task types. */
export function normalizeType(type?: string): VoiceTaskType | null {
  if (!type) return null;
  const v = type.toLowerCase().replace(/[\s_-]/g, '');
  if (['todo', 'add', 'addtodo', 'addtask', 'reminder', 'task', 'createtodo'].includes(v)) {
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
  return null;
}

const TAB_KEYWORDS: { pattern: RegExp; tab: string }[] = [
  { pattern: /\b(email|mail|posta|inbox)\b/i, tab: 'email' },
  { pattern: /\b(meeting|meetings|riunione|riunioni|riunione)\b/i, tab: 'meeting' },
  { pattern: /\b(translate|translation|traduttore|traduci|traduzione)\b/i, tab: 'translate' },
  { pattern: /\b(todo|todos|compiti|attivita|attività|task)\b/i, tab: 'todo' },
  { pattern: /\b(coding|code|codice|programmazione|developer|sviluppo)\b/i, tab: 'coding' },
  { pattern: /\b(agents|agent|agenti|agente)\b/i, tab: 'agents' },
  { pattern: /\b(vision|vista|immagini)\b/i, tab: 'vision' },
  { pattern: /\b(learning|studio|studi|formazione)\b/i, tab: 'learning' },
  { pattern: /\b(slides|presentation|presentazione|diapositive)\b/i, tab: 'presentation' },
  { pattern: /\b(project|progetto|progetti)\b/i, tab: 'project' },
  { pattern: /\b(dev\s?agent|sviluppatore)\b/i, tab: 'dev-agent' },
  { pattern: /\b(chat|conversazione)\b/i, tab: 'chat' },
  { pattern: /\b(voice|voce|assistente)\b/i, tab: 'assistant' },
];

const OPEN_RE =
  /\b(apri|vai\s+(a|su|al|alla|nella|nella\s+sezione)|mostra|mostrami|open|go\s+to|show)\b/i;

const LIST_RE =
  /(che|quali)\s+(compiti|attivita|attività|todo|task)|cosa\s+(devo|ho\s+da)\s+fare|leggi\s+(i\s+|le\s+|la\s+|il\s+)?(compiti|todo|lista|elenco)|i\s+miei\s+compiti|compiti\s+(che|da|in\s+programma|di\s+oggi)/i;

const TODO_RE =
  /(aggiungi|ricordami|segna|appunta|promemoria|crea\s+(un\s+)?compito|nuovo\s+compito|aggiungi\s+(alla\s+lista|ai\s+compiti|al\s+todo|un\s+compito|il\s+compito))/i;

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

  if (OPEN_RE.test(clean)) {
    const tab = matchTab(clean);
    if (tab) return [{ type: 'navigate', text: tab }];
  }

  if (TODO_RE.test(clean)) {
    return splitTodoItems(clean).map((item) => ({ type: 'todo' as const, text: item }));
  }

  return [{ type: 'answer', text: clean }];
}

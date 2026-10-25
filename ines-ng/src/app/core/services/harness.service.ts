import { VoiceTaskType } from './voice-intent';

/**
 * The INES "harness": a single catalog of every capability the assistant can
 * execute. It is the source of truth for both the LLM voice prompt and the UI.
 *
 * This mirrors Karpathy's "LLM OS" mental model, where the LLM is the CPU and
 * everything else is a peripheral/tool the CPU can call:
 *   - answer / translate         → language peripherals
 *   - todo / remember / recall   → memory & task management (filesystem)
 *   - email / gmail / navigate   → I/O and integrations
 *   - create-agent               → spawning new programs (agents)
 */

export interface ToolDef {
  type: VoiceTaskType;
  label: string;
  icon: string;
  description: string;
}

export const TOOL_CATALOG: ToolDef[] = [
  {
    type: 'answer',
    label: 'Answer',
    icon: 'chat',
    description: 'answer a question or reply conversationally (text = the question)',
  },
  {
    type: 'todo',
    label: 'Add task',
    icon: 'check_circle',
    description: 'add a to-do item (text = the task)',
  },
  {
    type: 'list-todos',
    label: 'List tasks',
    icon: 'format_list_bulleted',
    description: 'read the to-do list aloud (text = "")',
  },
  {
    type: 'navigate',
    label: 'Open section',
    icon: 'open_in_new',
    description:
      'open a section; text must be exactly one of: chat, email, meeting, translate, todo, coding, agents, vision, learning, presentation, project',
  },
  {
    type: 'email',
    label: 'Draft email',
    icon: 'mail',
    description: 'draft an email (text = what the email should say and to whom)',
  },
  {
    type: 'translate',
    label: 'Translate',
    icon: 'translate',
    description: 'translate something (text = the phrase plus the target language)',
  },
  {
    type: 'create-agent',
    label: 'Create agent',
    icon: 'smart_toy',
    description: 'create an AI agent (text = what the agent should do)',
  },
  {
    type: 'summarize-gmail',
    label: 'Summarize Gmail',
    icon: 'mark_email_read',
    description: 'summarize the user Gmail inbox (text = "")',
  },
  {
    type: 'remember',
    label: 'Remember',
    icon: 'psychology',
    description: 'save a note to the second brain (text = the note)',
  },
  {
    type: 'recall',
    label: 'Recall',
    icon: 'search',
    description: 'search the second brain (notes + documents) and answer (text = the query)',
  },
  {
    type: 'digest',
    label: 'Daily digest',
    icon: 'today',
    description: 'summarize the day from tasks, notes and recent emails (text = "")',
  },
  {
    type: 'reminder',
    label: 'Reminder',
    icon: 'alarm',
    description:
      'set a timed reminder (text = the full request including the time, e.g. "remind me to call John in 1 hour")',
  },
  {
    type: 'consolidate',
    label: 'Consolidate memory',
    icon: 'compress',
    description: 'compress older notes into a single long-term memory (text = "")',
  },
];

export function buildVoiceSystemPrompt(): string {
  const lines = TOOL_CATALOG.map((t) => `- {"type":"${t.type}","text":"..."} — ${t.description}`);
  return [
    'You are INES, a voice assistant. The user dictates one or more requests.',
    'Convert them into a JSON array of tasks to execute. Each task has a "type" and a "text":',
    '',
    ...lines,
    '',
    'If several items are separated by "and then", "then", "poi", "," etc., split them into multiple tasks.',
    'Keep texts in the same language as the user.',
    '',
    'Respond ONLY with a JSON array. No markdown, no backticks, no explanation.',
  ].join('\n');
}

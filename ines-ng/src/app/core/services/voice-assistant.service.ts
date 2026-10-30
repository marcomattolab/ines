import { Injectable, inject, signal } from '@angular/core';
import { SpeechService } from './speech.service';
import { LlmService, ChatMessage } from './llm.service';
import { TodoService } from './todo.service';
import { JsonParserService } from './json-parser.service';
import { ToastService } from './toast.service';
import { KnowledgeManagerService } from './knowledge-manager.service';
import { AgentService } from './agent.service';
import { GmailService } from './gmail.service';
import { SecondBrainService } from './second-brain.service';
import { ReminderService } from './reminder.service';
import { parseReminder } from './reminder-parse';
import { StorageService } from './storage.service';
import { SettingsService } from './settings.service';
import { buildVoiceSystemPrompt } from './harness.service';
import {
  parseByRules,
  normalizeType,
  VALID_TABS,
  TAB_LABELS,
  VoiceTaskType,
  ParsedTask,
} from './voice-intent';

export type VoiceTaskStatus = 'queued' | 'running' | 'done' | 'error';

export interface VoiceTask {
  id: number;
  type: VoiceTaskType;
  text: string;
  status: VoiceTaskStatus;
  result?: string;
}

export interface AssistantLogEntry {
  id: number;
  role: 'user' | 'ai';
  text: string;
}

const SYSTEM_VOICE = buildVoiceSystemPrompt();

const SYSTEM_ANSWER = `You are INES, a friendly, precise voice assistant.
Answer in the same language as the user. Be concise and conversational, suitable to be read aloud.
Avoid markdown, bullet lists, code blocks or emojis unless strictly requested.`;

const SYSTEM_EMAIL_DRAFT = `You are INES, a professional email writing assistant.
Write a concise, clear email based on the user's spoken request.
Output ONLY the email body — no subject line, no "Subject:", no preamble or explanation.
Use the same language as the user.`;

const SYSTEM_TRANSLATE = `You are a translator. Translate the user's text into the language they requested
(e.g. "in francese" means French, "in inglese" means English, "to spanish" means Spanish).
Output ONLY the translation, nothing else.`;

const SYSTEM_AGENT = `You are INES. Create an AI agent based on the user's request.
Respond ONLY with a JSON object (no markdown, no backticks) in this exact format:
{"name":"Short agent name","description":"One sentence describing what the agent does","systemPrompt":"Detailed system prompt instructing the agent how to behave"}
Use the same language as the user.`;

const SYSTEM_DIGEST = `You are INES. Provide the user's daily digest from their tasks, notes, and (if present) recent emails.
Summarize concisely: what is on the agenda, the key notes, and any action items.
Suitable to be read aloud. Answer in the same language as the user. Keep it under 150 words.`;

const SYSTEM_GMAIL = `You are INES, a Gmail assistant with access to the user's inbox emails (sender, subject and a short preview for each one).
Fulfill the user's request precisely:
- If they ask for a summary, summarize the most important emails, senders and action items.
- If they ask to categorize, group or count emails by category, group them into logical categories (e.g. by sender domain or type: Google, GitHub, social, newsletters, personal, work, etc.) and show a markdown table with a "Category" column and the "Number of emails" for each, plus the top senders.
Use the same language as the user. Be structured and complete. The emails are provided below — never claim you cannot access them.`;

@Injectable({ providedIn: 'root' })
export class VoiceAssistantService {
  readonly speech = inject(SpeechService);
  readonly llm = inject(LlmService);
  readonly todos = inject(TodoService);
  readonly jsonParser = inject(JsonParserService);
  readonly toast = inject(ToastService);
  readonly km = inject(KnowledgeManagerService);
  readonly agents = inject(AgentService);
  readonly gmail = inject(GmailService);
  readonly brain = inject(SecondBrainService);
  readonly reminders = inject(ReminderService);
  private readonly storage = inject(StorageService);
  readonly settings = inject(SettingsService);

  /** Task queue — the "series of tasks" INES received. */
  readonly tasks = signal<VoiceTask[]>([]);
  /** Conversation log (spoken requests + spoken answers). */
  readonly log = signal<AssistantLogEntry[]>([]);
  /** Live transcription while listening. */
  readonly transcript = signal('');

  readonly listening = this.speech.recording;
  readonly recordingTimer = this.speech.recordingTimer;
  readonly speaking = this.speech.speaking;
  readonly processing = signal(false);

  readonly voiceEnabled = signal(true);
  /** Default voice language — sourced from global settings. */
  readonly voiceLang = this.settings.lang;

  /** Wake word ("INES") always-listening mode. */
  readonly wakeEnabled = signal(false);
  readonly wakeListening = this.speech.wakeListening;
  readonly wakeTranscript = this.speech.wakeTranscript;

  /** Set to a tab id when INES must navigate; consumed by AppComponent. */
  readonly requestedTab = signal<string | null>(null);
  /** Email draft produced by voice, consumed by EmailTabComponent. */
  readonly emailDraft = signal<string | null>(null);

  private history: ChatMessage[] = [];
  private speechQueue: string[] = [];
  private nextTaskId = 1;
  private nextLogId = 1;
  private processingQueue = false;

  // ── Listening (push-to-talk) ──

  toggleListening(): void {
    if (this.listening()) this.stopListening();
    else this.startListening();
  }

  startListening(): void {
    if (this.processing()) return;
    this.transcript.set('');
    const ok = this.speech.startRecording('', (text) => this.transcript.set(text));
    if (!ok) this.toast.show('Web Speech API not supported in this browser');
  }

  stopListening(): void {
    if (!this.listening()) return;
    const text = this.speech.stopRecording().trim();
    if (!text) {
      this.toast.show('I did not hear anything — try again');
      return;
    }
    this.handleSpokenCommand(text);
  }

  // ── Wake word (always listening) ──

  toggleWake(): void {
    if (this.wakeEnabled()) this.stopWake();
    else this.startWake();
  }

  startWake(): void {
    const ok = this.speech.startWakeListening((cmd) => this.handleSpokenCommand(cmd));
    if (!ok) {
      this.toast.show('Web Speech API not supported in this browser');
      return;
    }
    this.wakeEnabled.set(true);
  }

  stopWake(): void {
    this.speech.stopWakeListening();
    this.wakeEnabled.set(false);
  }

  /** Navigates the app to a tab id (reused by voice commands and other tabs). */
  navigateTo(tab: string): void {
    this.requestedTab.set(tab);
  }

  clear(): void {
    this.speech.stop();
    this.tasks.set([]);
    this.log.set([]);
    this.transcript.set('');
    this.emailDraft.set(null);
    this.history = [];
    this.speechQueue = [];
  }

  private handleSpokenCommand(text: string): void {
    const clean = text.trim();
    if (!clean) return;
    this.transcript.set(clean);
    this.addLog('user', clean);
    void this.processText(clean);
  }

  private async processText(text: string): Promise<void> {
    this.processing.set(true);
    try {
      const parsed = await this.parseTasks(text);
      const tasks: VoiceTask[] = (parsed.length ? parsed : [{ type: 'answer' as const, text }]).map(
        (p) => ({
          id: this.nextTaskId++,
          type: p.type,
          text: (p.text || '').trim(),
          status: 'queued' as const,
        }),
      );
      this.tasks.update((list) => [...list, ...tasks]);
      await this.runQueue();
    } finally {
      this.processing.set(false);
    }
  }

  /** LLM parsing first, deterministic rule parsing as fallback. */
  private async parseTasks(text: string): Promise<ParsedTask[]> {
    const byRules = parseByRules(text);
    const rulesHaveSpecific = byRules.some((t) => t.type !== 'answer');

    let llmResult: ParsedTask[] | null = null;
    if (this.llm.isReady() && !this.llm.isBusy()) {
      try {
        let raw = '';
        await this.llm.generate(SYSTEM_VOICE, text, [], (_, __, full) => {
          raw = full;
        });
        llmResult = this.jsonParser
          .parseArray<{ type?: string; text?: string }>(raw)
          .map((t) => ({ type: normalizeType(t?.type), text: String(t?.text ?? '') }))
          .filter(
            (t): t is ParsedTask =>
              t.type !== null &&
              (t.text.trim().length > 0 || t.type === 'list-todos' || t.type === 'summarize-gmail'),
          );
      } catch {
        /* fall through to rules */
      }
    }

    // Prefer the LLM when it found specific (non-answer) intents — e.g. multi-task splits.
    if (llmResult?.some((t) => t.type !== 'answer')) {
      return llmResult;
    }
    // Otherwise trust deterministic rules for specific intents (fixes misclassification).
    if (rulesHaveSpecific) {
      return byRules;
    }
    return llmResult?.length ? llmResult : byRules;
  }

  private async runQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;
    const queued = this.tasks().filter((t) => t.status === 'queued');
    try {
      for (const task of queued) {
        this.patchTask(task.id, { status: 'running' });
        try {
          const result = await this.executeTask(task);
          this.patchTask(task.id, { status: 'done', result });
        } catch (e: any) {
          this.patchTask(task.id, { status: 'error', result: e?.message ?? String(e) });
          this.enqueueSpeech(e?.message ?? String(e));
        }
      }
      this.flushSpeech();
    } finally {
      this.processingQueue = false;
    }
  }

  private async executeTask(task: VoiceTask): Promise<string> {
    switch (task.type) {
      case 'todo':
        this.todos.add(task.text);
        this.addLog('ai', `✔ Added to list: ${task.text}`);
        this.enqueueSpeech(`Added: ${task.text}.`);
        return 'Added to list';

      case 'navigate': {
        const tab = task.text.trim().toLowerCase();
        if (VALID_TABS.has(tab)) {
          this.requestedTab.set(tab);
          const label = TAB_LABELS[tab];
          this.addLog('ai', `➜ Opening ${label}`);
          this.enqueueSpeech(`Opening ${label}.`);
          return `Opened ${label}`;
        }
        this.enqueueSpeech(`I don't recognize the section ${task.text}.`);
        return `Unknown section: ${task.text}`;
      }

      case 'list-todos':
        return this.listTodos();

      case 'answer':
        return this.answerQuestion(task.text);

      case 'email':
        return this.draftEmail(task.text);

      case 'translate':
        return this.translate(task.text);

      case 'create-agent':
        return this.createAgent(task.text);

      case 'summarize-gmail':
        return this.summarizeGmail(task.text);

      case 'remember':
        return this.remember(task.text);

      case 'recall':
        return this.recall(task.text);

      case 'digest':
        return this.digestNow();

      case 'reminder':
        return this.scheduleReminder(task.text);

      case 'consolidate':
        return this.consolidateMemories();
    }
  }

  private listTodos(): string {
    const active = this.todos.todos().filter((t) => !t.done);
    if (active.length === 0) {
      this.addLog('ai', 'No active tasks');
      this.enqueueSpeech('You have no tasks to do.');
      return 'No active tasks';
    }
    this.addLog('ai', `📋 ${active.map((t) => `• ${t.text}`).join('\n')}`);
    this.enqueueSpeech(`You have ${active.length} tasks: ${active.map((t) => t.text).join(', ')}.`);
    return `${active.length} active tasks`;
  }

  private async answerQuestion(question: string): Promise<string> {
    if (!this.llm.isReady()) {
      throw new Error('Load the model for spoken answers.');
    }
    this.history.push({ role: 'user', content: question });
    if (this.history.length > 20) this.history = this.history.slice(-20);

    let system = SYSTEM_ANSWER;
    try {
      const chunks = await this.km.getRelevantChunks(question, 3, 300);
      if (chunks.length > 0) {
        const context = chunks.map((c) => `[${c.docName}]\n${c.text}`).join('\n\n---\n\n');
        system += `\n\nYou have access to the user's personal knowledge base. Use the provided context when relevant and cite the source document name.\n\nContext from knowledge base documents:\n${context}`;
      }
    } catch {
      /* RAG is best-effort */
    }

    const trimmed = this.llm.trimConversation(system, question, this.history.slice(-6, -1));

    let answer = '';
    await this.llm.generate(system, question, trimmed, (_, __, full) => {
      answer = full;
    });
    this.history.push({ role: 'assistant', content: answer });
    this.addLog('ai', answer);
    this.enqueueSpeech(answer);
    return answer;
  }

  private async draftEmail(description: string): Promise<string> {
    if (!this.llm.isReady()) {
      throw new Error('Load the model to draft emails.');
    }
    let draft = '';
    await this.llm.generate(SYSTEM_EMAIL_DRAFT, description, [], (_, __, full) => {
      draft = full;
    });
    this.emailDraft.set(draft.trim());
    this.requestedTab.set('email');
    this.addLog('ai', `✉ Email drafted:\n${draft}`);
    this.enqueueSpeech('Email drafted and ready in the Email section.');
    return 'Email draft ready';
  }

  private async translate(text: string): Promise<string> {
    if (!this.llm.isReady()) {
      throw new Error('Load the model to translate.');
    }
    let out = '';
    await this.llm.generate(SYSTEM_TRANSLATE, text, [], (_, __, full) => {
      out = full;
    });
    this.addLog('ai', out);
    this.enqueueSpeech(out);
    return 'Translated';
  }

  private async createAgent(description: string): Promise<string> {
    if (!this.llm.isReady()) {
      throw new Error('Load the model to create agents.');
    }
    let raw = '';
    await this.llm.generate(SYSTEM_AGENT, description, [], (_, __, full) => {
      raw = full;
    });
    const data = this.jsonParser.parseObject<{
      name: string;
      description: string;
      systemPrompt: string;
    }>(raw);
    if (!data?.name || !data?.systemPrompt) {
      throw new Error('Could not generate a valid agent from that request.');
    }
    const agent = this.agents.addAgent({
      name: data.name,
      description: data.description || '',
      systemPrompt: data.systemPrompt,
      skillIds: [],
    });
    this.requestedTab.set('agents');
    this.addLog('ai', `🤖 Created agent "${agent.name}"`);
    this.enqueueSpeech(`Agent ${agent.name} created.`);
    return `Agent "${agent.name}" created`;
  }

  private async summarizeGmail(text = ''): Promise<string> {
    if (!this.gmail.configured()) {
      throw new Error(
        'Gmail is not configured. Open INES Voice settings and enter your Google OAuth Client ID.',
      );
    }
    const categorize = this.isCategorizeRequest(text);
    const emails = await this.gmail.fetchInbox(this.extractEmailCount(text));
    if (emails.length === 0) {
      this.addLog('ai', 'No recent inbox emails found');
      this.enqueueSpeech('No recent emails in your inbox.');
      return 'No emails found';
    }
    if (!this.llm.isReady()) {
      throw new Error('Load the model to summarize emails.');
    }
    const joined = emails
      .map((e) => `From: ${e.from}\nSubject: ${e.subject}\n${e.snippet}`)
      .join('\n\n---\n\n');
    const request = text.trim() || 'Summarize my recent inbox emails.';
    let summary = '';
    await this.llm.generate(
      SYSTEM_GMAIL,
      `User request: ${request}\n\nInbox emails:\n${joined}`,
      [],
      (_, __, full) => {
        summary = full;
      },
    );
    this.addLog('ai', summary);
    this.enqueueSpeech(summary);
    return categorize
      ? `Categorized ${emails.length} emails`
      : `Summarized ${emails.length} emails`;
  }

  private isCategorizeRequest(text: string): boolean {
    return /(categor|classif|group|table|tabella|categoria|categorie|count|conta|quanti|quante)/i.test(
      text,
    );
  }

  private extractEmailCount(text: string): number {
    if (/\b(all|tutti|tutte|every|categor|table|tabella)\b/i.test(text)) return 50;
    const m = text.match(/(\d+)\s*(?:email|e-?mail|mail|messaggi|messages)\b/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 50) return n;
    }
    return 25;
  }

  private remember(text: string): string {
    const clean = text
      .replace(
        /^(ricorda\s+che|ricordati\s+che|remember\s+that|note\s+that|nota\s+che|scrivi\s+(una\s+|un\s+)?nota|salva\s+(una\s+|un\s+)?nota|nuova\s+nota|take\s+a\s+note|capture|cattura|appunto)\s*[:,\-]?\s*/i,
        '',
      )
      .trim();
    if (!clean) throw new Error('Nothing to remember.');
    this.brain.capture(clean, 'voice');
    this.addLog('ai', `🧠 Saved to brain: ${clean}`);
    this.enqueueSpeech('Saved to your brain.');
    return 'Saved to brain';
  }

  private async recall(text: string): Promise<string> {
    const query = text
      .replace(/^(cerca|search|find|trova|ricerca|recall)\s+/i, '')
      .replace(/\b(in|nel|nel\s+mio|my|the)\s+brain\b/i, '')
      .trim();
    if (!query) throw new Error('Nothing to search for.');
    const answer = await this.brain.ask(query);
    this.addLog('ai', answer);
    this.enqueueSpeech(answer);
    return 'Recalled from brain';
  }

  async digestNow(): Promise<string> {
    if (!this.llm.isReady()) {
      throw new Error('Load the model for the daily digest.');
    }

    const todos = this.todos.todos().filter((t) => !t.done);
    const notes = this.brain.notes().slice(0, 10);
    let emails: { id: string; from: string; subject: string; snippet: string }[] = [];
    if (this.gmail.configured()) {
      try {
        emails = await this.gmail.fetchInbox(5);
      } catch {
        /* Gmail is optional in the digest */
      }
    }

    const lines: string[] = [];
    lines.push(`## Tasks (${todos.length})`);
    todos.forEach((t, i) =>
      lines.push(`${i + 1}. ${t.priority === 'priority' ? '[priority] ' : ''}${t.text}`),
    );
    lines.push(`## Notes (${notes.length})`);
    notes.forEach((n) => lines.push(`- ${n.text}`));
    if (emails.length) {
      lines.push(`## Recent emails (${emails.length})`);
      emails.forEach((e) => lines.push(`- ${e.from}: ${e.subject}`));
    }

    let summary = '';
    await this.llm.generate(SYSTEM_DIGEST, lines.join('\n'), [], (_, __, full) => {
      summary = full;
    });
    this.addLog('ai', summary);
    this.enqueueSpeech(summary);
    return 'Daily digest ready';
  }

  /** Runs the daily digest once per day, when the model is ready. */
  async maybeRunDailyDigest(): Promise<void> {
    if (!this.llm.isReady()) return;
    const today = new Date().toISOString().slice(0, 10);
    if (this.storage.get<string>('ines_last_digest_date') === today) return;
    this.storage.set('ines_last_digest_date', today);
    try {
      await this.digestNow();
    } catch {
      /* digest is best-effort at startup */
    }
  }

  private async consolidateMemories(): Promise<string> {
    const result = await this.brain.consolidate();
    if (!result) {
      this.addLog('ai', 'Nothing to consolidate yet — keep capturing notes.');
      this.enqueueSpeech('There are not enough notes to consolidate yet.');
      return 'Nothing to consolidate';
    }
    this.addLog('ai', `🧠 Consolidated ${result.consolidated} notes into a long-term memory.`);
    this.enqueueSpeech(`Consolidated ${result.consolidated} notes into long-term memory.`);
    return `Consolidated ${result.consolidated} notes`;
  }

  private scheduleReminder(text: string): string {
    const parsed = parseReminder(text);
    if (!parsed) {
      throw new Error('Could not parse the reminder time. Try "remind me to X in 30 minutes".');
    }
    this.reminders.schedule(parsed.message, parsed.at);
    const when = new Date(parsed.at).toLocaleString();
    this.addLog('ai', `⏰ Reminder set: ${parsed.message} (${when})`);
    this.enqueueSpeech(`Reminder set: ${parsed.message}, for ${when}.`);
    return 'Reminder set';
  }

  private enqueueSpeech(text: string): void {
    if (this.voiceEnabled()) this.speechQueue.push(text);
  }

  private flushSpeech(): void {
    const text = this.speechQueue.join(' ').trim();
    this.speechQueue = [];
    if (text && this.voiceEnabled()) {
      this.speech.speak('voice-assistant', text, this.voiceLang());
    }
  }

  private patchTask(id: number, patch: Partial<VoiceTask>): void {
    this.tasks.update((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  private addLog(role: 'user' | 'ai', text: string): void {
    this.log.update((list) => [...list, { id: this.nextLogId++, role, text }]);
  }
}

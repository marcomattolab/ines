import { Injectable, inject, signal } from '@angular/core';
import { SpeechService } from './speech.service';
import { LlmService, ChatMessage } from './llm.service';
import { TodoService } from './todo.service';
import { JsonParserService } from './json-parser.service';
import { ToastService } from './toast.service';
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

const SYSTEM_VOICE = `You are INES, a voice assistant. The user dictates one or more requests.
Convert them into a JSON array of tasks to execute. Each task has a "type" and a "text":

- {"type":"todo","text":"..."} — add a to-do item (text = the task)
- {"type":"answer","text":"..."} — answer a question or reply conversationally (text = the question)
- {"type":"navigate","text":"..."} — open a section; text must be exactly one of: chat, email, meeting, translate, todo, coding, agents, vision, learning, presentation, project
- {"type":"list-todos","text":""} — read the to-do list aloud

If several items are separated by "and then", "then", "poi", "," etc., split them into multiple tasks.
Keep answer texts in the same language as the user.

Respond ONLY with a JSON array. No markdown, no backticks, no explanation.`;

const SYSTEM_ANSWER = `You are INES, a friendly, precise voice assistant.
Answer in the same language as the user. Be concise and conversational, suitable to be read aloud.
Avoid markdown, bullet lists, code blocks or emojis unless strictly requested.`;

@Injectable({ providedIn: 'root' })
export class VoiceAssistantService {
  readonly speech = inject(SpeechService);
  readonly llm = inject(LlmService);
  readonly todos = inject(TodoService);
  readonly jsonParser = inject(JsonParserService);
  readonly toast = inject(ToastService);

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
  readonly voiceLang = signal('it-IT');

  /** Set to a tab id when INES must navigate; consumed by AppComponent. */
  readonly requestedTab = signal<string | null>(null);

  private history: ChatMessage[] = [];
  private speechQueue: string[] = [];
  private nextTaskId = 1;
  private nextLogId = 1;
  private processingQueue = false;

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
      this.toast.show('Non ho sentito nulla — riprova');
      return;
    }
    this.transcript.set(text);
    this.addLog('user', text);
    void this.processText(text);
  }

  clear(): void {
    this.speech.stop();
    this.tasks.set([]);
    this.log.set([]);
    this.transcript.set('');
    this.history = [];
    this.speechQueue = [];
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
    if (this.llm.isReady() && !this.llm.isBusy()) {
      try {
        const prompt = this.llm.buildPrompt(SYSTEM_VOICE, text);
        let raw = '';
        await this.llm.generate(prompt, (_, __, full) => {
          raw = full;
        });
        const mapped = this.jsonParser
          .parseArray<{ type?: string; text?: string }>(raw)
          .map((t) => ({ type: normalizeType(t?.type), text: String(t?.text ?? '') }))
          .filter(
            (t): t is ParsedTask =>
              t.type !== null && (t.text.trim().length > 0 || t.type === 'list-todos'),
          );
        if (mapped.length) return mapped;
      } catch {
        /* fall through to rules */
      }
    }
    return parseByRules(text);
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
        this.addLog('ai', `✔ Aggiunto alla lista: ${task.text}`);
        this.enqueueSpeech(`Aggiunto: ${task.text}.`);
        return 'Aggiunto alla lista';

      case 'navigate': {
        const tab = task.text.trim().toLowerCase();
        if (VALID_TABS.has(tab)) {
          this.requestedTab.set(tab);
          const label = TAB_LABELS[tab];
          this.addLog('ai', `➜ Apro la sezione ${label}`);
          this.enqueueSpeech(`Apro ${label}.`);
          return `Aperta la sezione ${label}`;
        }
        this.enqueueSpeech(`Non riconosco la sezione ${task.text}.`);
        return `Sezione non riconosciuta: ${task.text}`;
      }

      case 'list-todos':
        return this.listTodos();

      case 'answer':
        return this.answerQuestion(task.text);
    }
  }

  private listTodos(): string {
    const active = this.todos.todos().filter((t) => !t.done);
    if (active.length === 0) {
      this.addLog('ai', 'Nessun compito attivo');
      this.enqueueSpeech('Non hai compiti da fare.');
      return 'Nessun compito attivo';
    }
    this.addLog('ai', `📋 ${active.map((t) => `• ${t.text}`).join('\n')}`);
    this.enqueueSpeech(`Hai ${active.length} compiti: ${active.map((t) => t.text).join(', ')}.`);
    return `${active.length} compiti attivi`;
  }

  private async answerQuestion(question: string): Promise<string> {
    if (!this.llm.isReady()) {
      throw new Error('Carica il modello per le risposte vocali.');
    }
    this.history.push({ role: 'user', content: question });
    if (this.history.length > 20) this.history = this.history.slice(-20);

    const trimmed = this.llm.trimConversation(SYSTEM_ANSWER, question, this.history.slice(-6, -1));
    const prompt = this.llm.buildPrompt(SYSTEM_ANSWER, question, trimmed);

    let answer = '';
    await this.llm.generate(prompt, (_, __, full) => {
      answer = full;
    });
    this.history.push({ role: 'assistant', content: answer });
    this.addLog('ai', answer);
    this.enqueueSpeech(answer);
    return answer;
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

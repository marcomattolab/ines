import {
  Component,
  signal,
  inject,
  viewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  OnInit,
  computed,
} from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import {
  KnowledgeManagerService,
  KnowledgeQA,
} from '../../core/services/knowledge-manager.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { JsonParserService } from '../../core/services/json-parser.service';
import { DomUtilsService } from '../../core/services/dom-utils.service';

type SubTab =
  | 'chat'
  | 'mindmap'
  | 'quiz'
  | 'flashcards'
  | 'plan'
  | 'summary'
  | 'fillblanks'
  | 'matching'
  | 'openq';

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
}

interface FillBlank {
  text: string;
  answer: string;
  hint?: string;
}

interface MatchingPair {
  term: string;
  definition: string;
}

@Component({
  selector: 'app-learning-tab',
  standalone: true,
  imports: [
    DecimalPipe,
    DatePipe,
    FormsModule,
    MatIconModule,
    ButtonComponent,
    MessageBubbleComponent,
    TypingIndicatorComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './learning-tab.component.html',
  styleUrl: './learning-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class LearningTabComponent implements AfterViewInit, OnDestroy, OnInit {
  readonly llm = inject(LlmService);
  readonly km = inject(KnowledgeManagerService);
  readonly toast = inject(ToastService);
  private readonly jsonParser = inject(JsonParserService);
  private readonly dom = inject(DomUtilsService);

  readonly mermaidContainer = viewChild<ElementRef>('mermaidContainer');

  readonly toolNav: { id: SubTab; icon: string; label: string; color: string }[] = [
    { id: 'chat', icon: 'chat', label: 'Chat Q&A', color: 'text-blue-400' },
    { id: 'mindmap', icon: 'account_tree', label: 'Mind Map', color: 'text-purple-400' },
    { id: 'quiz', icon: 'quiz', label: 'Quiz', color: 'text-amber-400' },
    { id: 'flashcards', icon: 'style', label: 'Flashcards', color: 'text-green-400' },
    { id: 'plan', icon: 'calendar_month', label: 'Study Plan', color: 'text-cyan-400' },
    { id: 'summary', icon: 'summarize', label: 'Summary', color: 'text-rose-400' },
    { id: 'fillblanks', icon: 'edit_note', label: 'Fill Blanks', color: 'text-orange-400' },
    { id: 'matching', icon: 'compare_arrows', label: 'Matching', color: 'text-indigo-400' },
    { id: 'openq', icon: 'question_answer', label: 'Open Q&A', color: 'text-emerald-400' },
  ];

  activeSubTab = signal<SubTab>('chat');
  userInput = signal('');
  messages = signal<ChatMessage[]>([]);
  isGenerating = signal(false);
  totalChunks = signal(0);
  selectedDocId = signal<string | null>(null);

  quizQuestions = signal<QuizQuestion[]>([]);
  selectedAnswers = signal<number[]>([]);
  currentQuizIdx = signal(0);
  quizScore = signal(0);
  showQuizResults = signal(false);
  numQuizQuestions = signal(5);
  quizTimerMin = signal(5);
  numQuizOptions = signal(4);
  quizSecondsLeft = signal(0);
  private timerHandle: any = null;

  flashcardsText = signal('');

  fillBlanks = signal<FillBlank[]>([]);
  fillBlankAnswers = signal<string[]>([]);
  fillBlankRevealed = signal<boolean[]>([]);
  fillBlankScore = signal(0);

  matchingPairs = signal<MatchingPair[]>([]);
  matchingSelected = signal<{ termIdx: number; defIdx: number } | null>(null);
  matchingMatched = signal<Set<number>>(new Set());
  matchingScore = signal(0);

  openQuestion = signal('');
  openAnswer = signal('');
  openFeedback = signal('');

  studyPlan = signal('');
  summaryText = signal('');

  isSpeaking = signal(false);
  savedQAs = signal<KnowledgeQA[]>([]);
  showClearConfirm = signal(false);

  isMindMapPlaceholder = true;
  showMindMapOnRight = signal(false);
  zoomLevel = signal(1.0);
  panX = signal(0);
  panY = signal(0);
  isDragging = false;
  private dragStart = { x: 0, y: 0, px: 0, py: 0 };

  searchQuery = signal('');

  readonly filteredDocs = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.km.documents();
    return this.km.documents().filter((d) => d.name.toLowerCase().includes(q));
  });

  async ngOnInit() {
    await this.km.loadDocuments();
    this.totalChunks.set(await this.km.countChunks());
    this.savedQAs.set(await this.km.getQAs());
  }

  ngAfterViewInit() {
    this.renderMindMap('mindmap\n  root((Learning Center))\n    (Upload documents to start)');
  }

  // ── Navigation ──

  selectSubTab(tab: SubTab) {
    this.activeSubTab.set(tab);
    if (
      tab === 'mindmap' &&
      this.isMindMapPlaceholder &&
      this.km.documents().length > 0 &&
      !this.isGenerating() &&
      this.llm.isReady()
    ) {
      this.generateMindMap();
    }
    if (
      tab === 'quiz' &&
      this.quizQuestions().length === 0 &&
      this.km.documents().length > 0 &&
      !this.isGenerating() &&
      this.llm.isReady()
    ) {
      this.generateQuiz();
    }
    if (
      tab === 'flashcards' &&
      !this.flashcardsText() &&
      this.km.documents().length > 0 &&
      !this.isGenerating() &&
      this.llm.isReady()
    ) {
      this.generateFlashcards();
    }
    if (
      tab === 'plan' &&
      !this.studyPlan() &&
      this.km.documents().length > 0 &&
      !this.isGenerating() &&
      this.llm.isReady()
    ) {
      this.generateStudyPlan();
    }
    if (
      tab === 'summary' &&
      !this.summaryText() &&
      this.km.documents().length > 0 &&
      !this.isGenerating() &&
      this.llm.isReady()
    ) {
      this.generateSummary();
    }
    if (
      tab === 'fillblanks' &&
      this.fillBlanks().length === 0 &&
      this.km.documents().length > 0 &&
      !this.isGenerating() &&
      this.llm.isReady()
    ) {
      this.generateFillBlanks();
    }
    if (
      tab === 'matching' &&
      this.matchingPairs().length === 0 &&
      this.km.documents().length > 0 &&
      !this.isGenerating() &&
      this.llm.isReady()
    ) {
      this.generateMatching();
    }
    if (
      tab === 'openq' &&
      !this.openQuestion() &&
      this.km.documents().length > 0 &&
      !this.isGenerating() &&
      this.llm.isReady()
    ) {
      this.generateOpenQuestion();
    }
  }

  // ── Document management ──

  async onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files.length) return;
    for (let i = 0; i < files.length; i++) {
      try {
        await this.km.processFile(files[i]);
        this.toast.success(`"${files[i].name}" added`);
      } catch (err: any) {
        if (!err.message?.includes('Duplicate')) this.toast.error(err.message);
      }
    }
    await this.km.loadDocuments();
    this.totalChunks.set(await this.km.countChunks());
    event.target.value = '';
  }

  async deleteDoc(e: Event, id: string) {
    e.stopPropagation();
    await this.km.deleteDocument(id);
    await this.km.loadDocuments();
    this.totalChunks.set(await this.km.countChunks());
  }

  async clearAll() {
    await this.km.clearAll();
    this.messages.set([]);
    this.flashcardsText.set('');
    this.studyPlan.set('');
    this.summaryText.set('');
    this.quizQuestions.set([]);
    this.fillBlanks.set([]);
    this.matchingPairs.set([]);
    this.openQuestion.set('');
    this.savedQAs.set([]);
    this.totalChunks.set(0);
    this.isMindMapPlaceholder = true;
    this.renderMindMap('mindmap\n  root((Learning Center))\n    (Upload documents to start)');
    this.toast.show('All cleared');
  }

  // ── Chat ──

  async sendMessage() {
    const text = this.userInput().trim();
    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }
    if (!text || this.isGenerating()) return;

    this.isGenerating.set(true);
    this.messages.update((m) => [...m, { role: 'user', content: text }]);
    this.userInput.set('');

    try {
      const chunks = await this.km.getRelevantChunks(text, 3, 300);
      const ctx = chunks.map((c) => `[${c.docName}]\n${c.text}`).join('\n\n---\n\n');
      const system = `You are an expert learning assistant. Answer using the document context. Use Markdown. Cite source doc names.

${chunks.length > 0 ? 'Context:\n' + ctx : 'No relevant documents found — answer from your own knowledge.'}`;

      const trimmed = this.llm.trimConversation(system, text, this.messages().slice(-6, -1));
      const prompt = this.llm.buildPrompt(system, text, trimmed);
      this.messages.update((m) => [...m, { role: 'assistant', content: '' }]);

      let full = '';
      await this.llm.generate(prompt, (_, done, fullText) => {
        full = fullText;
        this.messages.update((msgs) => {
          const n = [...msgs];
          n[n.length - 1].content = full;
          return n;
        });
        if (done) {
          this.isGenerating.set(false);
          this.offerSaveQA(
            text,
            full,
            chunks.map((c) => c.docName),
          );
        }
      });
    } catch (err: any) {
      this.toast.error(
        err.message?.includes('INVALID_ARGUMENT') ? 'Conversation too long' : err.message,
      );
      this.isGenerating.set(false);
    }
  }

  private async offerSaveQA(q: string, a: string, sources: string[]) {
    if (!a.trim()) return;
    await this.km.saveQA(
      q,
      a,
      sources.map((n) => ({ docName: n, text: '' })),
    );
    this.savedQAs.set(await this.km.getQAs());
    this.toast.show('Q&A saved');
  }

  async deleteQA(id: string) {
    await this.km.deleteQA(id);
    this.savedQAs.set(await this.km.getQAs());
  }

  // ── Mindmap ──

  async generateMindMap() {
    if (!this.llm.isReady()) {
      this.toast.error('Load the model first!');
      return;
    }
    if (this.km.documents().length === 0) {
      this.toast.error('Upload documents first.');
      return;
    }

    this.isGenerating.set(true);
    this.activeSubTab.set('mindmap');
    const chunks = await this.km.getRelevantChunks(
      'key concepts main topics important facts details',
      15,
      2000,
    );
    const system = `Generate a Mermaid.js mindmap. Start with "mindmap" line 1. 2 spaces per indent. Put text with spaces in parentheses. Output ONLY valid mindmap syntax — no markdown. 5-8 main branches with sub-branches.

Example:
mindmap
  root((Overview))
    (Topic A)
      (Subtopic)
        (Detail)

Context:
${chunks.map((c) => c.text).join('\n\n')}`;

    try {
      const prompt = this.llm.buildPrompt(system, 'Generate a mindmap.');
      const result = await this.llm.generate(prompt, () => {});
      const code = this.cleanMermaidCode(result);
      await this.renderMindMap(code);
      this.isMindMapPlaceholder = false;
    } catch (err: any) {
      this.toast.error('Error: ' + err.message);
    }
    this.isGenerating.set(false);
  }

  cleanMermaidCode(raw: string): string {
    const m = raw.match(/```(?:mermaid)?([\s\S]*?)```/i);
    let c = m ? m[1] : raw;
    const idx = c.toLowerCase().indexOf('mindmap');
    c = idx !== -1 ? c.substring(idx) : 'mindmap\n' + c;
    const lines = c.split('\n');
    const res: string[] = ['mindmap'];
    let found = false;
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (t.toLowerCase() === 'mindmap') {
        found = true;
        continue;
      }
      if (!found) continue;
      const ind = (line.match(/^(\s*)/)?.[1] || '').replace(/\t/g, '  ');
      let txt = t
        .replace(/^[-*+]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .trim();
      txt = txt
        .replace(/[()[\]{}"]/g, '')
        .replace(/\\/g, '')
        .trim();
      if (!txt) continue;
      res.push(' '.repeat(Math.min(ind.length, 8)) + `(${txt})`);
    }
    if (res.length === 1) res.push('  ((No concepts extracted))');
    return res.join('\n');
  }

  private mermaidP: Promise<any> | null = null;
  private async getMermaid(): Promise<any> {
    if (!this.mermaidP) {
      this.mermaidP = import('mermaid').then((m) => {
        m.default.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
        return m.default;
      });
    }
    return this.mermaidP;
  }

  async renderMindMap(code: string) {
    const el = this.mermaidContainer();
    if (!el) return;
    try {
      const m = await this.getMermaid();
      const { svg } = await m.render('mm-' + Date.now(), code);
      el.nativeElement.innerHTML = svg;
    } catch {
      el.nativeElement.innerHTML = `<div class="text-center p-6 text-red-400">Render failed. <button onclick="window.dispatchEvent(new Event('lm-regen'))" class="underline">Retry</button></div><pre class="text-xs text-zinc-500 mt-2">${code}</pre>`;
    }
  }

  zoomIn() {
    this.zoomLevel.update((z) => Math.min(2.5, z + 0.15));
  }
  zoomOut() {
    this.zoomLevel.update((z) => Math.max(0.4, z - 0.15));
  }
  zoomReset() {
    this.zoomLevel.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }
  onPanDown(e: PointerEvent) {
    this.isDragging = true;
    this.dragStart = { x: e.clientX, y: e.clientY, px: this.panX(), py: this.panY() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  onPanMove(e: PointerEvent) {
    if (!this.isDragging) return;
    this.panX.set(this.dragStart.px + e.clientX - this.dragStart.x);
    this.panY.set(this.dragStart.py + e.clientY - this.dragStart.y);
  }
  onPanUp() {
    this.isDragging = false;
  }
  onPanWheel(e: WheelEvent) {
    e.preventDefault();
    this.zoomLevel.update((z) => Math.max(0.4, Math.min(2.5, z + (e.deltaY > 0 ? -0.1 : 0.1))));
  }

  // ── Quiz ──

  async generateQuiz() {
    if (!this.llm.isReady()) {
      this.toast.error('Load the model first!');
      return;
    }
    if (this.km.documents().length === 0) {
      this.toast.error('Upload documents first.');
      return;
    }

    this.isGenerating.set(true);
    this.activeSubTab.set('quiz');
    this.showQuizResults.set(false);
    this.quizScore.set(0);
    this.currentQuizIdx.set(0);

    const nq = Math.max(1, Math.min(15, Number(this.numQuizQuestions()) || 5));
    const no = Math.max(2, Math.min(6, Number(this.numQuizOptions()) || 4));
    const chunks = await this.km.getRelevantChunks('important facts key concepts', 6, 500);
    const system = `Generate ${nq} multiple-choice questions with ${no} options each, one correct. Output ONLY a JSON array. Example:
[{"question":"What is X?","options":["A","B","C","D"],"answer":0,"explanation":"Because..."}]

Context:
${chunks.map((c) => c.text).join('\n\n')}`;

    try {
      const prompt = this.llm.buildPrompt(system, `Generate ${nq} quiz questions.`);
      const result = await this.llm.generate(prompt, () => {});
      const parsed = this.jsonParser.parseArray<any>(result);
      if (!parsed?.length) throw new Error('No questions parsed');
      const norm: QuizQuestion[] = parsed.map((q: any) => {
        let opts = Array.isArray(q.options) ? q.options.filter(Boolean).slice(0, no) : [];
        while (opts.length < no) opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
        return {
          question: q.question || 'No question',
          options: opts,
          answer: typeof q.answer === 'number' && q.answer >= 0 && q.answer < no ? q.answer : 0,
          explanation: q.explanation || '',
        };
      });
      this.selectedAnswers.set(new Array(norm.length).fill(-1));
      this.quizQuestions.set(norm);
      this.startQuizTimer();
    } catch (err: any) {
      this.toast.error('Quiz failed: ' + (err.message || 'try again'));
    }
    this.isGenerating.set(false);
  }

  selectAnswer(idx: number) {
    this.selectedAnswers.update((a) => {
      const c = [...a];
      c[this.currentQuizIdx()] = idx;
      return c;
    });
  }
  prevQuestion() {
    this.currentQuizIdx.update((i) => Math.max(0, i - 1));
  }
  nextQuestion() {
    this.currentQuizIdx.update((i) => Math.min(this.quizQuestions().length - 1, i + 1));
  }

  submitQuiz() {
    this.stopTimer();
    let score = 0;
    const qs = this.quizQuestions();
    const sel = this.selectedAnswers();
    for (let i = 0; i < qs.length; i++) {
      if (sel[i] === qs[i].answer) score++;
    }
    this.quizScore.set(score);
    this.showQuizResults.set(true);
  }

  startQuizTimer() {
    this.stopTimer();
    const m = Math.max(1, Math.min(60, Number(this.quizTimerMin()) || 5));
    this.quizSecondsLeft.set(m * 60);
    this.timerHandle = setInterval(() => {
      this.quizSecondsLeft.update((s) => {
        if (s <= 1) {
          this.stopTimer();
          this.submitQuiz();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }
  stopTimer() {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  // ── Flashcards ──

  async generateFlashcards() {
    if (!this.llm.isReady() || this.km.documents().length === 0) return;
    this.isGenerating.set(true);
    this.activeSubTab.set('flashcards');
    const chunks = await this.km.getRelevantChunks('key concepts definitions terms', 10, 1500);
    const system =
      'Generate 15-20 flashcards (Q&A pairs). Output ONLY CSV: front,back. No headers. One per line.';
    try {
      const prompt = this.llm.buildPrompt(
        system,
        `Context:\n${chunks.map((c) => c.text).join('\n\n')}\n\nGenerate flashcards:`,
      );
      const result = await this.llm.generate(prompt, () => {});
      this.flashcardsText.set(result);
    } catch (err: any) {
      this.flashcardsText.set('Error: ' + err.message);
    }
    this.isGenerating.set(false);
  }

  downloadFlashcards() {
    const csv = this.flashcardsText();
    if (!csv.trim()) return;
    const lines = csv.split('\n').filter((l) => l.includes('","'));
    this.dom.downloadText('front,back\n' + lines.join('\n'), 'flashcards.csv');
    this.toast.success('Downloaded');
  }

  // ── Study Plan ──

  async generateStudyPlan() {
    if (!this.llm.isReady() || this.km.documents().length === 0) return;
    this.isGenerating.set(true);
    this.activeSubTab.set('plan');
    const chunks = await this.km.getRelevantChunks(
      'overview introduction structure topics chapters',
      10,
      2500,
    );
    const system = `Create a detailed study plan from the context. Include: ## Estimated Duration, ## Schedule, ## Key Topics, ## Learning Objectives, ## Practice Exercises, ## Review Milestones. Use Markdown.

Context:
${chunks.map((c) => c.text).join('\n\n')}`;
    try {
      const prompt = this.llm.buildPrompt(system, 'Create a study plan.');
      const result = await this.llm.generate(prompt, () => {});
      this.studyPlan.set(result);
    } catch (err: any) {
      this.studyPlan.set('Error: ' + err.message);
    }
    this.isGenerating.set(false);
  }

  // ── Summarizer ──

  async generateSummary() {
    if (!this.llm.isReady() || this.km.documents().length === 0) return;
    this.isGenerating.set(true);
    this.activeSubTab.set('summary');
    const chunks = await this.km.getRelevantChunks(
      'overview summary introduction conclusion main points',
      8,
      3000,
    );
    const system = `Create a comprehensive summary. Include: ## TL;DR, ## Key Points (5-8 bullets), ## Main Concepts, ## Important Facts, ## Conclusion. Use Markdown.

Context:
${chunks.map((c) => c.text).join('\n\n')}`;
    try {
      const prompt = this.llm.buildPrompt(system, 'Summarize the documents.');
      const result = await this.llm.generate(prompt, () => {});
      this.summaryText.set(result);
    } catch (err: any) {
      this.summaryText.set('Error: ' + err.message);
    }
    this.isGenerating.set(false);
  }

  // ── Fill-in-the-blanks ──

  async generateFillBlanks() {
    if (!this.llm.isReady() || this.km.documents().length === 0) return;
    this.isGenerating.set(true);
    this.activeSubTab.set('fillblanks');
    const chunks = await this.km.getRelevantChunks(
      'key facts definitions important terms',
      8,
      2000,
    );
    const system = `Generate 6 fill-in-the-blank exercises. Output ONLY JSON array. Each: text (with ___), answer, hint. Example:
[{"text":"Angular uses ___ as its language.","answer":"TypeScript","hint":"Superset of JavaScript"}]

Context:
${chunks.map((c) => c.text).join('\n\n')}`;
    try {
      const prompt = this.llm.buildPrompt(system, 'Generate fill-in-the-blank exercises as JSON.');
      const result = await this.llm.generate(prompt, () => {});
      const parsed = this.jsonParser.parseArray<any>(result);
      const valid = (parsed || []).filter((f: any) => f.text && f.answer);
      if (valid.length === 0) throw new Error('No exercises parsed');
      this.fillBlanks.set(valid);
      this.fillBlankAnswers.set(new Array(valid.length).fill(''));
      this.fillBlankRevealed.set(new Array(valid.length).fill(false));
      this.fillBlankScore.set(0);
    } catch (err: any) {
      this.toast.error('Failed: ' + (err.message || 'try again'));
    }
    this.isGenerating.set(false);
  }

  updateFillAnswer(i: number, v: string) {
    this.fillBlankAnswers.update((a) => {
      const c = [...a];
      c[i] = v;
      return c;
    });
  }

  checkFillBlanks() {
    let s = 0;
    const b = this.fillBlanks();
    const a = this.fillBlankAnswers();
    const r = [...this.fillBlankRevealed()];
    for (let i = 0; i < b.length; i++) {
      if (a[i].trim().toLowerCase() === b[i].answer.toLowerCase()) {
        s++;
        r[i] = true;
      }
    }
    this.fillBlankScore.set(s);
    this.fillBlankRevealed.set(r);
    this.toast.show(`Score: ${s}/${b.length}`);
  }

  revealBlanks() {
    this.fillBlankRevealed.set(new Array(this.fillBlanks().length).fill(true));
  }

  // ── Matching ──

  async generateMatching() {
    if (!this.llm.isReady() || this.km.documents().length === 0) return;
    this.isGenerating.set(true);
    this.activeSubTab.set('matching');
    const chunks = await this.km.getRelevantChunks('definitions glossary terms concepts', 8, 2000);
    const system = `Generate 6 matching pairs (term -> definition). Output ONLY JSON array. Example:
[{"term":"Angular","definition":"A TypeScript-based web framework by Google"}]

Context:
${chunks.map((c) => c.text).join('\n\n')}`;
    try {
      const prompt = this.llm.buildPrompt(system, 'Generate matching pairs as JSON.');
      const result = await this.llm.generate(prompt, () => {});
      const parsed = this.jsonParser.parseArray<any>(result);
      const valid = (parsed || []).filter((m: any) => m.term && m.definition);
      if (valid.length === 0) throw new Error('No pairs parsed');
      this.matchingPairs.set(valid);
      this.matchingMatched.set(new Set());
      this.matchingScore.set(0);
    } catch (err: any) {
      this.toast.error('Failed: ' + (err.message || 'try again'));
    }
    this.isGenerating.set(false);
  }

  clickMatchingTerm(idx: number) {
    const sel = this.matchingSelected();
    if (sel) {
      if (idx === sel.termIdx) {
        this.matchingSelected.set(null);
      } else if (sel.defIdx === -1) {
        this.matchingSelected.set({ termIdx: sel.termIdx, defIdx: idx });
        this.checkMatch(sel.termIdx, idx);
      } else {
        this.matchingSelected.set({ termIdx: idx, defIdx: -1 });
      }
    } else {
      this.matchingSelected.set({ termIdx: idx, defIdx: -1 });
    }
  }

  clickMatchingDef(idx: number) {
    const sel = this.matchingSelected();
    if (!sel) return;
    if (idx === sel.defIdx) {
      this.matchingSelected.set(null);
    } else if (sel.defIdx === -1) {
      this.matchingSelected.set({ termIdx: sel.termIdx, defIdx: idx });
      this.checkMatch(sel.termIdx, idx);
    }
  }

  private checkMatch(ti: number, di: number) {
    if (ti === di) {
      this.matchingMatched.update((s) => {
        const n = new Set(s);
        n.add(ti);
        return n;
      });
      this.matchingScore.update((s) => s + 1);
      if (this.matchingMatched().size === this.matchingPairs().length) {
        this.toast.success(`All matched! ${this.matchingScore()}/${this.matchingPairs().length}`);
      }
    }
    this.matchingSelected.set(null);
  }

  // ── Open-ended Q&A ──

  async generateOpenQuestion() {
    if (!this.llm.isReady() || this.km.documents().length === 0) return;
    this.isGenerating.set(true);
    this.activeSubTab.set('openq');
    const chunks = await this.km.getRelevantChunks(
      'concepts understanding analysis application',
      8,
      2000,
    );
    const system = `Generate 1 thought-provoking open-ended question. Output ONLY JSON object. Example:
{"question":"What are the trade-offs between...?","expected":"Key points: performance vs maintainability, etc."}

Context:
${chunks.map((c) => c.text).join('\n\n')}`;
    try {
      const prompt = this.llm.buildPrompt(system, 'Generate open-ended question as JSON.');
      const result = await this.llm.generate(prompt, () => {});
      const parsed = this.jsonParser.parse(result) as any;
      if (parsed?.question) {
        this.openQuestion.set(parsed.question);
        this.openAnswer.set('');
        this.openFeedback.set(parsed.expected || '');
      } else {
        throw new Error('No question parsed');
      }
    } catch (err: any) {
      this.toast.error('Failed: ' + (err.message || 'try again'));
    }
    this.isGenerating.set(false);
  }

  async evaluateOpenAnswer() {
    const a = this.openAnswer().trim();
    if (!a || !this.llm.isReady()) return;
    this.isGenerating.set(true);
    const system = `Evaluate this answer. Rate 1-10. Give specific, constructive feedback in 3-4 sentences. Be encouraging.

Question: ${this.openQuestion()}
Expected points: ${this.openFeedback()}
Answer: ${a}`;
    try {
      const prompt = this.llm.buildPrompt(system, 'Evaluate.');
      let full = '';
      await this.llm.generate(prompt, (_, __, f) => {
        full = f;
      });
      this.openFeedback.set(full);
    } catch {
      /* fail silently */
    }
    this.isGenerating.set(false);
  }

  // ── TTS ──

  speak(text: string) {
    if (!text || this.isSpeaking()) return;
    if (!window.speechSynthesis) {
      this.toast.show('TTS not supported');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.onend = () => this.isSpeaking.set(false);
    u.onerror = () => this.isSpeaking.set(false);
    this.isSpeaking.set(true);
    window.speechSynthesis.speak(u);
  }

  stopSpeaking() {
    window.speechSynthesis?.cancel();
    this.isSpeaking.set(false);
  }

  // ── Quiz helpers ──

  decQuestions() {
    this.numQuizQuestions.update((n) => Math.max(1, n - 1));
  }
  incQuestions() {
    this.numQuizQuestions.update((n) => Math.min(15, n + 1));
  }
  decTimer() {
    this.quizTimerMin.update((t) => Math.max(1, t - 1));
  }
  incTimer() {
    this.quizTimerMin.update((t) => Math.min(60, t + 1));
  }
  decOptions() {
    this.numQuizOptions.update((o) => Math.max(2, o - 1));
  }
  incOptions() {
    this.numQuizOptions.update((o) => Math.min(6, o + 1));
  }

  formatTime(s: number): string {
    const m = Math.floor(s / 60);
    return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  }
  optionLetter(i: number): string {
    return String.fromCharCode(65 + i);
  }
  html(t: string) {
    return this.dom.escapeHtml(t);
  }

  ngOnDestroy() {
    this.stopTimer();
    this.stopSpeaking();
  }
}

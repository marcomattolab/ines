import {
  Component,
  signal,
  inject,
  viewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { RagService } from '../../core/services/rag.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { JsonParserService } from '../../core/services/json-parser.service';
import { DomUtilsService } from '../../core/services/dom-utils.service';

@Component({
  selector: 'app-learning-tab',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MatIconModule, ButtonComponent, MessageBubbleComponent],
  templateUrl: './learning-tab.component.html',
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
  styles: [
    `
      #mermaidContainer svg {
        max-width: 100%;
        max-height: 100%;
        height: auto;
        width: auto;
      }
    `,
  ],
})
export class LearningTabComponent implements AfterViewInit, OnDestroy {
  readonly llm = inject(LlmService);
  readonly rag = inject(RagService);
  readonly toast = inject(ToastService);
  private readonly jsonParser = inject(JsonParserService);
  private readonly dom = inject(DomUtilsService);

  readonly mermaidContainer = viewChild<ElementRef>('mermaidContainer');

  userInput = signal('');
  messages = signal<ChatMessage[]>([]);
  isGenerating = signal(false);

  files = signal<File[]>([]);
  isProcessing = signal(false);

  quizQuestions = signal<any[]>([]);
  selectedAnswers = signal<number[]>([]);
  currentQuizIndex = signal(0);
  quizScore = signal(0);
  showQuizResults = signal(false);
  numQuizQuestions = signal(5);
  quizTimerDuration = signal(5);
  numQuizOptions = signal(4);
  quizSecondsLeft = signal(0);
  private timerIntervalId: any = null;

  activeSubTab = signal<'chat' | 'mindmap' | 'quiz' | 'flashcards'>('chat');
  isMindMapPlaceholder = true;
  showMindMapOnRight = signal(false);
  zoomLevel = signal(1.0);
  panX = signal(0);
  panY = signal(0);
  isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartPanX = 0;
  private dragStartPanY = 0;

  selectSubTab(tab: 'chat' | 'mindmap' | 'quiz' | 'flashcards') {
    this.activeSubTab.set(tab);
    if (tab === 'flashcards' && this.rag.hasContext() && !this.isGenerating()) {
      this.generateFlashcards();
    }
    if (
      tab === 'mindmap' &&
      this.isMindMapPlaceholder &&
      this.rag.hasContext() &&
      !this.isGenerating()
    ) {
      this.generateMindMap();
    }
  }

  toggleDockMindMap() {
    this.showMindMapOnRight.update((d) => !d);
    if (
      this.showMindMapOnRight() &&
      this.isMindMapPlaceholder &&
      this.rag.hasContext() &&
      !this.isGenerating()
    ) {
      this.generateMindMap();
    }
  }

  zoomIn() {
    this.zoomLevel.update((z) => Math.min(2.5, z + 0.15));
  }

  zoomOut() {
    this.zoomLevel.update((z) => Math.max(0.4, z - 0.15));
  }

  zoomReset() {
    this.zoomLevel.set(1.0);
    this.panX.set(0);
    this.panY.set(0);
  }

  onMindMapPointerDown(event: PointerEvent) {
    this.isDragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragStartPanX = this.panX();
    this.dragStartPanY = this.panY();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  onMindMapPointerMove(event: PointerEvent) {
    if (!this.isDragging) return;
    this.panX.set(this.dragStartPanX + (event.clientX - this.dragStartX));
    this.panY.set(this.dragStartPanY + (event.clientY - this.dragStartY));
  }

  onMindMapPointerUp() {
    this.isDragging = false;
  }

  onMindMapWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    this.zoomLevel.update((z) => Math.max(0.4, Math.min(2.5, z + delta)));
  }

  ngAfterViewInit() {
    this.renderMindMap('mindmap\n  root((Learning Context))\n    (Topic 1)\n    (Topic 2)');
    window.addEventListener('regenerate-mindmap', () => {
      this.generateMindMap();
    });
  }

  async onFileSelected(event: any) {
    const selectedFiles: FileList = event.target.files;
    if (!selectedFiles.length) return;

    this.isProcessing.set(true);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        await this.rag.processFile(file);
        this.files.update((f) => [...f, file]);
      }
      this.isMindMapPlaceholder = true;
      this.toast.success('Documents processed and added to context.');
    } catch (err: any) {
      this.toast.error('Error processing files: ' + err.message);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async sendMessage() {
    const text = this.userInput().trim();
    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }
    if (!text || this.isGenerating()) return;

    const context = this.rag.getRelevantChunks(text);
    const systemPrompt = `You are a learning assistant. Use the following context to answer the user's question. If the answer is not in the context, use your general knowledge but mention it's not in the documents.
    
    CONTEXT:
    ${context}
    `;

    const userMsg: ChatMessage = { role: 'user', content: text };
    this.messages.update((m) => [...m, userMsg]);
    this.userInput.set('');
    this.isGenerating.set(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    this.messages.update((m) => [...m, assistantMsg]);

    try {
      const trimmed = this.llm.trimConversation(systemPrompt, text, this.messages().slice(-6, -1));
      const fullPrompt = this.llm.buildPrompt(systemPrompt, text, trimmed);
      await this.llm.generate(fullPrompt, (partial, done, full) => {
        this.messages.update((msgs) => {
          const newMsgs = [...msgs];
          newMsgs[newMsgs?.length - 1].content = full;
          return newMsgs;
        });
        if (done) this.isGenerating.set(false);
      });
    } catch (err: any) {
      this.toast.error(
        err.message?.includes('INVALID_ARGUMENT')
          ? '⚠️ Conversation too long for this model. Try clearing older messages.'
          : err.message,
      );
      this.isGenerating.set(false);
    }
  }

  cleanMermaidCode(rawText: string): string {
    // 1. Try to extract content inside ```mermaid ... ``` or ``` ... ```
    const codeBlockMatch = rawText.match(/```(?:mermaid)?([\s\S]*?)```/i);
    let cleaned = codeBlockMatch ? codeBlockMatch[1] : rawText;

    // 2. Find where the "mindmap" keyword starts
    const mindmapIndex = cleaned.toLowerCase().indexOf('mindmap');
    if (mindmapIndex !== -1) {
      cleaned = cleaned.substring(mindmapIndex).trim();
    } else {
      cleaned = 'mindmap\n' + cleaned.trim();
    }

    const lines = cleaned.split('\n');
    const tempLines: { indentSize: number; content: string }[] = [];
    let foundMindmap = false;

    for (let line of lines) {
      const content = line.trim();
      if (!content) continue;

      if (content.toLowerCase() === 'mindmap') {
        foundMindmap = true;
        continue;
      }

      if (!foundMindmap) continue;

      // Convert tabs to spaces for indent sizing
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      const spaceIndent = indent.replace(/\t/g, '  ');

      // Strip bullet points or numbering from content
      let cleanedContent = content.replace(/^[-*+]\s+/, '');
      cleanedContent = cleanedContent.replace(/^\d+\.\s+/, '');
      cleanedContent = cleanedContent.trim();

      if (cleanedContent) {
        tempLines.push({
          indentSize: spaceIndent.length,
          content: cleanedContent,
        });
      }
    }

    if (tempLines.length === 0) {
      return 'mindmap\n  root((Learning Context))\n    (No concepts extracted)';
    }

    // Get unique indentation sizes sorted ascending
    const uniqueSizes = Array.from(new Set(tempLines.map((l) => l.indentSize))).sort(
      (a, b) => a - b,
    );

    const processedLines: string[] = ['mindmap'];
    let rootNodeParsed = false;

    for (const line of tempLines) {
      const level = uniqueSizes.indexOf(line.indentSize);

      // If we've already parsed the root node and hit a line that maps back to level 0,
      // it is conversational text or an invalid second root. We stop parsing here.
      if (rootNodeParsed && level === 0) {
        break;
      }

      // Sanitize and format the node text
      const formattedContent = this.cleanNodeText(line.content);
      if (!formattedContent) continue;

      const normalizedIndent = ' '.repeat(level * 2);
      processedLines.push(normalizedIndent + formattedContent);
      rootNodeParsed = true;
    }

    return processedLines.join('\n');
  }

  private cleanNodeText(content: string): string {
    content = content.trim();
    if (!content) return '';

    const sanitizeText = (text: string) => {
      return text
        .replace(/[()\[\]{}"]/g, '') // Remove parentheses, brackets, curly braces, and quotes
        .replace(/\\/g, '') // Remove backslashes
        .trim();
    };

    // Patterns for shapes
    // 1. root((text)) or id((text))
    const rootDoubleParenMatch = content.match(/^([a-zA-Z0-9_-]+)\(\((.*)\)\)$/);
    if (rootDoubleParenMatch) {
      const id = rootDoubleParenMatch[1];
      const text = sanitizeText(rootDoubleParenMatch[2]);
      return `${id}((${text}))`;
    }

    // 2. ((text))
    const doubleParenMatch = content.match(/^\(\((.*)\)\)$/);
    if (doubleParenMatch) {
      return `((${sanitizeText(doubleParenMatch[1])}))`;
    }

    // 3. (text)
    const singleParenMatch = content.match(/^\((.*)\)$/);
    if (singleParenMatch) {
      return `(${sanitizeText(singleParenMatch[1])})`;
    }

    // 4. [text]
    const bracketMatch = content.match(/^\[(.*)\]$/);
    if (bracketMatch) {
      return `[${sanitizeText(bracketMatch[1])}]`;
    }

    // 5. {text}
    const braceMatch = content.match(/^\{(.*)\}$/);
    if (braceMatch) {
      return `{${sanitizeText(braceMatch[1])}}`;
    }

    // 6. "text"
    const quoteMatch = content.match(/^"(.*)"$/);
    if (quoteMatch) {
      return `"${sanitizeText(quoteMatch[1])}"`;
    }

    // If not matched, wrap in parenthesis to handle spaces/special characters
    return `(${sanitizeText(content)})`;
  }

  async generateMindMap() {
    if (!this.llm.isReady()) {
      this.toast.error('Load the model first!');
      return;
    }
    if (!this.rag.hasContext()) {
      this.toast.error('Please upload documents first.');
      return;
    }

    this.isGenerating.set(true);
    this.activeSubTab.set('mindmap');

    const systemPrompt = `You are a mind map generator. Based on the context provided, generate a comprehensive Mermaid.js mindmap capturing the full depth of the content.

     CRITICAL RULES:
     1. Start directly with the word "mindmap" on the first line.
     2. Use 2 spaces per indentation level for hierarchy.
     3. Every node text containing spaces or special characters MUST be wrapped in parentheses, e.g. (My Node Title).
     4. Do NOT output any bullet points, numbered lists, markdown, or explanations. Output ONLY valid Mermaid.js mindmap syntax.
     5. Create a deep, thorough map: 5-8 main branches from root, each with 2-4 sub-branches, and supporting details as leaf nodes where useful.
     6. Use full descriptive node names — extract the actual concepts, facts, and terminology from the documents.

     Example format:
     mindmap
       root((Document Overview))
         (Major Topic A)
           (Core Idea 1)
             (Supporting Fact)
             (Key Detail)
           (Core Idea 2)
             (Important Point)
         (Major Topic B)
           (Main Concept)
             (Specific Detail)
             (Related Info)
           (Secondary Concept)
         (Major Topic C)
           (Essential Point)
             (Detail)
             (Example)
           (Another Point)

     Context:
     ${this.rag.getRelevantChunks('key concepts main topics important facts details terminology', 15, 2000)}
     `;

    try {
      const fullPrompt = this.llm.buildPrompt(
        systemPrompt,
        'Generate a mindmap of the main concepts.',
      );
      const result = await this.llm.generate(fullPrompt, () => {});
      console.log('Raw model mindmap response:', result);

      const code = this.cleanMermaidCode(result);
      console.log('Cleaned Mermaid code for rendering:\n', code);

      await this.renderMindMap(code);
      this.isMindMapPlaceholder = false;
    } catch (err: any) {
      console.error('Error generating mind map:', err);
      this.toast.error('Error generating mind map: ' + err.message);
    } finally {
      this.isGenerating.set(false);
    }
  }

  private mermaidPromise: Promise<any> | null = null;

  private async getMermaid(): Promise<any> {
    if (!this.mermaidPromise) {
      this.mermaidPromise = import('mermaid').then((m) => {
        m.default.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'loose',
        });
        return m.default;
      });
    }
    return this.mermaidPromise;
  }

  async renderMindMap(code: string) {
    const container = this.mermaidContainer();
    if (!container) return;
    try {
      const mermaid = await this.getMermaid();
      const { svg } = await mermaid.render('mermaid-svg-' + Date.now(), code);
      container.nativeElement.innerHTML = svg;
    } catch (err) {
      console.error('Mermaid rendering error:', err);
      console.error('Offending Mermaid code was:\n', code);
      // Fallback to a simple message if rendering fails
      container.nativeElement.innerHTML = `
        <div class="text-center p-6 space-y-4">
          <p class="text-red-400 font-semibold">Failed to render mind map due to syntax constraints.</p>
          <div class="text-left bg-black/40 border border-white/10 rounded-xl p-4 overflow-x-auto max-w-lg mx-auto font-mono text-xs text-zinc-300 whitespace-pre">${code}</div>
          <button onclick="window.dispatchEvent(new CustomEvent('regenerate-mindmap'))" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs transition-colors">Try Regenerating</button>
        </div>
      `;
    }
  }

  async generateQuiz() {
    if (!this.llm.isReady()) {
      this.toast.error('Load the model first!');
      return;
    }
    if (!this.rag.hasContext()) {
      this.toast.error('Please upload documents first.');
      return;
    }

    this.isGenerating.set(true);
    this.activeSubTab.set('quiz');
    this.showQuizResults.set(false);
    this.quizScore.set(0);
    this.currentQuizIndex.set(0);

    if (!this.llm.isReady()) {
      this.toast.error('Load the model first!');
      return;
    }
    const numQuestions = Math.max(1, Math.min(15, Number(this.numQuizQuestions()) || 5));
    const numOpts = Math.max(2, Math.min(6, Number(this.numQuizOptions()) || 4));
    const context = this.rag.getRelevantChunks('important facts', 5, 400);

    const systemPrompt = `You are a strict learning assistant. Generate a multiple-choice quiz with exactly ${numQuestions} questions based on the following context.
    
    CRITICAL REQUIREMENTS:
    1. Each question MUST have exactly ${numOpts} options.
    2. Exactly one option MUST be correct.
    3. The options list must never have fewer or more than ${numOpts} items.
    
    Return ONLY a valid JSON array of objects with the following structure:
    [
      {
        "question": "Question text?",
        "options": [${Array.from({ length: numOpts }, (_, idx) => `"Choice ${String.fromCharCode(65 + idx)}"`).join(', ')}],
        "answer": 0
      }
    ]
    where "answer" is the correct option index (0 to ${numOpts - 1}).
    
    CONTEXT:
    ${context}
    `;

    try {
      const fullPrompt = this.llm.buildPrompt(
        systemPrompt,
        `Generate ${numQuestions} quiz questions.`,
      );
      const result = await this.llm.generate(fullPrompt, () => {});

      const parsedQuestions = this.jsonParser.parseArray<{
        question: string;
        options: string[];
        answer: number;
      }>(result);
      if (!parsedQuestions || parsedQuestions.length === 0) {
        throw new Error('No questions could be parsed from the response.');
      }

      // Enforce exactly numOpts options and exactly 1 correct answer (index 0 to numOpts-1) for all questions
      const normalizedQuestions = parsedQuestions.map((q: any) => {
        const question = q.question || 'No question text provided';

        let options = Array.isArray(q.options) ? q.options.filter(Boolean) : [];
        if (options.length < numOpts) {
          while (options.length < numOpts) {
            options.push(`Option ${String.fromCharCode(65 + options.length)}`);
          }
        } else if (options.length > numOpts) {
          options = options.slice(0, numOpts);
        }

        let answer = typeof q.answer === 'number' ? q.answer : parseInt(q.answer, 10);
        if (isNaN(answer) || answer < 0 || answer >= numOpts) {
          answer = 0;
        }

        return { question, options, answer };
      });

      this.selectedAnswers.set(new Array(normalizedQuestions.length).fill(-1));
      this.quizQuestions.set(normalizedQuestions);
      this.startQuizTimer();
    } catch (err: any) {
      console.error('Quiz generation error:', err);
      this.toast.error('Error generating quiz: ' + err.message);
      this.activeSubTab.set('quiz');
    } finally {
      this.isGenerating.set(false);
    }
  }

  selectAnswer(index: number) {
    this.selectedAnswers.update((arr) => {
      const copy = [...arr];
      copy[this.currentQuizIndex()] = index;
      return copy;
    });
  }

  submitEntireQuiz() {
    this.stopQuizTimer();

    // Calculate score
    let score = 0;
    const questions = this.quizQuestions();
    const selections = this.selectedAnswers();

    for (let i = 0; i < questions.length; i++) {
      if (selections[i] === questions[i].answer) {
        score++;
      }
    }

    this.quizScore.set(score);
    this.showQuizResults.set(true);
  }

  prevQuestion() {
    if (this.currentQuizIndex() > 0) {
      this.currentQuizIndex.update((i) => i - 1);
    }
  }

  nextQuestion() {
    if (this.currentQuizIndex() < this.quizQuestions().length - 1) {
      this.currentQuizIndex.update((i) => i + 1);
    }
  }

  formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  startQuizTimer() {
    this.stopQuizTimer();

    const minutes = Math.max(1, Math.min(60, Number(this.quizTimerDuration()) || 5));
    this.quizSecondsLeft.set(minutes * 60);

    this.timerIntervalId = setInterval(() => {
      this.quizSecondsLeft.update((sec) => {
        if (sec <= 1) {
          this.stopQuizTimer();
          this.submitEntireQuiz();
          this.toast.show("Time's up! Your quiz has been auto-submitted.", 4000);
          return 0;
        }
        return sec - 1;
      });
    }, 1000);
  }

  stopQuizTimer() {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  ngOnDestroy() {
    this.stopQuizTimer();
  }

  decrementQuestions() {
    this.numQuizQuestions.update((n) => Math.max(1, n - 1));
  }

  incrementQuestions() {
    this.numQuizQuestions.update((n) => Math.min(15, n + 1));
  }

  setQuestions(val: any) {
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      this.numQuizQuestions.set(Math.max(1, Math.min(15, num)));
    }
  }

  decrementTimer() {
    this.quizTimerDuration.update((t) => Math.max(1, t - 1));
  }

  incrementTimer() {
    this.quizTimerDuration.update((t) => Math.min(60, t + 1));
  }

  setTimer(val: any) {
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      this.quizTimerDuration.set(Math.max(1, Math.min(60, num)));
    }
  }

  decrementOptions() {
    this.numQuizOptions.update((o) => Math.max(2, o - 1));
  }

  incrementOptions() {
    this.numQuizOptions.update((o) => Math.min(6, o + 1));
  }

  setOptions(val: any) {
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      this.numQuizOptions.set(Math.max(2, Math.min(6, num)));
    }
  }

  flashcardsText = signal('');

  async generateFlashcards() {
    if (!this.rag.hasContext()) {
      this.toast.error('Please upload documents first.');
      return;
    }
    if (!this.llm.isReady()) {
      this.toast.error('Load the model first!');
      return;
    }

    this.isGenerating.set(true);
    this.activeSubTab.set('flashcards');
    const context = this.rag.getRelevantChunks('key concepts definitions terms', 10, 1500);

    const systemPrompt = `Generate 15-20 flashcards (question/answer pairs) from the context. Return ONLY a CSV with columns: front,back. No headers. One card per line. Example:
"What is Angular?","A TypeScript-based web framework by Google"`;

    try {
      const prompt = this.llm.buildPrompt(
        systemPrompt,
        `Context:\n${context}\n\nGenerate flashcards:`,
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
    const header = 'front,back\n';
    this.dom.downloadText(header + lines.join('\n'), 'flashcards.csv');
    this.toast.success('Flashcards downloaded (import into Anki)');
  }

  clearAll() {
    this.messages.set([]);
    this.files.set([]);
    this.rag.clearContext();
    this.quizQuestions.set([]);
    this.selectedAnswers.set([]);
    this.flashcardsText.set('');
    this.stopQuizTimer();
    this.isMindMapPlaceholder = true;
    this.renderMindMap('mindmap\n  root((Learning Context))\n    (Topic 1)\n    (Topic 2)');
  }
}

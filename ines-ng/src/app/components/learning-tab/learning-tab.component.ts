import { Component, signal, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { RagService } from '../../core/services/rag.service';
import { ToastService } from '../../core/services/toast.service';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
});

@Component({
  selector: 'app-learning-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './learning-tab.component.html',
  styleUrl: './learning-tab.css'
})
export class LearningTabComponent implements AfterViewInit {
  llm = inject(LlmService);
  rag = inject(RagService);
  toast = inject(ToastService);

  @ViewChild('mermaidContainer') mermaidContainer!: ElementRef;

  userInput = signal('');
  messages = signal<ChatMessage[]>([]);
  isGenerating = signal(false);
  
  files = signal<File[]>([]);
  isProcessing = signal(false);

  quizQuestions = signal<any[]>([]);
  currentQuizIndex = signal(0);
  quizScore = signal(0);
  showQuizResults = signal(false);
  numQuizQuestions = signal(5);

  activeSubTab = signal<'chat' | 'mindmap' | 'quiz'>('chat');

  ngAfterViewInit() {
    this.renderMindMap('mindmap\n  root((Learning Context))\n    Topic1\n    Topic2');
  }

  async onFileSelected(event: any) {
    const selectedFiles: FileList = event.target.files;
    if (!selectedFiles.length) return;

    this.isProcessing.set(true);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        await this.rag.processFile(file);
        this.files.update(f => [...f, file]);
      }
      this.toast.success('Documents processed and added to context.');
    } catch (err: any) {
      this.toast.error('Error processing files: ' + err.message);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async sendMessage() {
    const text = this.userInput().trim();
    if (!text || this.isGenerating()) return;

    const context = this.rag.getRelevantChunks(text);
    const systemPrompt = `You are a learning assistant. Use the following context to answer the user's question. If the answer is not in the context, use your general knowledge but mention it's not in the documents.
    
    CONTEXT:
    ${context}
    `;

    const userMsg: ChatMessage = { role: 'user', content: text };
    this.messages.update(m => [...m, userMsg]);
    this.userInput.set('');
    this.isGenerating.set(true);

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    this.messages.update(m => [...m, assistantMsg]);

    try {
      const fullPrompt = this.llm.buildPrompt(systemPrompt, text, this.messages().slice(-6, -1));
      await this.llm.generate(fullPrompt, (partial, done, full) => {
        this.messages.update(msgs => {
          const newMsgs = [...msgs];
          newMsgs[newMsgs.length - 1].content = full;
          return newMsgs;
        });
        if (done) this.isGenerating.set(false);
      });
    } catch (err: any) {
      this.toast.error(err.message);
      this.isGenerating.set(false);
    }
  }

  async generateMindMap() {
    if (!this.rag.hasContext()) {
      this.toast.error('Please upload documents first.');
      return;
    }

    this.isGenerating.set(true);
    this.activeSubTab.set('mindmap');

    const systemPrompt = `Generate a Mermaid.js mindmap syntax based on the provided context. 
    Start with "mindmap". Use proper indentation. 
    Return ONLY the mermaid code, no explanation or markdown blocks.
    
    CONTEXT:
    ${this.rag.getRelevantChunks('main topics', 10)}
    `;

    try {
      const fullPrompt = this.llm.buildPrompt(systemPrompt, 'Generate a mindmap of the main concepts.');
      const result = await this.llm.generate(fullPrompt, () => {});
      
      // Clean up result if it contains markdown blocks
      let code = result.replace(/```mermaid/g, '').replace(/```/g, '').trim();
      if (!code.startsWith('mindmap')) {
          code = 'mindmap\n' + code;
      }
      
      this.renderMindMap(code);
    } catch (err: any) {
      this.toast.error('Error generating mind map: ' + err.message);
    } finally {
      this.isGenerating.set(false);
    }
  }

  async renderMindMap(code: string) {
    try {
      const { svg } = await mermaid.render('mermaid-svg-' + Date.now(), code);
      this.mermaidContainer.nativeElement.innerHTML = svg;
    } catch (err) {
      console.error('Mermaid rendering error:', err);
      // Fallback to a simple message if rendering fails
      this.mermaidContainer.nativeElement.innerHTML = '<p class="text-red-500">Failed to render mind map. Please try again.</p>';
    }
  }

  async generateQuiz() {
    if (!this.rag.hasContext()) {
      this.toast.error('Please upload documents first.');
      return;
    }

    this.isGenerating.set(true);
    this.activeSubTab.set('quiz');
    this.showQuizResults.set(false);
    this.quizScore.set(0);
    this.currentQuizIndex.set(0);

    const systemPrompt = `Generate a quiz with ${this.numQuizQuestions()} multiple-choice questions based on the context.
    Return ONLY a valid JSON array of objects with the following structure:
    [{"question": "...", "options": ["A", "B", "C", "D"], "answer": 0}]
    where "answer" is the index of the correct option.
    
    CONTEXT:
    ${this.rag.getRelevantChunks('important facts', 10)}
    `;

    try {
      const fullPrompt = this.llm.buildPrompt(systemPrompt, `Generate ${this.numQuizQuestions()} quiz questions.`);
      const result = await this.llm.generate(fullPrompt, () => {});
      
      // Clean up JSON
      const jsonStr = result.substring(result.indexOf('['), result.lastIndexOf(']') + 1);
      this.quizQuestions.set(JSON.parse(jsonStr));
    } catch (err: any) {
      this.toast.error('Error generating quiz: ' + err.message);
      this.activeSubTab.set('chat');
    } finally {
      this.isGenerating.set(false);
    }
  }

  submitQuizAnswer(index: number) {
    if (index === this.quizQuestions()[this.currentQuizIndex()].answer) {
      this.quizScore.update(s => s + 1);
    }

    if (this.currentQuizIndex() < this.quizQuestions().length - 1) {
      this.currentQuizIndex.update(i => i + 1);
    } else {
      this.showQuizResults.set(true);
    }
  }

  clearAll() {
    this.messages.set([]);
    this.files.set([]);
    this.rag.clearContext();
    this.mermaidContainer.nativeElement.innerHTML = '';
    this.quizQuestions.set([]);
  }
}

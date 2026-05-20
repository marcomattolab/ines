import { Component, signal, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { RagService } from '../../core/services/rag.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
});

@Component({
  selector: 'app-learning-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ButtonComponent, MessageBubbleComponent],
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
  isMindMapPlaceholder = true;
  showMindMapOnRight = signal(false);
  zoomLevel = signal(1.0);

  selectSubTab(tab: 'chat' | 'mindmap' | 'quiz') {
    this.activeSubTab.set(tab);
    if (tab === 'mindmap' && this.isMindMapPlaceholder && this.rag.hasContext() && !this.isGenerating()) {
      this.generateMindMap();
    }
  }

  toggleDockMindMap() {
    this.showMindMapOnRight.update(d => !d);
    if (this.showMindMapOnRight() && this.isMindMapPlaceholder && this.rag.hasContext() && !this.isGenerating()) {
      this.generateMindMap();
    }
  }

  zoomIn() {
    this.zoomLevel.update(z => Math.min(2.5, z + 0.15));
  }

  zoomOut() {
    this.zoomLevel.update(z => Math.max(0.4, z - 0.15));
  }

  zoomReset() {
    this.zoomLevel.set(1.0);
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
        this.files.update(f => [...f, file]);
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
    const processedLines: string[] = [];
    let foundMindmap = false;
    let rootNodeParsed = false;

    for (let line of lines) {
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      let content = line.trim();

      if (!content) continue;

      // Handle mindmap header
      if (content.toLowerCase() === 'mindmap') {
        processedLines.push('mindmap');
        foundMindmap = true;
        continue;
      }

      if (!foundMindmap) continue;

      // If we encounter a completely unindented line after parsing the root node,
      // it is likely conversational suffix text, so we stop parsing.
      if (indent.length === 0 && rootNodeParsed) {
        break;
      }

      // Remove leading bullet points (like -, *, +, or numbers like 1.)
      content = content.replace(/^[-*+]\s+/, '');
      content = content.replace(/^\d+\.\s+/, '');
      content = content.trim();

      if (!content) continue;

      // Check if the node is already wrapped in shapes or quotes
      const isWrapped = 
        (content.startsWith('(') && content.endsWith(')')) ||
        (content.startsWith('[') && content.endsWith(']')) ||
        (content.startsWith('{') && content.endsWith('}')) ||
        (content.startsWith('"') && content.endsWith('"')) ||
        /^[a-zA-Z0-9_-]+\s*\(.*\)$/.test(content) ||
        /^[a-zA-Z0-9_-]+\s*\[.*\]$/.test(content) ||
        /^[a-zA-Z0-9_-]+\s*\{.*\}$/.test(content);

      if (!isWrapped) {
        // Wrap content in parenthesis to handle spaces/special characters
        content = `(${content})`;
      }

      processedLines.push(indent + content);
      rootNodeParsed = true;
    }

    // Ensure it starts with mindmap
    if (processedLines.length > 0 && processedLines[0] !== 'mindmap') {
      processedLines.unshift('mindmap');
    }

    return processedLines.join('\n');
  }

  async generateMindMap() {
    if (!this.rag.hasContext()) {
      this.toast.error('Please upload documents first.');
      return;
    }

    this.isGenerating.set(true);
    this.activeSubTab.set('mindmap');

    const systemPrompt = `You are a mindmap generator. Based on the context provided, generate a Mermaid.js mindmap outlining the key concepts and their sub-topics.
    
    CRITICAL RULES:
    1. Start directly with the word "mindmap" on the first line.
    2. Use spaces for indentation to define hierarchy.
    3. Every node text containing spaces or special characters MUST be wrapped in parentheses, e.g. (My Node Title).
    4. Do NOT output any bullet points (like -, *, +), numbered lists (like 1., 2.), or explanations. Output ONLY valid Mermaid.js mindmap syntax.
    
    Example format:
    mindmap
      root((Main Topic))
        (Sub-topic A)
          (Detail A1)
          (Detail A2)
        (Sub-topic B)
          (Detail B1)

    Context:
    ${this.rag.getRelevantChunks('main topics and key concepts', 10)}
    `;

    try {
      const fullPrompt = this.llm.buildPrompt(systemPrompt, 'Generate a mindmap of the main concepts.');
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

  async renderMindMap(code: string) {
    try {
      const { svg } = await mermaid.render('mermaid-svg-' + Date.now(), code);
      this.mermaidContainer.nativeElement.innerHTML = svg;
    } catch (err) {
      console.error('Mermaid rendering error:', err);
      console.error('Offending Mermaid code was:\n', code);
      // Fallback to a simple message if rendering fails
      this.mermaidContainer.nativeElement.innerHTML = `
        <div class="text-center p-6 space-y-4">
          <p class="text-red-400 font-semibold">Failed to render mind map due to syntax constraints.</p>
          <div class="text-left bg-black/40 border border-white/10 rounded-xl p-4 overflow-x-auto max-w-lg mx-auto font-mono text-xs text-zinc-300 whitespace-pre">${code}</div>
          <button onclick="window.dispatchEvent(new CustomEvent('regenerate-mindmap'))" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs transition-colors">Try Regenerating</button>
        </div>
      `;
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
    this.quizQuestions.set([]);
    this.isMindMapPlaceholder = true;
    this.renderMindMap('mindmap\n  root((Learning Context))\n    (Topic 1)\n    (Topic 2)');
  }
}

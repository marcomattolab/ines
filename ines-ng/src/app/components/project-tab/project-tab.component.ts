import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { ProjectService } from '../../core/services/project.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';

@Component({
  selector: 'app-project-tab',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, MatIconModule, MessageBubbleComponent, TypingIndicatorComponent],
  templateUrl: './project-tab.component.html',
  styleUrl: './project-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class ProjectTabComponent implements OnInit {
  llm = inject(LlmService);
  project = inject(ProjectService);
  toast = inject(ToastService);

  activeSubTab = signal<'input' | 'output'>('input');
  userInput = signal('');
  messages = signal<ChatMessage[]>([]);
  msgSources = signal<string[]>([]);
  isGenerating = signal(false);

  searchQuery = signal('');
  totalChunks = signal(0);

  filteredDocs = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.project.documents();
    return this.project.documents().filter((d) => d.name.toLowerCase().includes(q));
  });

  async ngOnInit() {
    await this.project.loadDocuments();
    this.totalChunks.set(await this.project.countChunks());
  }

  async onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files.length) return;

    for (let i = 0; i < files.length; i++) {
      try {
        await this.project.processFile(files[i]);
        this.toast.success(`"${files[i].name}" added to project memory`);
      } catch (err: any) {
        if (err.message?.includes('Duplicate')) {
          this.toast.show(err.message);
        } else {
          this.toast.error(`Error processing "${files[i].name}": ${err.message}`);
        }
      }
    }

    await this.project.loadDocuments();
    this.totalChunks.set(await this.project.countChunks());
    event.target.value = '';
  }

  async deleteDoc(event: MouseEvent, id: string) {
    event.stopPropagation();
    await this.project.deleteDocument(id);
    await this.project.loadDocuments();
    this.totalChunks.set(await this.project.countChunks());
    this.toast.show('Document removed from project memory');
  }

  async clearAll() {
    if (this.project.documents().length === 0) return;
    await this.project.clearAll();
    this.messages.set([]);
    this.msgSources.set([]);
    this.totalChunks.set(0);
    this.toast.show('Project memory cleared');
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  async sendMessage() {
    const text = this.userInput().trim();
    if (!text || this.isGenerating() || !this.llm.isReady()) return;
    if (this.llm.isBusy()) {
      this.toast.show('Model is still working on a previous request. Please wait.');
      return;
    }

    this.isGenerating.set(true);
    this.msgSources.set([]);

    const userMsg: ChatMessage = { role: 'user', content: text };
    this.messages.update((m) => [...m, userMsg]);
    this.userInput.set('');

    try {
      const chunks = await this.project.getRelevantChunks(text, 3, 300);
      const sourceNames = [...new Set(chunks.map((c) => c.docName))];
      this.msgSources.set(sourceNames);

      const context = chunks.length > 0 ? chunks.map((c) => c.text).join('\n\n---\n\n') : '';

      const systemPrompt = `You are an expert technical project assistant with access to project documentation. Answer questions based on the provided context. If the context includes commands, code, links, or procedures, reference them precisely. Use Markdown for formatting. Be concise and helpful.

${context ? `Relevant project context:\n${context}` : 'No relevant project documents found — answer from your own knowledge.'}`;

      const trimmed = this.llm.trimConversation(
        systemPrompt,
        text,
        this.messages().slice(-4, -1),
        448,
        64,
      );
      const fullPrompt = this.llm.buildPrompt(systemPrompt, text, trimmed);

      const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
      this.messages.update((m) => [...m, assistantMsg]);

      await this.llm.generate(fullPrompt, (partial, done, full) => {
        this.messages.update((msgs) => {
          const newMsgs = [...msgs];
          newMsgs[newMsgs.length - 1].content = full;
          return newMsgs;
        });
        if (done) {
          this.isGenerating.set(false);
        }
      });
    } catch (err: any) {
      this.toast.error(
        err.message?.includes('INVALID_ARGUMENT')
          ? 'Conversation too long. Try clearing older messages.'
          : err.message,
      );
      this.isGenerating.set(false);
    }
  }
}

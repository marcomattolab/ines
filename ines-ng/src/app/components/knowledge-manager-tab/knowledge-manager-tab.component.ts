import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { KnowledgeManagerService } from '../../core/services/knowledge-manager.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';

interface ChunkRef {
  text: string;
  docName: string;
}

@Component({
  selector: 'app-knowledge-manager-tab',
  standalone: true,
  imports: [DatePipe, FormsModule, MatIconModule, MessageBubbleComponent, TypingIndicatorComponent],
  templateUrl: './knowledge-manager-tab.component.html',
  styleUrl: './knowledge-manager-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class KnowledgeManagerTabComponent implements OnInit {
  llm = inject(LlmService);
  km = inject(KnowledgeManagerService);
  toast = inject(ToastService);

  activeSubTab = signal<'chat' | 'saved'>('chat');
  userInput = signal('');
  messages = signal<ChatMessage[]>([]);
  msgSources = signal<string[]>([]);
  isGenerating = signal(false);

  lastChunks = signal<ChunkRef[]>([]);
  previewChunks = signal<{ text: string; position: number }[]>([]);
  previewDocName = signal('');
  showPreview = signal(false);

  searchQuery = signal('');
  selectedDocId = signal<string | null>(null);
  savedQAs = signal<KnowledgeQA[]>([]);

  totalChunks = signal(0);

  filteredDocs = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.km.documents();
    return this.km.documents().filter((d) => d.name.toLowerCase().includes(q));
  });

  async ngOnInit() {
    await this.km.loadDocuments();
    this.totalChunks.set(await this.km.countChunks());
    this.savedQAs.set(await this.km.getQAs());
  }

  selectDoc(id: string) {
    this.selectedDocId.update((current) => (current === id ? null : id));
  }

  async deleteDoc(event: MouseEvent, id: string) {
    event.stopPropagation();
    await this.km.deleteDocument(id);
    await this.km.loadDocuments();
    this.totalChunks.set(await this.km.countChunks());
    this.toast.show('Document removed from knowledge base');
  }

  async onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files.length) return;

    for (let i = 0; i < files.length; i++) {
      try {
        await this.km.processFile(files[i]);
        this.toast.success(`"${files[i].name}" added to knowledge base`);
      } catch (err: any) {
        if (err.message?.includes('Duplicate')) {
          this.toast.show(err.message);
        } else {
          this.toast.error(`Error processing "${files[i].name}": ${err.message}`);
        }
      }
    }

    await this.km.loadDocuments();
    this.totalChunks.set(await this.km.countChunks());
    event.target.value = '';
  }

  async onImportFile(event: any) {
    const file: File = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await this.km.importKnowledgeBase(file);
      this.savedQAs.set(await this.km.getQAs());
      this.totalChunks.set(await this.km.countChunks());
      this.toast.success(
        `Import complete: ${result.docsAdded} docs, ${result.chunksAdded} chunks, ` +
          `${result.qasAdded} Q&As added` +
          (result.duplicates > 0 ? `, ${result.duplicates} duplicates skipped` : ''),
      );
    } catch (err: any) {
      this.toast.error('Import failed: ' + err.message);
    }
    event.target.value = '';
  }

  async exportKB() {
    try {
      const blob = await this.km.exportKnowledgeBase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ines-knowledge-${new Date().toISOString().slice(0, 10)}.ines-knowledge`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.toast.success('Knowledge base exported');
    } catch (err: any) {
      this.toast.error('Export failed: ' + err.message);
    }
  }

  async clearAll() {
    if (this.km.documents().length === 0) return;
    await this.km.clearAll();
    this.messages.set([]);
    this.msgSources.set([]);
    this.savedQAs.set([]);
    this.totalChunks.set(0);
    this.toast.show('Knowledge base cleared');
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
      const chunks = await this.km.getRelevantChunks(text, 2, 260);
      this.lastChunks.set(chunks);
      const sourceNames = [...new Set(chunks.map((c) => c.docName))];
      this.msgSources.set(sourceNames);

      const context = chunks.length > 0 ? chunks.map((c) => c.text).join('\n\n---\n\n') : '';

      const systemPrompt = `You are an expert technical assistant with access to document snippets. Answer questions clearly and thoroughly: explain the concept, give concrete examples, and always mention the source document name. If the context includes a command, show it in a code block. Use Markdown formatting for readability.

${context ? `Context from documents:\n${context}` : 'No relevant documents found — answer from your own knowledge.'}`;

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
          this.offerSaveQA(text, full, sourceNames);
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

  private async offerSaveQA(question: string, answer: string, sources: string[]) {
    if (!answer.trim()) return;
    const sourceObjs = sources.map((docName) => ({ docName, text: '' }));
    await this.km.saveQA(question, answer, sourceObjs);
    this.savedQAs.set(await this.km.getQAs());
    this.toast.show('Q&A saved to knowledge base');
  }

  async deleteQA(id: string) {
    await this.km.deleteQA(id);
    this.savedQAs.set(await this.km.getQAs());
  }

  async showSourcePreview(docName: string) {
    this.previewDocName.set(docName);
    const chunks = await this.km.getChunksByDocName(docName);
    this.previewChunks.set(chunks);
    this.showPreview.set(true);
  }

  closePreview() {
    this.showPreview.set(false);
  }
}

interface KnowledgeQA {
  id: string;
  question: string;
  answer: string;
  sources: { docName: string; text: string }[];
  date: number;
}

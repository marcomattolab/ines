import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { ProjectService, ProjectChunk, ProjectDocument } from '../../core/services/project.service';
import { DomUtilsService } from '../../core/services/dom-utils.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

const SYSTEM_PROJECT = `You are an expert Technical Project Assistant with access to the user's project documentation. Your role is to help analyze, understand, and answer questions about the project based on the provided context.

═══════════════════════════════
HOW TO ANSWER
═══════════════════════════════
- Base your answers on the PROJECT CONTEXT provided below.
- When the context contains commands, code, links, or procedures, reference them VERBATIM.
- If context has file paths, command-line examples, or configuration — quote them exactly.
- When multiple documents are relevant, synthesize insights across them.
- Use Markdown for formatting: code blocks for commands/code, bullet lists for steps.
- Be concise — provide direct, actionable answers.

═══════════════════════════════
WHEN CONTEXT IS INSUFFICIENT
═══════════════════════════════
- If the context doesn't contain the answer, say so clearly.
- Suggest what kind of documents would help (README, package.json, config files, etc.).
- You may use your own knowledge for general programming questions.

═══════════════════════════════
PROJECT CONTEXT
═══════════════════════════════
{CONTEXT}`;

@Component({
  selector: 'app-project-tab',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatIconModule,
    MessageBubbleComponent,
    TypingIndicatorComponent,
    ButtonComponent,
  ],
  templateUrl: './project-tab.component.html',
  styleUrl: './project-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class ProjectTabComponent implements OnInit {
  readonly llm = inject(LlmService);
  readonly project = inject(ProjectService);
  readonly toast = inject(ToastService);
  private readonly dom = inject(DomUtilsService);

  activeSubTab = signal<'input' | 'output'>('input');
  userInput = signal('');
  messages = signal<ChatMessage[]>([]);
  msgSources = signal<string[]>([]);
  isGenerating = signal(false);

  searchQuery = signal('');
  totalChunks = signal(0);

  showPreview = signal(false);
  previewDocName = signal('');
  previewChunks = signal<ProjectChunk[]>([]);
  selectedDocId = signal<string | null>(null);

  readonly suggestionChips = [
    'Summarize the project architecture',
    'What are the main dependencies?',
    'How do I run this project?',
    'Explain the deployment flow',
    'What APIs or endpoints are used?',
    'Key configuration settings',
  ];

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
    if (this.selectedDocId() === id) {
      this.selectedDocId.set(null);
      this.showPreview.set(false);
    }
    this.toast.show('Document removed from project memory');
  }

  async selectDoc(doc: ProjectDocument) {
    this.selectedDocId.set(doc.id);
    try {
      const chunks = await this.project.getChunksForDocument(doc.id);
      this.previewDocName.set(doc.name);
      this.previewChunks.set(chunks);
      this.showPreview.set(true);
    } catch {
      this.toast.error('Could not load document preview');
    }
  }

  closePreview() {
    this.showPreview.set(false);
    this.selectedDocId.set(null);
  }

  async onExport() {
    if (this.project.documents().length === 0) return;
    try {
      const blob = await this.project.exportProject();
      this.dom.downloadBlob(blob, 'project.ines-project');
      this.toast.success('Project exported');
    } catch (err: any) {
      this.toast.error('Export failed: ' + err.message);
    }
  }

  async onImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await this.project.importProject(file);
      await this.project.loadDocuments();
      this.totalChunks.set(await this.project.countChunks());
      this.toast.success('Project imported successfully');
    } catch (err: any) {
      this.toast.error('Import failed: ' + err.message);
    }
    input.value = '';
  }

  useSuggestion(chip: string) {
    this.userInput.set(chip);
    this.sendMessage();
  }

  fileIcon(type: string): string {
    switch (type) {
      case 'md':
        return 'code';
      case 'pdf':
        return 'picture_as_pdf';
      case 'html':
      case 'htm':
        return 'language';
      case 'txt':
        return 'text_snippet';
      default:
        return 'insert_drive_file';
    }
  }

  fileColor(type: string): string {
    switch (type) {
      case 'md':
        return 'var(--accent-blue)';
      case 'pdf':
        return 'var(--accent-rose)';
      case 'html':
      case 'htm':
        return 'var(--accent-amber)';
      case 'txt':
        return 'var(--accent-green)';
      default:
        return 'var(--accent-cyan)';
    }
  }

  clearChat() {
    this.messages.set([]);
    this.msgSources.set([]);
    this.toast.show('Chat cleared');
  }

  async clearAll() {
    if (this.project.documents().length === 0) return;
    await this.project.clearAll();
    this.messages.set([]);
    this.msgSources.set([]);
    this.totalChunks.set(0);
    this.selectedDocId.set(null);
    this.showPreview.set(false);
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

      const context =
        chunks.length > 0 ? chunks.map((c) => `[${c.docName}]\n${c.text}`).join('\n\n---\n\n') : '';

      const systemPrompt = SYSTEM_PROJECT.replace(
        '{CONTEXT}',
        context || 'No relevant project documents found — answer from your own knowledge.',
      );

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

      await this.llm.generate(fullPrompt, (_, done, full) => {
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

  async previewDocFromSource(sourceName: string) {
    const doc = this.project.documents().find((d) => d.name === sourceName);
    if (doc) {
      await this.selectDoc(doc);
    }
  }

  previewDocIconColor(): string {
    const doc = this.project.documents().find((d) => d.name === this.previewDocName());
    return doc ? this.fileColor(doc.type) : 'var(--text-2)';
  }
}

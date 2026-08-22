import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  viewChild,
  AfterViewChecked,
  OnInit,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AgentService, Agent, Skill } from '../../core/services/agent.service';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { DomUtilsService } from '../../core/services/dom-utils.service';
import { KnowledgeManagerService } from '../../core/services/knowledge-manager.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormsModule } from '@angular/forms';
import { ChatInputDirective } from '../../shared/chat-input.directive';

interface UiMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
  streaming?: boolean;
  sources?: string[];
}

interface KnowledgeQA {
  id: string;
  question: string;
  answer: string;
  sources: { docName: string; text: string }[];
  date: number;
}

@Component({
  selector: 'app-agents-tab',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatIconModule,
    ButtonComponent,
    MessageBubbleComponent,
    TypingIndicatorComponent,
    ConfirmDialogComponent,
    FormsModule,
    ChatInputDirective,
  ],
  templateUrl: './agents-tab.component.html',
  styleUrl: './agents-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class AgentsTabComponent implements AfterViewChecked, OnInit {
  readonly agentSvc = inject(AgentService);
  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  private readonly dom = inject(DomUtilsService);
  readonly km = inject(KnowledgeManagerService);

  selectedAgent = signal<Agent | null>(this.agentSvc.agents()[0] || null);
  activeMode = signal<'chat' | 'edit' | 'kb'>('chat');
  editingSkill = signal<Skill | null>(null);

  // Chat state
  messages = signal<UiMessage[]>([]);
  generating = signal(false);
  typing = signal(false);
  private history: ChatMessage[] = [];
  private nextId = 1;
  private shouldScroll = false;

  readonly chatArea = viewChild<ElementRef<HTMLDivElement>>('chatArea');
  readonly inputEl = viewChild<ElementRef<HTMLTextAreaElement>>('inputEl');

  // Knowledge base state
  totalChunks = signal(0);
  searchQuery = signal('');
  selectedDocId = signal<string | null>(null);
  showPreview = signal(false);
  previewDocName = signal('');
  previewChunks = signal<{ text: string; position: number }[]>([]);
  showClearConfirm = signal(false);
  deleteAgentId = signal<string | null>(null);
  deleteSkillId = signal<string | null>(null);

  async ngOnInit() {
    await this.km.loadDocuments();
    this.totalChunks.set(await this.km.countChunks());
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      const el = this.chatArea()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  // ── Agent management ──

  selectAgent(agent: Agent) {
    this.selectedAgent.set(agent);
    this.clearChat();
  }

  exportAgent(agent: Agent) {
    const data = JSON.stringify(agent, null, 2);
    this.dom.downloadText(data, `${agent.name.toLowerCase().replace(/\s+/g, '-')}.ines-agent.json`);
    this.toast.success('Agent exported');
  }

  async importAgent(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const agent = JSON.parse(text) as Agent;
      if (!agent.name || !agent.systemPrompt) throw new Error('Invalid agent file');
      const newAgent = this.agentSvc.addAgent({
        name: agent.name + ' (imported)',
        description: agent.description || '',
        systemPrompt: agent.systemPrompt,
        skillIds: agent.skillIds || [],
      });
      this.selectedAgent.set(newAgent);
      this.toast.success('Agent imported');
    } catch {
      this.toast.error('Invalid agent file');
    }
    input.value = '';
  }

  clearChat() {
    this.messages.set([]);
    this.history = [];
    this.nextId = 1;
  }

  // ── Chat ──

  async send() {
    const agent = this.selectedAgent();
    if (!agent || this.generating()) return;

    const text = this.inputEl()?.nativeElement.value.trim();
    if (!text) return;

    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }

    this.generating.set(true);
    if (this.inputEl()) {
      this.inputEl()!.nativeElement.value = '';
      this.inputEl()!.nativeElement.style.height = '';
    }

    this.history.push({ role: 'user', content: text });
    this.messages.update((m) => [...m, { id: this.nextId++, role: 'user', text }]);
    this.typing.set(true);
    this.shouldScroll = true;

    let systemPrompt = this.agentSvc.getAgentFullPrompt(agent);
    let sourceNames: string[] = [];

    // RAG: add knowledge base context if available
    if (this.totalChunks() > 0) {
      try {
        const chunks = await this.km.getRelevantChunks(text, 3, 300);
        if (chunks.length > 0) {
          sourceNames = [...new Set(chunks.map((c) => c.docName))];
          const context = chunks.map((c) => `[${c.docName}]\n${c.text}`).join('\n\n---\n\n');
          systemPrompt = `You are an expert assistant with access to a personal knowledge base. Use the provided context from uploaded documents to answer the question. If the context doesn't contain the answer, use your own knowledge but mention that it's not from the documents. Always cite the source document name when referencing context.

Context from knowledge base documents:
${context}

---

${systemPrompt}`;
        }
      } catch {
        /* proceed without RAG context */
      }
    }

    const trimmed = this.llm.trimConversation(systemPrompt, text, this.history.slice(-6, -1));
    const prompt = this.llm.buildPrompt(systemPrompt, text, trimmed);
    const aiId = this.nextId++;

    try {
      let full = '';
      await this.llm.generate(prompt, (_, done, fullText) => {
        full = fullText;
        if (this.typing()) {
          this.typing.set(false);
          this.messages.update((m) => [
            ...m,
            { id: aiId, role: 'ai', text: fullText, streaming: true, sources: sourceNames },
          ]);
        } else {
          this.messages.update((m) =>
            m.map((msg) =>
              msg.id === aiId
                ? { ...msg, text: fullText, streaming: !done, sources: sourceNames }
                : msg,
            ),
          );
        }
        this.shouldScroll = true;
      });
      this.history.push({ role: 'assistant', content: full });
    } catch (e: any) {
      this.typing.set(false);
      this.messages.update((m) => [
        ...m,
        {
          id: this.nextId++,
          role: 'ai',
          text: e.message?.includes('INVALID_ARGUMENT') ? 'Conversation too long.' : e.message,
        },
      ]);
    }
    this.generating.set(false);
  }

  // ── Knowledge Base ──

  readonly filteredDocs = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.km.documents();
    return this.km.documents().filter((d) => d.name.toLowerCase().includes(q));
  });

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
      this.dom.downloadBlob(
        blob,
        `ines-knowledge-${new Date().toISOString().slice(0, 10)}.ines-knowledge`,
      );
      this.toast.success('Knowledge base exported');
    } catch (err: any) {
      this.toast.error('Export failed: ' + err.message);
    }
  }

  async clearAll() {
    if (this.km.documents().length === 0) return;
    await this.km.clearAll();
    this.messages.set([]);
    this.totalChunks.set(0);
    this.selectedDocId.set(null);
    this.showPreview.set(false);
    this.toast.show('Knowledge base cleared');
  }

  selectDoc(id: string) {
    if (this.selectedDocId() === id) {
      this.selectedDocId.set(null);
      this.showPreview.set(false);
      return;
    }
    this.selectedDocId.set(id);
    const doc = this.km.documents().find((d) => d.id === id);
    if (doc) this.showSourcePreview(doc.name);
  }

  async deleteDoc(event: MouseEvent, id: string) {
    event.stopPropagation();
    await this.km.deleteDocument(id);
    await this.km.loadDocuments();
    this.totalChunks.set(await this.km.countChunks());
    this.toast.show('Document removed from knowledge base');
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

  // ── Edit Mode Logic ──

  isSkillSelected(skillId: string): boolean {
    return this.selectedAgent()?.skillIds.includes(skillId) ?? false;
  }

  toggleSkill(skillId: string) {
    const agent = this.selectedAgent();
    if (!agent) return;

    const skillIds = agent.skillIds.includes(skillId)
      ? agent.skillIds.filter((id) => id !== skillId)
      : [...agent.skillIds, skillId];

    const updated = { ...agent, skillIds };
    this.agentSvc.updateAgent(updated);
    this.selectedAgent.set(updated);
  }

  saveAgent(agent: Agent) {
    this.agentSvc.updateAgent(agent);
    this.toast.success('Agent updated');
  }

  addNewAgent() {
    const newAgent = this.agentSvc.addAgent({
      name: 'New Agent',
      description: 'Description of the agent',
      systemPrompt: 'You are a helpful assistant.',
      skillIds: [],
    });
    this.selectedAgent.set(newAgent);
    this.activeMode.set('edit');
  }

  deleteAgent(id: string) {
    this.deleteAgentId.set(id);
  }

  confirmDeleteAgent() {
    const id = this.deleteAgentId();
    if (id) {
      this.agentSvc.deleteAgent(id);
      this.selectedAgent.set(this.agentSvc.agents()[0] || null);
    }
    this.deleteAgentId.set(null);
  }

  // ── Skill Editor logic ──

  addNewSkill() {
    this.editingSkill.set({
      id: '',
      name: 'New Skill',
      description: 'Skill description',
      instructions: 'How the agent should behave with this skill.',
    });
  }

  editSkill(skill: Skill) {
    this.editingSkill.set({ ...skill });
  }

  saveSkill(skill: Skill) {
    if (skill.id) {
      this.agentSvc.updateSkill(skill);
    } else {
      this.agentSvc.addSkill(skill);
    }
    this.editingSkill.set(null);
    this.toast.success('Skill saved');
  }

  cancelEditSkill() {
    this.editingSkill.set(null);
  }

  deleteSkill(id: string) {
    this.deleteSkillId.set(id);
  }

  confirmDeleteSkill() {
    const id = this.deleteSkillId();
    if (id) {
      this.agentSvc.deleteSkill(id);
      this.toast.show('Skill deleted');
    }
    this.deleteSkillId.set(null);
  }

  html(text: string) {
    return this.dom.escapeHtml(text);
  }
}

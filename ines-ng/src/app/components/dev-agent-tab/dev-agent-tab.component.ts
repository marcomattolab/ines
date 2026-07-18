import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  viewChild,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LlmService, ChatMessage } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { AgentService, Agent } from '../../core/services/agent.service';
import { ProjectService } from '../../core/services/project.service';
import { DomUtilsService } from '../../core/services/dom-utils.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

interface UiMessage {
  id: number;
  role: 'user' | 'ai';
  text: string;
  streaming?: boolean;
}

interface RepoFile {
  name: string;
  path: string;
  size: number;
  type: string;
}

const SYSTEM_DEV_AGENT = `You are a Dev Agent — an expert software engineer working on the user's local repository.
You have access to the project files and can analyze, explain, and modify code.

═══════════════════════════════
CAPABILITIES
═══════════════════════════════
- Read and analyze code from the provided project context
- Explain architecture, patterns, and logic
- Suggest improvements, refactors, and bug fixes
- Write or modify code following the project's existing conventions
- Answer questions about dependencies, config, and tooling

═══════════════════════════════
PROJECT CONTEXT
═══════════════════════════════
{CONTEXT}

═══════════════════════════════
RULES
═══════════════════════════════
- Base answers on the project context above when relevant
- Quote file paths and code verbatim from the context
- When context is missing, say so and suggest what to add
- Output code in markdown code blocks with file name comments
- Match the project's existing code style and conventions
- Be concise and actionable`;

@Component({
  selector: 'app-dev-agent-tab',
  standalone: true,
  imports: [
    FormsModule,
    MatIconModule,
    MessageBubbleComponent,
    TypingIndicatorComponent,
    ButtonComponent,
  ],
  templateUrl: './dev-agent-tab.component.html',
  styleUrl: './dev-agent-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class DevAgentTabComponent implements OnInit, OnDestroy {
  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  readonly agentSvc = inject(AgentService);
  readonly project = inject(ProjectService);
  private readonly dom = inject(DomUtilsService);

  readonly chatArea = viewChild<ElementRef<HTMLDivElement>>('chatArea');
  readonly inputEl = viewChild<ElementRef<HTMLTextAreaElement>>('inputEl');
  readonly dirInput = viewChild<ElementRef<HTMLInputElement>>('dirInput');

  selectedAgent = signal<Agent | null>(null);
  repoFiles = signal<RepoFile[]>([]);
  repoName = signal('');
  isLoadingDir = signal(false);
  totalChunks = signal(0);

  userInput = signal('');
  messages = signal<UiMessage[]>([]);
  generating = signal(false);
  typing = signal(false);
  msgSources = signal<string[]>([]);

  showFileTree = signal(true);
  rightPanelWidth = signal(Math.min(480, window.innerWidth * 0.42));
  expandedFolders = signal<Set<string>>(new Set());

  private history: ChatMessage[] = [];
  private nextId = 1;
  private shouldScroll = false;
  showScrollBtn = signal(false);

  readonly suggestionChips = [
    'Summarize the project architecture',
    'What dependencies does this project use?',
    'Explain how to run this project',
    'Find potential bugs or improvements',
    'How is authentication handled?',
    'Explain the main entry point',
  ];

  readonly folderTree = computed(() => {
    const files = this.repoFiles();
    const root: Record<string, any> = {};

    for (const f of files) {
      const parts = f.path.split('/').filter(Boolean);
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      const name = parts[parts.length - 1];
      current[name] = { _file: f };
    }

    return root;
  });

  private readonly fileExtensions = new Set([
    'ts',
    'js',
    'jsx',
    'tsx',
    'html',
    'css',
    'scss',
    'less',
    'json',
    'md',
    'txt',
    'yml',
    'yaml',
    'toml',
    'xml',
    'svg',
    'py',
    'rb',
    'go',
    'rs',
    'java',
    'kt',
    'swift',
    'c',
    'cpp',
    'h',
    'sh',
    'bash',
    'zsh',
    'fish',
    'ps1',
    'bat',
    'cmd',
    'gitignore',
    'gitattributes',
    'env',
    'editorconfig',
    'prettierrc',
    'eslintrc',
    'dockerfile',
    'makefile',
    'nginx',
  ]);

  ngOnInit() {
    const stored = localStorage.getItem('ines_dev_agent');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.repoName) this.repoName.set(parsed.repoName);
        if (parsed.repoFiles) this.repoFiles.set(parsed.repoFiles);
        if (parsed.agentId) {
          const agent = this.agentSvc.agents().find((a) => a.id === parsed.agentId);
          if (agent) this.selectedAgent.set(agent);
        }
      } catch {
        localStorage.removeItem('ines_dev_agent');
      }
    }
  }

  private persistState() {
    try {
      localStorage.setItem(
        'ines_dev_agent',
        JSON.stringify({
          repoName: this.repoName(),
          repoFiles: this.repoFiles(),
          agentId: this.selectedAgent()?.id,
        }),
      );
    } catch {
      /* quota */
    }
  }

  selectAgent(agent: Agent) {
    this.selectedAgent.set(agent);
    this.clearChat();
    this.persistState();
  }

  openDirPicker() {
    this.dirInput()?.nativeElement.click();
  }

  async onDirSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    this.isLoadingDir.set(true);
    this.repoFiles.set([]);
    this.repoName.set('');

    const fileList: RepoFile[] = [];
    const processQueue: File[] = [];
    let dirName = '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = file.webkitRelativePath || file.name;
      const parts = relativePath.split('/');
      if (!dirName && parts.length > 0) dirName = parts[0];

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      fileList.push({
        name: file.name,
        path: relativePath,
        size: file.size,
        type: ext,
      });

      if (this.fileExtensions.has(ext) && file.size < 1024 * 1024) {
        processQueue.push(file);
      }
    }

    this.repoFiles.set(fileList);
    this.repoName.set(dirName || 'repository');
    this.persistState();

    if (processQueue.length > 0) {
      this.toast.show(`Indexing ${processQueue.length} files...`);
      for (const file of processQueue) {
        try {
          await this.project.processFile(file);
        } catch {
          /* duplicate — skip */
        }
      }
      await this.project.loadDocuments();
      this.totalChunks.set(await this.project.countChunks());
      this.toast.show(`Indexed ${fileList.length} files (${processQueue.length} processed)`);
    } else {
      this.totalChunks.set(0);
    }

    this.isLoadingDir.set(false);
    input.value = '';
  }

  clearRepo() {
    this.project.clearAll();
    this.repoFiles.set([]);
    this.repoName.set('');
    this.totalChunks.set(0);
    this.clearChat();
    this.persistState();
  }

  async loadDocuments() {
    await this.project.loadDocuments();
    this.totalChunks.set(await this.project.countChunks());
  }

  toggleFolder(path: string) {
    this.expandedFolders.update((set) => {
      const next = new Set(set);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  isFolder(node: any): boolean {
    return node && !node._file;
  }

  getFolderKeys(node: any): string[] {
    return Object.keys(node).filter((k) => !k.startsWith('_'));
  }

  fileIcon(type: string): string {
    const map: Record<string, string> = {
      ts: 'description',
      tsx: 'description',
      js: 'javascript',
      jsx: 'javascript',
      html: 'code',
      css: 'palette',
      scss: 'palette',
      json: 'data_object',
      md: 'article',
      txt: 'text_snippet',
      yml: 'settings',
      yaml: 'settings',
      toml: 'settings',
      py: 'terminal',
      rb: 'terminal',
      go: 'terminal',
      rs: 'terminal',
      java: 'terminal',
      kt: 'terminal',
      swift: 'terminal',
      c: 'terminal',
      cpp: 'terminal',
      h: 'terminal',
      sh: 'terminal',
      bash: 'terminal',
      svg: 'image',
      png: 'image',
      jpg: 'image',
      gif: 'image',
      gitignore: 'remove_red_eye',
      gitattributes: 'remove_red_eye',
      env: 'vpn_key',
      lock: 'lock',
      dockerfile: 'deployed_code',
      makefile: 'build',
    };
    return map[type] || 'insert_drive_file';
  }

  fileColor(type: string): string {
    const map: Record<string, string> = {
      ts: '#3178c6',
      tsx: '#3178c6',
      js: '#f7df1e',
      jsx: '#61dafb',
      html: '#e34f26',
      css: '#1572b6',
      scss: '#c6538c',
      json: '#f5a623',
      md: '#82b7ff',
      txt: '#94a5c2',
      yml: '#8b5cf6',
      yaml: '#8b5cf6',
      toml: '#8b5cf6',
      py: '#3572a5',
      rb: '#701516',
      go: '#00add8',
      rs: '#dea584',
      java: '#b07219',
      kt: '#a97bff',
      swift: '#f05138',
      sh: '#4eaa25',
      bash: '#4eaa25',
    };
    return map[type] || 'var(--text-2)';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  autoResize(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  clearChat() {
    this.messages.set([]);
    this.history = [];
    this.nextId = 1;
    this.msgSources.set([]);
  }

  useSuggestion(chip: string) {
    const el = this.inputEl()?.nativeElement;
    if (el) {
      el.value = chip;
      el.focus();
      this.send();
    }
  }

  async send() {
    const agent = this.selectedAgent();
    if (!agent) {
      this.toast.show('Select an agent first');
      return;
    }
    if (this.generating()) return;

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
    this.msgSources.set([]);

    this.history.push({ role: 'user', content: text });
    this.messages.update((m) => [...m, { id: this.nextId++, role: 'user', text }]);
    this.typing.set(true);
    this.shouldScroll = true;

    let systemPrompt = this.agentSvc.getAgentFullPrompt(agent) + '\n\n' + SYSTEM_DEV_AGENT;

    if (this.repoFiles().length > 0 && this.totalChunks() > 0) {
      try {
        const chunks = await this.project.getRelevantChunks(text, 3, 400);
        if (chunks.length > 0) {
          const sourceNames = [...new Set(chunks.map((c) => c.docName))];
          this.msgSources.set(sourceNames);
          const context = chunks.map((c) => `[${c.docName}]\n${c.text}`).join('\n\n---\n\n');
          systemPrompt = systemPrompt.replace('{CONTEXT}', context);
        } else {
          systemPrompt = systemPrompt.replace(
            '{CONTEXT}',
            'No relevant code found in the indexed repository. The user may need to select a folder with source files.',
          );
        }
      } catch {
        systemPrompt = systemPrompt.replace('{CONTEXT}', 'Error retrieving project context.');
      }
    } else {
      systemPrompt = systemPrompt.replace(
        '{CONTEXT}',
        'No repository loaded. Ask the user to select a project folder first.',
      );
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
            { id: aiId, role: 'ai', text: fullText, streaming: true },
          ]);
        } else {
          this.messages.update((m) =>
            m.map((msg) => (msg.id === aiId ? { ...msg, text: fullText, streaming: !done } : msg)),
          );
        }
        this.shouldScroll = true;
      });
      this.history.push({ role: 'assistant', content: full });
    } catch (e: any) {
      this.typing.set(false);
      const msg = e.message?.includes('INVALID_ARGUMENT')
        ? 'Conversation too long. Try clearing older messages.'
        : 'Error: ' + e.message;
      this.messages.update((m) => [...m, { id: this.nextId++, role: 'ai', text: msg }]);
    }

    this.generating.set(false);
  }

  onScroll() {
    const el = this.chatArea()?.nativeElement;
    if (!el) return;
    this.showScrollBtn.set(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
  }

  scrollToBottom() {
    const el = this.chatArea()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
      this.showScrollBtn.set(false);
    }
  }

  ngOnDestroy() {
    this.persistState();
  }

  html(text: string) {
    return this.dom.escapeHtml(text);
  }
}

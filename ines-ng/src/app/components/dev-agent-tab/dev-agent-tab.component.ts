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
import { AgentService, Agent, Skill } from '../../core/services/agent.service';
import { ProjectService } from '../../core/services/project.service';
import { StorageService } from '../../core/services/storage.service';
import { DomUtilsService } from '../../core/services/dom-utils.service';
import { MessageBubbleComponent } from '../../shared/message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../../shared/typing-indicator/typing-indicator.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

declare global {
  interface Window {
    showDirectoryPicker(options?: FilePickerOptions): Promise<FileSystemDirectoryHandle>;
  }
}

interface FilePickerOptions {
  mode?: 'read' | 'readwrite';
}

type Mode = 'chat' | 'review' | 'modify' | 'explain';

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

interface CodePatch {
  fileName: string;
  language: string;
  code: string;
  applied: boolean;
}

const MODE_LABELS: Record<Mode, string> = {
  chat: 'Chat',
  review: 'Code Review',
  modify: 'Modify Code',
  explain: 'Explain',
};

const MODE_ICONS: Record<Mode, string> = {
  chat: 'chat',
  review: 'rate_review',
  modify: 'edit',
  explain: 'help_outline',
};

const MODE_PROMPTS: Record<Mode, string> = {
  chat: '',
  review:
    'Perform a thorough code review of the relevant code. Check for bugs, security issues, performance problems, and style violations. For each issue cite the file, explain the problem, and suggest a fix. Rate severity.',
  modify:
    'Modify the source code as requested. Output the complete modified file in a markdown code block with the file path as the language tag. Show a brief summary of what changed before the code.',
  explain:
    'Explain how the relevant code works. Describe the architecture, data flow, and key decisions. Be detailed but clear.',
};

const SYSTEM_DEV_AGENT = `You are a Dev Agent — an expert software engineer working on the user's local repository.
You have access to the project files and can analyze, explain, and modify code.

═══════════════════════════════
CAPABILITIES
═══════════════════════════════
- Read and analyze code from the provided project context
- Perform thorough code reviews (bugs, security, performance, style)
- Explain architecture, patterns, and logic
- Modify source code and output complete revised files
- Suggest improvements, refactors, and bug fixes
- Answer questions about dependencies, config, and tooling

═══════════════════════════════
PROJECT CONTEXT
═══════════════════════════════
{CONTEXT}

═══════════════════════════════
MODE: {MODE}
═══════════════════════════════
{MODE_INSTRUCTIONS}

═══════════════════════════════
RULES
═══════════════════════════════
- Base answers on the project context above when relevant
- Quote file paths and code verbatim from the context
- When context is missing, say so and suggest what to add
- Output code in markdown code blocks with file name as the language tag
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
  private readonly storage = inject(StorageService);
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

  activeMode = signal<Mode>('chat');
  codePatches = signal<CodePatch[]>([]);
  showPatchesPanel = signal(false);

  showFileTree = signal(true);
  expandedFolders = signal<Set<string>>(new Set());

  private history: ChatMessage[] = [];
  private nextId = 1;
  private shouldScroll = false;
  showScrollBtn = signal(false);

  private dirHandle: FileSystemDirectoryHandle | null = null;
  private fileHandles = new Map<string, FileSystemFileHandle>();

  readonly hasWriteAccess = computed(() => this.dirHandle !== null);

  readonly MODE_LABELS = MODE_LABELS;
  readonly MODE_ICONS = MODE_ICONS;

  readonly suggestionChips = [
    'Summarize the project architecture',
    'What dependencies does this project use?',
    'Explain how to run this project',
    'Find potential bugs or improvements',
    'How is authentication handled?',
    'Explain the main entry point',
  ];

  readonly quickActions: { mode: Mode; label: string; prompt: string }[] = [
    { mode: 'review', label: 'Code Review', prompt: MODE_PROMPTS.review },
    {
      mode: 'modify',
      label: 'Modify Code',
      prompt: 'I need to modify the source code. Please help me with the following change: ',
    },
    {
      mode: 'explain',
      label: 'Explain Code',
      prompt: MODE_PROMPTS.explain,
    },
    { mode: 'chat', label: 'Chat', prompt: '' },
  ];

  readonly agentSkills = computed(() => {
    const agent = this.selectedAgent();
    if (!agent) return [] as Skill[];
    return this.agentSvc.skills().filter((s) => agent.skillIds.includes(s.id));
  });

  readonly activeModeLabel = computed(() => MODE_LABELS[this.activeMode()]);
  readonly activeModeIcon = computed(() => MODE_ICONS[this.activeMode()]);

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
    const parsed = this.storage.get<{
      repoName: string;
      repoFiles: unknown[];
      agentId: string;
      activeMode: Mode;
    }>('ines_dev_agent');
    if (parsed) {
      if (parsed.repoName) this.repoName.set(parsed.repoName);
      if (parsed.repoFiles) this.repoFiles.set(parsed.repoFiles as RepoFile[]);
      if (parsed.agentId) {
        const agent = this.agentSvc.agents().find((a) => a.id === parsed.agentId);
        if (agent) this.selectedAgent.set(agent);
      }
      if (parsed.activeMode) this.activeMode.set(parsed.activeMode);
    }
  }

  private persistState() {
    this.storage.set('ines_dev_agent', {
      repoName: this.repoName(),
      repoFiles: this.repoFiles(),
      agentId: this.selectedAgent()?.id,
      activeMode: this.activeMode(),
    });
  }

  setMode(mode: Mode) {
    this.activeMode.set(mode);
    this.persistState();
  }

  quickAction(action: { mode: Mode; label: string; prompt: string }) {
    this.setMode(action.mode);
    const el = this.inputEl()?.nativeElement;
    if (el) {
      el.value = action.prompt;
      el.focus();
      if (!action.prompt.endsWith(' ')) {
        el.selectionStart = el.value.length;
      }
    }
  }

  selectAgent(agent: Agent) {
    this.selectedAgent.set(agent);
    this.clearChat();
    this.persistState();
  }

  async openDirPicker() {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await this.loadFromDirectoryHandle(handle);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        this.toast.show('Write access denied — falling back to read-only mode');
      }
    }
    this.dirInput()?.nativeElement.click();
  }

  private async loadFromDirectoryHandle(handle: FileSystemDirectoryHandle) {
    this.isLoadingDir.set(true);
    this.dirHandle = handle;
    this.fileHandles.clear();
    this.repoFiles.set([]);
    this.repoName.set(handle.name);
    this.project.clearAll();

    const fileList: RepoFile[] = [];
    const processQueue: { file: File; handle: FileSystemFileHandle }[] = [];

    await this.scanDirectory(handle, '', fileList, processQueue);

    this.repoFiles.set(fileList);
    this.persistState();

    if (processQueue.length > 0) {
      this.toast.show(`Indexing ${processQueue.length} files...`);
      for (const item of processQueue) {
        try {
          await this.project.processFile(item.file);
        } catch {
          /* duplicate */
        }
      }
      await this.project.loadDocuments();
      this.totalChunks.set(await this.project.countChunks());
      this.toast.show(
        `Indexed ${fileList.length} files (${processQueue.length} processed) — write access enabled`,
      );
    } else {
      this.totalChunks.set(0);
    }

    this.isLoadingDir.set(false);
  }

  private async scanDirectory(
    dirHandle: FileSystemDirectoryHandle,
    prefix: string,
    fileList: RepoFile[],
    processQueue: { file: File; handle: FileSystemFileHandle }[],
  ) {
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === 'directory') {
        await this.scanDirectory(entry, prefix + name + '/', fileList, processQueue);
      } else {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const path = prefix + name;
        const ext = name.split('.').pop()?.toLowerCase() || '';

        fileList.push({ name, path, size: file.size, type: ext });
        this.fileHandles.set(path, fileHandle);

        if (this.fileExtensions.has(ext) && file.size < 1024 * 1024) {
          processQueue.push({ file, handle: fileHandle });
        }
      }
    }
  }

  async onDirSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    this.isLoadingDir.set(true);
    this.dirHandle = null;
    this.fileHandles.clear();
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
    this.dirHandle = null;
    this.fileHandles.clear();
    this.repoFiles.set([]);
    this.repoName.set('');
    this.totalChunks.set(0);
    this.clearChat();
    this.persistState();
  }

  async applyPatch(index: number) {
    if (!this.dirHandle) {
      this.toast.show('No write access. Re-open the folder with write permissions.');
      return;
    }

    const patch = this.codePatches()[index];
    if (!patch || !patch.fileName) {
      this.toast.show('This code block has no associated file name.');
      return;
    }

    const fileHandle = this.fileHandles.get(patch.fileName);
    if (!fileHandle) {
      this.toast.show(`File "${patch.fileName}" not found in repository.`);
      return;
    }

    try {
      const writable = await fileHandle.createWritable();
      await writable.write(patch.code);
      await writable.close();

      this.codePatches.update((patches) =>
        patches.map((p, i) => (i === index ? { ...p, applied: true } : p)),
      );

      await this.reindexFile(patch.fileName, fileHandle);

      this.toast.show(`Applied changes to "${patch.fileName}"`);
    } catch (err: any) {
      this.toast.show(`Failed to write "${patch.fileName}": ${err.message}`);
    }
  }

  async applyAllPatches() {
    const patches = this.codePatches();
    let applied = 0;
    let failed = 0;

    for (let i = 0; i < patches.length; i++) {
      if (patches[i].applied) {
        applied++;
        continue;
      }
      if (!this.dirHandle) break;
      if (!patches[i].fileName) {
        failed++;
        continue;
      }

      const fileHandle = this.fileHandles.get(patches[i].fileName);
      if (!fileHandle) {
        failed++;
        continue;
      }

      try {
        const writable = await fileHandle.createWritable();
        await writable.write(patches[i].code);
        await writable.close();

        this.codePatches.update((list) =>
          list.map((p, idx) => (idx === i ? { ...p, applied: true } : p)),
        );

        await this.reindexFile(patches[i].fileName, fileHandle);
        applied++;
      } catch {
        failed++;
      }
    }

    if (applied > 0 && failed === 0) {
      this.toast.show(`Applied all ${applied} changes`);
    } else if (applied > 0) {
      this.toast.show(`Applied ${applied} changes, ${failed} failed`);
    } else {
      this.toast.show('No changes could be applied');
    }
  }

  async revertPatch(index: number) {
    if (!this.dirHandle) return;

    const patch = this.codePatches()[index];
    if (!patch || !patch.fileName || !patch.applied) return;

    const fileHandle = this.fileHandles.get(patch.fileName);
    if (!fileHandle) return;

    try {
      const originalFile = await fileHandle.getFile();
      const text = await originalFile.text();

      this.codePatches.update((patches) =>
        patches.map((p, i) => (i === index ? { ...p, applied: false, code: text } : p)),
      );

      this.toast.show(`Reverted "${patch.fileName}" — original content shown above.`);
    } catch (err: any) {
      this.toast.show(`Failed to read "${patch.fileName}": ${err.message}`);
    }
  }

  private async reindexFile(fileName: string, fileHandle: FileSystemFileHandle) {
    const file = await fileHandle.getFile();
    try {
      await this.project.processFile(file);
      await this.project.loadDocuments();
      this.totalChunks.set(await this.project.countChunks());
    } catch {
      /* re-index failure is non-critical */
    }
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
    this.codePatches.set([]);
    this.showPatchesPanel.set(false);
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

    const el = this.inputEl()?.nativeElement;
    const text = el?.value.trim();
    if (!text) return;
    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }

    this.generating.set(true);
    if (el) {
      el.value = '';
      el.style.height = '';
    }
    this.msgSources.set([]);
    this.codePatches.set([]);

    this.history.push({ role: 'user', content: text });
    this.messages.update((m) => [...m, { id: this.nextId++, role: 'user', text }]);
    this.typing.set(true);
    this.shouldScroll = true;

    const mode = this.activeMode();
    let systemPrompt = this.agentSvc.getAgentFullPrompt(agent) + '\n\n' + SYSTEM_DEV_AGENT;
    systemPrompt = systemPrompt.replace('{MODE}', MODE_LABELS[mode]);
    systemPrompt = systemPrompt.replace('{MODE_INSTRUCTIONS}', MODE_PROMPTS[mode]);

    if (this.repoFiles().length > 0 && this.totalChunks() > 0) {
      try {
        const chunks = await this.project.getRelevantChunks(text, 5, 600);
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
        if (done) {
          const patches = this.extractCodeBlocks(fullText);
          if (patches.length > 0) {
            this.codePatches.set(patches);
            this.showPatchesPanel.set(true);
          }
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

  private extractCodeBlocks(text: string): CodePatch[] {
    const patches: CodePatch[] = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const lang = match[1] || 'text';
      const code = match[2].trim();
      if (code.length > 0) {
        const isFilePath = lang.includes('/') || lang.includes('.') || lang.includes('\\');
        patches.push({
          fileName: isFilePath ? lang : '',
          language: isFilePath ? lang.split('.').pop() || 'text' : lang,
          code,
          applied: false,
        });
      }
    }
    return patches;
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

  togglePatchesPanel() {
    this.showPatchesPanel.update((v) => !v);
  }

  copyPatch(code: string) {
    navigator.clipboard.writeText(code).then(
      () => this.toast.show('Code copied to clipboard'),
      () => this.toast.show('Failed to copy'),
    );
  }

  ngOnDestroy() {
    this.persistState();
  }

  html(text: string) {
    return this.dom.escapeHtml(text);
  }
}

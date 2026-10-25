import { Component, inject, signal, computed, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SecondBrainService, BrainNote } from '../../core/services/second-brain.service';
import {
  KnowledgeManagerService,
  KnowledgeDocument,
} from '../../core/services/knowledge-manager.service';
import { SpeechService } from '../../core/services/speech.service';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { DomUtilsService } from '../../core/services/dom-utils.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-brain-tab',
  standalone: true,
  imports: [FormsModule, MatIconModule, ButtonComponent, ConfirmDialogComponent],
  templateUrl: './brain-tab.component.html',
  styleUrl: './brain-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class BrainTabComponent implements OnDestroy, OnInit {
  readonly brain = inject(SecondBrainService);
  readonly km = inject(KnowledgeManagerService);
  readonly speech = inject(SpeechService);
  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);
  private readonly dom = inject(DomUtilsService);

  readonly searchQuery = signal('');
  readonly askQuery = signal('');
  readonly askResult = signal('');
  readonly asking = signal(false);
  readonly consolidating = signal(false);
  readonly showClearConfirm = signal(false);

  /** Current folder path in the filesystem navigator ('' = root). */
  readonly currentPath = signal('');
  readonly newFolderName = signal('');

  readonly breadcrumb = computed(() => {
    const p = this.currentPath();
    return p ? p.split('/') : [];
  });

  /** Direct subfolders of the current path (from the folder list + item paths). */
  readonly subfolders = computed(() => {
    const path = this.currentPath();
    const prefix = path ? path + '/' : '';
    const set = new Set<string>();
    for (const f of this.brain.folders()) {
      if (f.startsWith(prefix)) {
        const rest = f.slice(prefix.length);
        const seg = rest.split('/')[0];
        if (seg) set.add(seg);
      }
    }
    for (const n of this.brain.notes()) {
      if (n.folder.startsWith(prefix)) {
        const seg = n.folder.slice(prefix.length).split('/')[0];
        if (seg) set.add(seg);
      }
    }
    for (const d of this.km.documents()) {
      const f = d.folder || 'Documents';
      if (f.startsWith(prefix)) {
        const seg = f.slice(prefix.length).split('/')[0];
        if (seg) set.add(seg);
      }
    }
    return [...set].sort();
  });

  readonly itemsNotes = computed(() => {
    const p = this.currentPath();
    const q = this.searchQuery();
    return this.brain.search(q).filter((n) => n.folder === p);
  });

  readonly itemsDocs = computed(() => {
    const p = this.currentPath();
    return this.km.documents().filter((d) => (d.folder || 'Documents') === p);
  });

  readonly captureDest = computed(() => this.currentPath() || 'Inbox');
  readonly uploadDest = computed(() => this.currentPath() || 'Documents');

  ngOnInit() {
    void this.brain.initEmbeddings();
    void this.km.initEmbeddings();
    void this.km.loadDocuments();
  }

  navigateTo(segments: string[]): void {
    this.currentPath.set(segments.join('/'));
    this.searchQuery.set('');
  }

  subfolderPath(name: string): string {
    const p = this.currentPath();
    return p ? `${p}/${name}` : name;
  }

  folderCount(childName: string): number {
    const path = this.subfolderPath(childName);
    const notes = this.brain.notes().filter((n) => n.folder === path).length;
    const docs = this.km.documents().filter((d) => (d.folder || 'Documents') === path).length;
    return notes + docs;
  }

  createFolder(): void {
    const name = this.newFolderName().trim();
    if (!name) return;
    this.brain.createFolder(this.subfolderPath(name));
    this.newFolderName.set('');
    this.toast.success(`Folder "${name}" created`);
  }

  addNote(input: HTMLTextAreaElement) {
    if (this.speech.recording()) this.speech.stopRecording();
    const text = input.value.trim();
    if (!text) return;
    this.brain.capture(text, 'typed', this.captureDest());
    input.value = '';
    this.toast.success('Saved to your brain');
  }

  onNoteKey(e: KeyboardEvent, input: HTMLTextAreaElement) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.addNote(input);
    }
  }

  toggleRecording(input: HTMLTextAreaElement) {
    if (this.speech.recording()) this.speech.stopRecording();
    else {
      const ok = this.speech.startRecording(input.value, (text) => (input.value = text));
      if (!ok) this.toast.show('Web Speech API not supported in this browser');
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await this.km.processFile(file, this.uploadDest());
      this.toast.success(`Indexed "${file.name}" into ${this.uploadDest()}`);
    } catch (e: any) {
      this.toast.error(e?.message ?? 'Could not process file');
    }
    input.value = '';
  }

  async deleteDoc(id: string) {
    try {
      await this.km.deleteDocument(id);
      this.toast.success('Document removed');
    } catch {
      this.toast.error('Could not delete document');
    }
  }

  async ask(input: HTMLInputElement) {
    const q = input.value.trim();
    if (!q) return;
    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }
    this.asking.set(true);
    this.askResult.set(' ');
    try {
      this.askResult.set(await this.brain.ask(q));
    } catch (e: any) {
      this.askResult.set('❌ ' + e.message);
    }
    this.asking.set(false);
  }

  async consolidate() {
    if (!this.llm.isReady()) {
      this.toast.show('Load the model first!');
      return;
    }
    this.consolidating.set(true);
    try {
      const result = await this.brain.consolidate();
      if (!result) this.toast.show('Not enough notes to consolidate yet');
      else this.toast.success(`Consolidated ${result.consolidated} notes into long-term memory`);
    } catch (e: any) {
      this.toast.error(e?.message ?? 'Consolidation failed');
    }
    this.consolidating.set(false);
  }

  export() {
    if (!this.brain.notes().length) {
      this.toast.show('No notes to export');
      return;
    }
    const ts = new Date().toISOString().slice(0, 10);
    this.dom.downloadText(this.brain.exportMarkdown(), `second-brain-${ts}.md`);
    this.toast.success('Exported as Markdown');
  }

  formatDate(ts: number): string {
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
      ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  sourceIcon(source: BrainNote['source']): string {
    switch (source) {
      case 'voice':
        return 'mic';
      case 'agent':
        return 'smart_toy';
      case 'typed':
        return 'keyboard';
    }
  }

  docTypeIcon(doc: KnowledgeDocument): string {
    const t = (doc.type || '').toLowerCase();
    if (t === 'pdf') return 'picture_as_pdf';
    if (['md', 'txt', 'html'].includes(t)) return 'article';
    if (['docx', 'doc'].includes(t)) return 'description';
    if (['pptx', 'ppt'].includes(t)) return 'slideshow';
    return 'insert_drive_file';
  }

  html(text: string): string {
    return this.dom.escapeHtml(text);
  }

  ngOnDestroy() {
    this.speech.abortRecording();
  }
}

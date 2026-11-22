import {
  Component,
  effect,
  inject,
  computed,
  signal,
  OnInit,
  OnDestroy,
  SecurityContext,
  ElementRef,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import {
  DocumentStudioService,
  computePercent,
  elapsedSeconds,
  etaSeconds,
  formatDuration,
  isFinishedStatus,
  statusLabel as docStatusLabel,
} from '../../core/services/document-studio.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-document-studio-tab',
  standalone: true,
  imports: [FormsModule, MatIconModule, ButtonComponent],
  templateUrl: './document-studio-tab.component.html',
  styleUrl: './document-studio-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class DocumentStudioTabComponent implements OnInit, OnDestroy {
  readonly studio = inject(DocumentStudioService);
  readonly toast = inject(ToastService);
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  readonly sourceDir = signal('');
  readonly outputDir = signal('');
  readonly recursive = signal(true);
  readonly overwrite = signal(false);
  readonly now = signal(Date.now());

  readonly infoOpen = signal(false);
  readonly infoHtml = signal<SafeHtml | null>(null);
  readonly infoLoading = signal(false);
  readonly infoError = signal('');

  private readonly modalBody = viewChild<ElementRef<HTMLElement>>('modalBody');
  private mermaidP: Promise<any> | null = null;

  readonly percent = computed(() => {
    const job = this.studio.job();
    return job ? computePercent(job) : 0;
  });

  readonly isFinished = computed(() => {
    const job = this.studio.job();
    return job ? isFinishedStatus(job.status) : false;
  });

  readonly isStarting = computed(
    () =>
      this.studio.starting() ||
      (!!this.studio.job() && !this.isFinished() && this.studio.job()!.total === 0),
  );

  readonly elapsed = computed(() => {
    const job = this.studio.job();
    return job ? elapsedSeconds(job, this.now()) : 0;
  });

  readonly eta = computed(() => {
    const job = this.studio.job();
    return job ? etaSeconds(job, this.now()) : null;
  });

  constructor() {
    // Keep elapsed/ETA fresh on every poll update.
    effect(
      () => {
        this.studio.job();
        this.now.set(Date.now());
      },
      { allowSignalWrites: true },
    );

    effect(() => {
      const err = this.studio.error();
      if (err) this.toast.error(err);
    });
  }

  ngOnInit(): void {
    this.studio.checkHealth();
  }

  ngOnDestroy(): void {
    this.studio.stopPolling();
  }

  start(): void {
    const src = this.sourceDir().trim();
    const out = this.outputDir().trim();
    if (!src || !out) {
      this.toast.show('Inserisci la cartella sorgente e la cartella di destinazione.');
      return;
    }
    this.studio.startJob(src, out, this.recursive(), this.overwrite());
  }

  labelForStatus(status: string): string {
    return docStatusLabel(status);
  }

  fmtTime(s: number): string {
    return formatDuration(s);
  }

  openInfo(): void {
    if (this.infoOpen()) {
      this.infoOpen.set(false);
      return;
    }
    this.infoOpen.set(true);
    if (this.infoHtml()) return;

    this.infoLoading.set(true);
    this.infoError.set('');
    this.http.get('docs/document-studio.md', { responseType: 'text' }).subscribe({
      next: (md) => {
        const html = marked.parse(md, { breaks: true }) as string;
        const safe = this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
        this.infoHtml.set(this.sanitizer.bypassSecurityTrustHtml(safe));
        this.infoLoading.set(false);
        setTimeout(() => this.renderMermaidBlocks(), 0);
      },
      error: () => {
        this.infoError.set('Impossibile caricare la documentazione.');
        this.infoLoading.set(false);
      },
    });
  }

  closeInfo(): void {
    this.infoOpen.set(false);
  }

  private getMermaid(): Promise<any> {
    if (!this.mermaidP) {
      this.mermaidP = import('mermaid').then((m) => {
        m.default.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
        return m.default;
      });
    }
    return this.mermaidP;
  }

  private renderMermaidBlocks(): void {
    const el = this.modalBody()?.nativeElement;
    if (!el) return;
    el.querySelectorAll('code.language-mermaid:not([data-rendered])').forEach((block) =>
      this.renderMermaidBlock(block as HTMLElement),
    );
  }

  private async renderMermaidBlock(block: HTMLElement): Promise<void> {
    const code = (block.textContent || '').trim();
    if (!code) return;
    block.setAttribute('data-rendered', 'true');
    const pre = block.closest('pre') ?? block;
    try {
      const mermaid = await this.getMermaid();
      const id = 'mm-' + Math.random().toString(36).slice(2, 10);
      const { svg } = await mermaid.render(id, code);
      const container = document.createElement('div');
      container.className = 'ds-mermaid';
      container.innerHTML = svg;
      pre.replaceWith(container);
    } catch {
      pre.classList.add('ds-mermaid-failed');
    }
  }
}

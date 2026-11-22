import { Component, effect, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
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

  readonly sourceDir = signal('');
  readonly outputDir = signal('');
  readonly recursive = signal(true);
  readonly overwrite = signal(false);
  readonly now = signal(Date.now());

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
}

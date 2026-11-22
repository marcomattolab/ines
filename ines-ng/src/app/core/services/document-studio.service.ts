import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval, startWith, switchMap } from 'rxjs';

export interface DocHealth {
  status: string;
  ocr_cli_available: boolean;
  ocr_server_url: string;
  ocr_model: string;
  ocr_device: string;
  ocr_backend: string;
  diagram_mermaid_enabled: boolean;
  libreoffice_available: boolean;
}

export interface DocFile {
  file: string;
  status: 'pending' | 'processing' | 'done' | 'error' | 'skipped';
}

export interface DocError {
  file: string;
  error: string;
}

export interface DocJob {
  id: string;
  status: string;
  message: string;
  source_dir?: string;
  output_dir: string;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  current_file: string | null;
  errors: DocError[];
  files: DocFile[];
  pages_done: number;
  pages_total: number;
  started_at?: string;
  finished_at?: string;
}

const BASE_URL_KEY = 'ines_doc_studio_url';
const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';

const FINISHED_STATUSES = ['completed', 'completed_with_errors', 'failed'];

/** True when the backend will no longer update the job. */
export function isFinishedStatus(status: string): boolean {
  return FINISHED_STATUSES.includes(status);
}

/** Overall progress (0-100), weighting per-page OCR progress when available. */
export function computePercent(job: DocJob): number {
  if (!job?.total) return 0;
  const pageFraction =
    job.pages_total > 0 ? Math.max(0, Math.min(1, job.pages_done / job.pages_total)) : 0;
  const units = job.completed + pageFraction;
  return Math.max(0, Math.min(100, Math.round((units / job.total) * 100)));
}

export function elapsedSeconds(job: DocJob, nowMs: number): number {
  if (!job?.started_at) return 0;
  const start = Date.parse(job.started_at);
  const end = isFinishedStatus(job.status) && job.finished_at ? Date.parse(job.finished_at) : nowMs;
  return Math.max(0, Math.round((end - start) / 1000));
}

export function etaSeconds(job: DocJob, nowMs: number): number | null {
  if (isFinishedStatus(job.status) || !job?.total) return null;
  const pageFraction =
    job.pages_total > 0 ? Math.max(0, Math.min(1, job.pages_done / job.pages_total)) : 0;
  const units = job.completed + pageFraction;
  const elapsed = elapsedSeconds(job, nowMs);
  if (units <= 0 || elapsed <= 0) return null;
  return Math.max(0, Math.round((elapsed / units) * (job.total - units)));
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'in attesa',
    processing: 'in corso',
    done: 'fatto',
    error: 'errore',
    skipped: 'saltato',
  };
  return labels[status] ?? status;
}

/**
 * Client for the local MiniCPM Document Studio backend (FastAPI on 127.0.0.1:8000).
 * All OCR runs entirely on-device / on the local inference service (Edge AI).
 */
@Injectable({ providedIn: 'root' })
export class DocumentStudioService {
  private readonly http = inject(HttpClient);
  private pollSub: Subscription | null = null;

  readonly baseUrl = signal<string>(this.loadBaseUrl());
  readonly health = signal<DocHealth | null>(null);
  readonly healthError = signal<boolean>(false);
  readonly job = signal<DocJob | null>(null);
  readonly starting = signal<boolean>(false);
  readonly busy = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  setBaseUrl(url: string): void {
    const normalized = url.trim().replace(/\/+$/, '');
    this.baseUrl.set(normalized);
    try {
      localStorage.setItem(BASE_URL_KEY, normalized);
    } catch {
      /* ignore */
    }
    this.checkHealth();
  }

  checkHealth(): void {
    this.http.get<DocHealth>(`${this.baseUrl()}/api/health`).subscribe({
      next: (h) => {
        this.health.set(h);
        this.healthError.set(false);
      },
      error: () => {
        this.health.set(null);
        this.healthError.set(true);
      },
    });
  }

  startJob(source: string, output: string, recursive: boolean, overwrite: boolean): void {
    this.busy.set(true);
    this.starting.set(true);
    this.job.set(null);
    this.error.set(null);

    this.http
      .post<{ id: string }>(`${this.baseUrl()}/api/jobs`, {
        source_dir: source,
        output_dir: output,
        recursive,
        overwrite,
      })
      .subscribe({
        next: (result) => this.poll(result.id),
        error: (err) => {
          this.busy.set(false);
          this.starting.set(false);
          this.error.set(
            err?.error?.detail ?? 'Backend non raggiungibile. Avvia il servizio FastAPI.',
          );
        },
      });
  }

  private poll(id: string): void {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(1000)
      .pipe(
        startWith(0),
        switchMap(() => this.http.get<DocJob>(`${this.baseUrl()}/api/jobs/${id}`)),
      )
      .subscribe({
        next: (job) => {
          this.job.set(job);
          this.starting.set(false);
          const finished = isFinishedStatus(job.status);
          this.busy.set(!finished);
          if (finished) this.pollSub?.unsubscribe();
        },
        error: () => {
          this.busy.set(false);
          this.starting.set(false);
          this.error.set('Impossibile leggere lo stato del job dal backend.');
          this.pollSub?.unsubscribe();
        },
      });
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  private loadBaseUrl(): string {
    try {
      return localStorage.getItem(BASE_URL_KEY) ?? DEFAULT_BASE_URL;
    } catch {
      return DEFAULT_BASE_URL;
    }
  }
}

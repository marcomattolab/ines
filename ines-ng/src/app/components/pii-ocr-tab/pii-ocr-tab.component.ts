import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import * as pdfjsLib from 'pdfjs-dist';
import { OcrService, OcrWord } from '../../core/services/ocr.service';
import {
  PII_CATEGORIES,
  PII_RULES,
  PiiMatch,
  PiiTerm,
  detectPii,
  joinWords,
  wordsForMatch,
} from '../../core/services/pii';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/services/camera';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

@Component({
  selector: 'app-pii-ocr-tab',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './pii-ocr-tab.component.html',
  styleUrl: './pii-ocr-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class PiiOcrTabComponent {
  protected readonly ocr = inject(OcrService);
  private readonly toast = inject(ToastService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly done = signal(false);
  protected readonly error = signal('');
  protected readonly excluded = signal<ReadonlySet<number>>(new Set());
  protected readonly categories = PII_CATEGORIES;
  protected readonly enabled = signal<ReadonlySet<string>>(new Set(PII_RULES.map((r) => r.id)));

  private readonly words = signal<OcrWord[]>([]);
  private readonly terms = signal<PiiTerm[]>([]);
  private readonly joined = computed(() => joinWords(this.words()));
  protected readonly matches = computed<PiiMatch[]>(() =>
    detectPii(this.joined().text, { kinds: this.enabled(), terms: this.terms() }),
  );
  private image?: ImageBitmap;

  protected readonly redactedText = computed(() => {
    const text = this.joined().text;
    let out = '';
    let pos = 0;
    for (const m of this.matches()) {
      if (this.excluded().has(m.id)) continue;
      out += text.slice(pos, m.start) + `[${m.kind.toUpperCase()}]`;
      pos = m.end;
    }
    return out + text.slice(pos);
  });

  protected async onFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.error.set('');
    this.done.set(false);
    this.excluded.set(new Set());
    this.words.set([]);
    try {
      const source = this.isPdf(file) ? await this.renderPdf(file) : file;
      this.image = await createImageBitmap(source);
      this.paint();
      this.words.set(await this.ocr.recognizeWords(source));
      this.done.set(true);
      this.paint();
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  private isPdf(file: File): boolean {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  }

  /** Renders every PDF page into a single tall PNG for OCR and display. */
  private async renderPdf(file: File): Promise<Blob> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const targetWidth = 1800;
    const pages: HTMLCanvasElement[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = targetWidth / base.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      pages.push(canvas);
    }
    const width = Math.max(...pages.map((c) => c.width));
    const height = pages.reduce((sum, c) => sum + c.height, 0);
    const composed = document.createElement('canvas');
    composed.width = width;
    composed.height = height;
    const ctx = composed.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    let y = 0;
    for (const page of pages) {
      ctx.drawImage(page, 0, y);
      y += page.height;
    }
    const blob = await new Promise<Blob | null>((resolve) => composed.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not render the PDF to an image.');
    return blob;
  }

  protected toggle(id: number): void {
    this.excluded.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    this.paint();
  }

  protected toggleCategory(id: string): void {
    this.enabled.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    this.excluded.set(new Set());
  }

  protected onTerms(e: Event): void {
    const value = (e.target as HTMLTextAreaElement).value;
    this.terms.set(
      value
        .split(/[\n,]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => ({ value: t })),
    );
    this.excluded.set(new Set());
  }

  protected download(): void {
    this.canvas().nativeElement.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'redacted-document.png';
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
    this.toast.success('Redacted image downloaded');
  }

  protected async copyText(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.redactedText());
      this.toast.success('Text copied to clipboard');
    } catch {
      this.toast.error('Cannot copy the text');
    }
  }

  private paint(): void {
    const img = this.image;
    if (!img) return;
    const canvas = this.canvas().nativeElement;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const words = this.words();
    const spans = this.joined().spans;
    const pad = Math.max(3, Math.round(img.height * 0.004));
    ctx.fillStyle = '#000';
    for (const m of this.matches()) {
      if (this.excluded().has(m.id)) continue;
      for (const i of wordsForMatch(spans, m)) {
        const w = words[i];
        ctx.fillRect(w.x0 - pad, w.y0 - pad, w.x1 - w.x0 + pad * 2, w.y1 - w.y0 + pad * 2);
      }
    }
  }
}

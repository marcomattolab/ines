import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { OcrService, OcrWord } from '../../core/services/ocr.service';
import { PiiMatch, detectPii, joinWords, wordsForMatch } from '../../core/services/pii';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/services/camera';

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

  private readonly words = signal<OcrWord[]>([]);
  private readonly joined = computed(() => joinWords(this.words()));
  protected readonly matches = computed<PiiMatch[]>(() => detectPii(this.joined().text));
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
      this.image = await createImageBitmap(file);
      this.paint();
      this.words.set(await this.ocr.recognizeWords(file));
      this.done.set(true);
      this.paint();
    } catch (err) {
      this.error.set(errorMessage(err));
    }
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

  protected download(): void {
    this.canvas().nativeElement.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'documento-oscurato.png';
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
    this.toast.success('Immagine oscurata scaricata');
  }

  protected async copyText(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.redactedText());
      this.toast.success('Testo copiato negli appunti');
    } catch {
      this.toast.error('Impossibile copiare il testo');
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

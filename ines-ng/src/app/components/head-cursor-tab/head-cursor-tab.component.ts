import { Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MediaPipeTasksService } from '../../core/services/mediapipe-tasks.service';
import {
  CameraHandle,
  clamp,
  errorMessage,
  frameLoop,
  startCamera,
} from '../../core/services/camera';

type ClickMode = 'blink' | 'jaw';

@Component({
  selector: 'app-head-cursor-tab',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './head-cursor-tab.component.html',
  styleUrl: './head-cursor-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class HeadCursorTabComponent implements OnDestroy {
  private readonly mp = inject(MediaPipeTasksService);

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly cursor = viewChild.required<ElementRef<HTMLElement>>('cursor');

  protected readonly status = signal<'idle' | 'loading' | 'running'>('idle');
  protected readonly error = signal('');
  protected readonly mode = signal<ClickMode>('blink');
  protected readonly gain = signal(5);
  protected readonly blink = signal(0);
  protected readonly jaw = signal(0);
  protected readonly clicks = signal(0);
  protected readonly hits = signal<ReadonlySet<number>>(new Set());
  protected readonly targets = Array.from({ length: 12 }, (_, i) => i + 1);

  private face: any = null;
  private camera: CameraHandle | null = null;
  private stopLoop: (() => void) | null = null;
  private lastTime = -1;
  private last = { x: 0.5, y: 0.5 };
  private center?: { x: number; y: number };
  private pos = { x: 0.5, y: 0.5 };
  private closedSince = 0;
  private fired = false;
  private jawWasOpen = false;

  protected onMode(e: Event): void {
    this.mode.set((e.target as HTMLSelectElement).value as ClickMode);
  }

  protected onGain(e: Event): void {
    this.gain.set(Number((e.target as HTMLInputElement).value));
  }

  protected hit(n: number): void {
    this.hits.update((s) => new Set(s).add(n));
  }

  protected calibrate(): void {
    this.center = { ...this.last };
  }

  async start(): Promise<void> {
    this.error.set('');
    this.status.set('loading');
    try {
      this.face = await this.mp.face();
      this.camera = await startCamera(this.video().nativeElement);
      this.center = undefined;
      this.status.set('running');
      this.stopLoop = frameLoop(() => this.tick());
    } catch (e) {
      this.error.set(errorMessage(e));
      this.release();
      this.status.set('idle');
    }
  }

  stop(): void {
    this.release();
    this.status.set('idle');
    this.cursor().nativeElement.style.opacity = '0';
  }

  ngOnDestroy(): void {
    this.release();
  }

  private release(): void {
    this.stopLoop?.();
    this.stopLoop = null;
    this.camera?.stop();
    this.camera = null;
    this.face?.close();
    this.face = null;
  }

  private tick(): void {
    const video = this.video().nativeElement;
    if (!this.face || video.readyState < 2 || video.currentTime === this.lastTime) return;
    this.lastTime = video.currentTime;

    const res = this.face.detectForVideo(video, performance.now());
    const cursor = this.cursor().nativeElement;
    const nose = res.faceLandmarks[0]?.[1];
    if (!nose) {
      cursor.style.opacity = '0';
      return;
    }

    // Punta del naso, specchiata: muovere la testa a destra sposta il puntatore a destra.
    this.last = { x: 1 - nose.x, y: nose.y };
    this.center ??= { ...this.last };
    const g = this.gain();
    const tx = clamp(0.5 + (this.last.x - this.center.x) * g);
    const ty = clamp(0.5 + (this.last.y - this.center.y) * g * 1.4);
    this.pos = {
      x: this.pos.x + (tx - this.pos.x) * 0.25,
      y: this.pos.y + (ty - this.pos.y) * 0.25,
    };

    const px = this.pos.x * window.innerWidth;
    const py = this.pos.y * window.innerHeight;
    cursor.style.opacity = '1';
    cursor.style.transform = `translate(${px}px, ${py}px)`;

    const cats = res.faceBlendshapes[0]?.categories ?? [];
    const score = (name: string) => cats.find((c: any) => c.categoryName === name)?.score ?? 0;
    const blink = Math.min(score('eyeBlinkLeft'), score('eyeBlinkRight'));
    const jaw = score('jawOpen');
    this.blink.set(Math.round(blink * 100) / 100);
    this.jaw.set(Math.round(jaw * 100) / 100);

    const now = performance.now();
    if (this.mode() === 'blink') {
      if (blink > 0.55) {
        this.closedSince ||= now;
        if (!this.fired && now - this.closedSince > 500) {
          this.fired = true;
          this.clickAt(px, py);
        }
      } else {
        this.closedSince = 0;
        this.fired = false;
      }
    } else {
      const open = jaw > 0.5;
      if (open && !this.jawWasOpen) this.clickAt(px, py);
      this.jawWasOpen = open;
    }
  }

  private clickAt(x: number, y: number): void {
    const target = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>('button, a, [role="button"]');
    if (!target) return;
    target.click();
    this.clicks.update((n) => n + 1);
    const c = this.cursor().nativeElement;
    c.classList.remove('tap');
    void c.offsetWidth;
    c.classList.add('tap');
  }
}

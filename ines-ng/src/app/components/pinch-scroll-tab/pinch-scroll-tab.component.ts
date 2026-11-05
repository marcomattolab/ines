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

@Component({
  selector: 'app-pinch-scroll-tab',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './pinch-scroll-tab.component.html',
  styleUrl: './pinch-scroll-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class PinchScrollTabComponent implements OnDestroy {
  private readonly mp = inject(MediaPipeTasksService);

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly overlay = viewChild.required<ElementRef<HTMLCanvasElement>>('overlay');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly demo = viewChild.required<ElementRef<HTMLElement>>('demo');
  private readonly cursor = viewChild.required<ElementRef<HTMLElement>>('cursor');

  protected readonly status = signal<'idle' | 'loading' | 'running'>('idle');
  protected readonly error = signal('');
  protected readonly pinching = signal(false);
  protected readonly ratio = signal(0);
  protected readonly clicks = signal(0);
  protected readonly gain = signal(2.5);
  protected readonly liked = signal<ReadonlySet<number>>(new Set());
  protected readonly cards = Array.from({ length: 24 }, (_, i) => i);

  private landmarker: any = null;
  private drawing: any = null;
  private connections: any = null;
  private camera: CameraHandle | null = null;
  private stopLoop: (() => void) | null = null;
  private lastTime = -1;
  private pos?: { x: number; y: number };
  private pinchOn = false;
  private press = { t: 0, x: 0, y: 0, scroll: 0, dragged: false };

  protected onGain(e: Event): void {
    this.gain.set(Number((e.target as HTMLInputElement).value));
  }

  protected toggle(n: number): void {
    this.liked.update((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  async start(): Promise<void> {
    this.error.set('');
    this.status.set('loading');
    try {
      const hand = await this.mp.hand();
      this.landmarker = hand.landmarker;
      this.drawing = new hand.drawingCtor(this.overlay().nativeElement.getContext('2d'));
      this.connections = hand.connections;
      this.camera = await startCamera(this.video().nativeElement);
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
    this.pinchOn = false;
    this.pos = undefined;
    this.pinching.set(false);
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
    this.landmarker?.close();
    this.landmarker = null;
    this.drawing = null;
  }

  private tick(): void {
    const video = this.video().nativeElement;
    if (!this.landmarker || video.readyState < 2 || video.currentTime === this.lastTime) return;
    this.lastTime = video.currentTime;

    const res = this.landmarker.detectForVideo(video, performance.now());
    const canvas = this.overlay().nativeElement;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);

    const cursor = this.cursor().nativeElement;
    const hand = res.landmarks[0];
    if (!hand) {
      this.pinchOn = false;
      this.pinching.set(false);
      cursor.style.opacity = '0';
      return;
    }
    this.drawing?.drawConnectors(hand, this.connections, { color: '#ffffff', lineWidth: 2 });
    this.drawing?.drawLandmarks(hand, { color: '#2748f0', radius: 3 });

    const thumb = hand[4];
    const index = hand[8];
    const size = Math.hypot(hand[0].x - hand[9].x, hand[0].y - hand[9].y) || 1;
    const ratio = Math.hypot(thumb.x - index.x, thumb.y - index.y) / size;
    this.ratio.set(Math.round(ratio * 100) / 100);
    const on = this.pinchOn ? ratio < 0.42 : ratio < 0.28; // isteresi: evita sfarfallii

    // Posizione del cursore: punto medio tra le due dita, specchiato e ritagliato ai bordi.
    const tx = clamp((1 - (thumb.x + index.x) / 2 - 0.12) / 0.76);
    const ty = clamp(((thumb.y + index.y) / 2 - 0.12) / 0.76);
    this.pos = this.pos
      ? { x: this.pos.x + (tx - this.pos.x) * 0.4, y: this.pos.y + (ty - this.pos.y) * 0.4 }
      : { x: tx, y: ty };

    const rect = this.stage().nativeElement.getBoundingClientRect();
    cursor.style.opacity = '1';
    cursor.style.transform = `translate(${this.pos.x * rect.width}px, ${this.pos.y * rect.height}px)`;

    const now = performance.now();
    const scroller = this.demo().nativeElement;
    if (on && !this.pinchOn) {
      this.press = {
        t: now,
        x: this.pos.x,
        y: this.pos.y,
        scroll: scroller.scrollTop,
        dragged: false,
      };
    } else if (on) {
      const dx = (this.pos.x - this.press.x) * rect.width;
      const dy = (this.pos.y - this.press.y) * rect.height;
      if (Math.hypot(dx, dy) > 16) this.press.dragged = true;
      if (this.press.dragged) scroller.scrollTop = this.press.scroll - dy * this.gain();
    } else if (this.pinchOn && !this.press.dragged && now - this.press.t < 450) {
      this.clickAt(rect, this.press.x, this.press.y);
    }
    this.pinchOn = on;
    this.pinching.set(on);
  }

  private clickAt(rect: DOMRect, x: number, y: number): void {
    const el = document.elementFromPoint(rect.left + x * rect.width, rect.top + y * rect.height);
    const target = el?.closest<HTMLElement>('button, a, [role="button"]');
    if (!target) return;
    target.click();
    this.clicks.update((n) => n + 1);
    const c = this.cursor().nativeElement;
    c.classList.remove('tap');
    void c.offsetWidth;
    c.classList.add('tap');
  }
}

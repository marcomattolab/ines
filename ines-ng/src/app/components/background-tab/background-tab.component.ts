import { Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MediaPipeTasksService } from '../../core/services/mediapipe-tasks.service';
import { CameraHandle, errorMessage, frameLoop, startCamera } from '../../core/services/camera';

type Mode = 'blur' | 'color' | 'image';

interface BgImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

interface BgPreset {
  id: string;
  label: string;
  url: string;
}

@Component({
  selector: 'app-background-tab',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './background-tab.component.html',
  styleUrl: './background-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class BackgroundTabComponent implements OnDestroy {
  private readonly mp = inject(MediaPipeTasksService);

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly out = viewChild.required<ElementRef<HTMLCanvasElement>>('out');

  protected readonly status = signal<'idle' | 'loading' | 'running'>('idle');
  protected readonly error = signal('');
  protected readonly mode = signal<Mode>('blur');
  protected readonly blur = signal(16);
  protected readonly color = signal('#1f5eff');
  protected readonly invert = signal(true);
  protected readonly fps = signal(0);
  protected readonly preset = signal('');
  // Sfondi: foto da Wikimedia Commons.
  // Palermo: "Palermo panorama 2009" di Cezary p (CC BY-SA 4.0)
  // Parigi: "Paris Night" di Benh LIEU SONG (CC BY-SA 4.0)
  // Tokyo: "Tokyo - Sunset Skyline" di Fred Cherrygarden (CC BY-SA 4.0)
  protected readonly presets: BgPreset[] = [
    { id: 'palermo', label: 'Palermo', url: '/backgrounds/palermo.jpg' },
    { id: 'paris', label: 'Parigi', url: '/backgrounds/paris.jpg' },
    { id: 'tokyo', label: 'Tokyo', url: '/backgrounds/tokyo.jpg' },
  ];

  private segmenter: any = null;
  private camera: CameraHandle | null = null;
  private stopLoop: (() => void) | null = null;
  private lastTime = -1;
  private bg?: BgImage;

  private readonly maskCanvas = document.createElement('canvas');
  private readonly personCanvas = document.createElement('canvas');
  private maskImage?: ImageData;
  private frames = 0;
  private fpsStart = 0;

  protected onMode(e: Event): void {
    this.mode.set((e.target as HTMLSelectElement).value as Mode);
  }

  protected onBlur(e: Event): void {
    this.blur.set(Number((e.target as HTMLInputElement).value));
  }

  protected onColor(e: Event): void {
    this.color.set((e.target as HTMLInputElement).value);
  }

  protected onInvert(e: Event): void {
    this.invert.set((e.target as HTMLInputElement).checked);
  }

  protected async onImage(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const bmp = await createImageBitmap(file);
    this.preset.set('');
    this.bg = { source: bmp, width: bmp.width, height: bmp.height };
  }

  protected async onPreset(e: Event): Promise<void> {
    const id = (e.target as HTMLSelectElement).value;
    this.preset.set(id);
    if (!id) {
      this.bg = undefined;
      return;
    }
    const p = this.presets.find((x) => x.id === id);
    if (!p) return;
    try {
      const img = new Image();
      img.src = p.url;
      await img.decode();
      this.bg = { source: img, width: img.naturalWidth, height: img.naturalHeight };
    } catch (err) {
      this.bg = undefined;
      console.warn('Failed to load preset background', err);
    }
  }

  async start(): Promise<void> {
    this.error.set('');
    this.status.set('loading');
    try {
      this.segmenter = await this.mp.segmenter();
      this.camera = await startCamera(this.video().nativeElement);
      this.status.set('running');
      this.fpsStart = performance.now();
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
    this.fps.set(0);
  }

  ngOnDestroy(): void {
    this.release();
  }

  private release(): void {
    this.stopLoop?.();
    this.stopLoop = null;
    this.camera?.stop();
    this.camera = null;
    this.segmenter?.close();
    this.segmenter = null;
  }

  private tick(): void {
    const video = this.video().nativeElement;
    if (!this.segmenter || video.readyState < 2 || video.currentTime === this.lastTime) return;
    this.lastTime = video.currentTime;

    const result = this.segmenter.segmentForVideo(video, performance.now());
    const mask = result.categoryMask;
    if (mask) this.compose(video, mask.width, mask.height, mask.getAsUint8Array());
    result.close();

    this.frames++;
    const now = performance.now();
    if (now - this.fpsStart > 1000) {
      this.fps.set(Math.round((this.frames * 1000) / (now - this.fpsStart)));
      this.frames = 0;
      this.fpsStart = now;
    }
  }

  private compose(video: HTMLVideoElement, mw: number, mh: number, data: Uint8Array): void {
    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = this.out().nativeElement;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = this.personCanvas.width = w;
      canvas.height = this.personCanvas.height = h;
    }
    const ctx = canvas.getContext('2d')!;

    // 1) Maschera: pixel opachi dove c'è la persona.
    if (!this.maskImage || this.maskImage.width !== mw || this.maskImage.height !== mh) {
      this.maskCanvas.width = mw;
      this.maskCanvas.height = mh;
      this.maskImage = new ImageData(mw, mh);
    }
    const px = this.maskImage.data;
    const inv = this.invert();
    for (let i = 0; i < data.length; i++) px[i * 4 + 3] = data[i] > 0 !== inv ? 255 : 0;
    this.maskCanvas.getContext('2d')!.putImageData(this.maskImage, 0, 0);

    // 2) Sfondo.
    ctx.globalCompositeOperation = 'source-over';
    switch (this.mode()) {
      case 'blur': {
        const b = this.blur();
        ctx.filter = `blur(${b}px)`;
        ctx.drawImage(video, -b, -b, w + b * 2, h + b * 2); // margine extra per non avere bordi trasparenti
        ctx.filter = 'none';
        break;
      }
      case 'color':
        ctx.fillStyle = this.color();
        ctx.fillRect(0, 0, w, h);
        break;
      case 'image':
        if (this.bg) this.drawCover(ctx, this.bg.source, this.bg.width, this.bg.height, w, h);
        else {
          ctx.fillStyle = '#0b1424';
          ctx.fillRect(0, 0, w, h);
        }
        break;
    }

    // 3) Persona ritagliata con la maschera (bordo leggermente sfumato) e sovrapposta.
    const pctx = this.personCanvas.getContext('2d')!;
    pctx.globalCompositeOperation = 'source-over';
    pctx.clearRect(0, 0, w, h);
    pctx.drawImage(video, 0, 0, w, h);
    pctx.globalCompositeOperation = 'destination-in';
    pctx.filter = 'blur(2px)';
    pctx.drawImage(this.maskCanvas, 0, 0, w, h);
    pctx.filter = 'none';
    ctx.drawImage(this.personCanvas, 0, 0);
  }

  private drawCover(
    ctx: CanvasRenderingContext2D,
    img: CanvasImageSource,
    iw: number,
    ih: number,
    w: number,
    h: number,
  ): void {
    const s = Math.max(w / iw, h / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
}

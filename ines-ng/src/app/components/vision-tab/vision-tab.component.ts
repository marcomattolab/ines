import { Component, inject, signal, viewChild, ElementRef, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { VisionService } from '../../core/services/vision.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

const GESTURE_ICONS: Record<string, string> = {
  Open_Palm: 'back_hand',
  Closed_Fist: 'fist',
  Thumbs_Up: 'thumb_up',
  Thumbs_Down: 'thumb_down',
  Victory: 'peace',
  ILoveYou: 'favorite',
  Pointing_Up: 'ads_click',
};

const GESTURE_LABELS: Record<string, string> = {
  Open_Palm: 'Open Palm',
  Closed_Fist: 'Closed Fist',
  Thumbs_Up: 'Thumbs Up',
  Thumbs_Down: 'Thumbs Down',
  Victory: 'Victory',
  ILoveYou: 'I Love You',
  Pointing_Up: 'Pointing Up',
};

const EMOTION_ICONS: Record<string, string> = {
  Happy: 'sentiment_very_satisfied',
  Surprised: 'priority_high',
  Sad: 'sentiment_very_dissatisfied',
  Thinking: 'psychology',
  Neutral: 'face',
};

const FACEMESH_TRIANGLES = [
  127, 34, 137, 34, 127, 162, 162, 127, 21, 21, 162, 54, 54, 21, 117, 117, 54, 66, 66, 117, 119,
  119, 66, 67, 67, 119, 69, 69, 67, 68, 68, 69, 65, 65, 68, 63, 63, 65, 70, 70, 63, 71, 71, 70, 60,
  60, 71, 61, 61, 60, 62, 62, 61, 64, 64, 62, 58, 58, 64, 59, 59, 58, 57, 57, 59, 56, 56, 57, 55,
  55, 56, 53, 53, 55, 52, 52, 53, 51, 51, 52, 50, 50, 51, 49, 49, 50, 48, 48, 49, 47, 47, 48, 46,
  46, 47, 45, 45, 46, 44, 44, 45, 43, 43, 44, 42, 42, 43, 41, 41, 42, 40, 40, 41, 39, 39, 40, 38,
  38, 39, 37, 37, 38, 36, 36, 37, 35, 35, 36, 34, 34, 35, 137, 137, 34, 162, 162, 137, 216, 216,
  162, 54, 54, 216, 117, 117, 216, 215, 215, 117, 66, 66, 215, 67, 67, 215, 214, 214, 67, 68, 68,
  214, 63, 63, 214, 72, 72, 63, 73, 73, 72, 74, 74, 73, 75, 75, 74, 76, 76, 75, 77, 77, 76, 78, 78,
  77, 79, 79, 78, 80, 80, 79, 81, 81, 80, 82, 82, 81, 83, 83, 82, 84, 84, 83, 85, 85, 84, 86, 86,
  85, 87, 87, 86, 88, 88, 87, 89, 89, 88, 90, 90, 89, 91, 91, 90, 92, 92, 91, 93, 93, 92, 94, 94,
  93, 95, 95, 94, 96, 96, 95, 97, 97, 96, 98, 98, 97, 99, 99, 98, 100, 100, 99, 101, 101, 100, 102,
  102, 101, 103, 103, 102, 104, 104, 103, 105, 105, 104, 106, 106, 105, 107, 107, 106, 108, 108,
  107, 109, 109, 108, 110, 110, 109, 111, 111, 110, 112, 112, 111, 113, 113, 112, 114, 114, 113,
  115, 115, 114, 116, 116, 115, 117, 117, 116, 118, 118, 117, 119, 119, 118, 120, 120, 119, 121,
  121, 120, 122, 122, 121, 123, 123, 122, 124, 124, 123, 125, 125, 124, 126, 126, 125, 58, 58, 126,
  59, 59, 58, 60, 60, 59, 61, 61, 60, 62, 62, 61, 128, 128, 62, 129, 129, 128, 130, 130, 129, 131,
  131, 130, 132, 132, 131, 133, 133, 132, 134, 134, 133, 135, 135, 134, 136, 136, 135, 216,
];

@Component({
  selector: 'app-vision-tab',
  standalone: true,
  imports: [CommonModule, MatIconModule, ButtonComponent],
  templateUrl: './vision-tab.component.html',
  styleUrl: './vision-tab.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class VisionTabComponent implements OnDestroy {
  vision = inject(VisionService);
  toast = inject(ToastService);

  readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  readonly meshCanvas = viewChild<ElementRef<HTMLCanvasElement>>('meshCanvas');
  readonly faceFileInput = viewChild<ElementRef<HTMLInputElement>>('faceFileInput');

  isInitializing = signal(false);
  adaptiveMode = signal(false);
  gestureControl = signal(false);
  showFaceMesh = signal(false);
  autoPowerSave = signal(false);
  powerSaveActive = signal(false);
  faceImageEnabled = signal(false);
  loadedFaceImage = signal<HTMLImageElement | null>(null);
  loadedFileName = signal('');
  notifications = signal<{ id: number; icon: string; msg: string; type: string; time: string }[]>(
    [],
  );

  readonly emotions = ['Happy', 'Surprised', 'Sad', 'Thinking', 'Neutral'] as const;
  readonly Math = Math;

  private lastGesture = 'None';
  private lastFaceCount = 0;
  private nextNotifyId = 1;
  private drawRaf: number | null = null;

  constructor() {
    effect(() => {
      if (!this.gestureControl()) return;
      const g = this.vision.gesture();
      if (g !== 'None' && g !== this.lastGesture) {
        const icon = GESTURE_ICONS[g] || 'gesture';
        this.addNotification(
          icon,
          `Gesture: ${GESTURE_LABELS[g] || g} (${this.vision.gestureScore()}%)`,
          'purple',
        );
        this.lastGesture = g;
      } else if (g === 'None') {
        this.lastGesture = 'None';
      }
    });

    effect(() => {
      if (!this.adaptiveMode()) return;
      const e = this.vision.emotion();
      if (e !== 'Neutral') {
        const icon = EMOTION_ICONS[e] || 'face';
        const score = Math.round((this.vision.emotionScores()[this.emotionScoreKey(e)] ?? 0) * 100);
        this.addNotification(icon, `Emotion: ${e} (${score}%)`, 'blue');
      }
    });

    effect(() => {
      const count = this.vision.faceCount();
      if (count !== this.lastFaceCount) {
        if (count > this.lastFaceCount) {
          this.addNotification('group', `${count} face(s) in view`, 'green');
        } else if (count === 0) {
          this.addNotification('visibility_off', 'No faces in view', 'amber');
        }
        this.lastFaceCount = count;
      }
    });

    // Start/stop draw loop when mesh or face image is active
    effect(() => {
      const shouldDraw = this.showFaceMesh() || this.faceImageEnabled();
      if (shouldDraw && !this.drawRaf) {
        this.startDrawLoop();
      } else if (!shouldDraw && this.drawRaf) {
        this.stopDrawLoop();
      }
    });
  }

  private startDrawLoop() {
    const loop = () => {
      if (!this.vision.isRunning()) {
        this.clearCanvas();
        this.drawRaf = null;
        return;
      }
      this.drawOverlay();
      this.drawRaf = requestAnimationFrame(loop);
    };
    this.drawRaf = requestAnimationFrame(loop);
  }

  private stopDrawLoop() {
    if (this.drawRaf) {
      cancelAnimationFrame(this.drawRaf);
      this.drawRaf = null;
    }
    this.clearCanvas();
  }

  private emotionScoreKey(e: string): string {
    const map: Record<string, string> = {
      Happy: 'mouthSmileLeft',
      Surprised: 'jawOpen',
      Sad: 'mouthFrownLeft',
      Thinking: 'browDownLeft',
      Neutral: '',
    };
    return map[e] || '';
  }

  emotionConfidence(emotion: string): number {
    const scores = this.vision.emotionScores();
    if (emotion === 'Happy')
      return Math.max(scores['mouthSmileLeft'] ?? 0, scores['mouthSmileRight'] ?? 0);
    if (emotion === 'Surprised')
      return Math.max(scores['jawOpen'] ?? 0, scores['browInnerUp'] ?? 0);
    if (emotion === 'Sad')
      return Math.max(scores['mouthFrownLeft'] ?? 0, scores['mouthFrownRight'] ?? 0);
    if (emotion === 'Thinking')
      return Math.max(scores['browDownLeft'] ?? 0, scores['browDownRight'] ?? 0);
    if (emotion === 'Neutral') return 1;
    return 0;
  }

  gestureIcon(g: string): string {
    return GESTURE_ICONS[g] || 'gesture';
  }

  gestureLabel(g: string): string {
    return GESTURE_LABELS[g] || g;
  }

  private addNotification(icon: string, msg: string, type: string) {
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    this.notifications.update((n) =>
      [{ id: this.nextNotifyId++, icon, msg, type, time }, ...n].slice(0, 50),
    );
  }

  toggleFaceMesh() {
    this.showFaceMesh.update((v) => !v);
  }

  toggleAutoPowerSave() {
    this.autoPowerSave.update((v) => !v);
    this.powerSaveActive.set(false);
  }

  toggleFaceImage() {
    if (this.faceImageEnabled()) {
      this.faceImageEnabled.set(false);
    } else if (this.loadedFaceImage()) {
      this.faceImageEnabled.set(true);
    } else {
      this.openFacePicker();
    }
  }

  openFacePicker() {
    this.faceFileInput()?.nativeElement.click();
  }

  onFaceImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.loadImageFile(file);
  }

  private loadImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        this.loadedFaceImage.set(img);
        this.loadedFileName.set(file.name);
        this.faceImageEnabled.set(true);
        this.toast.show('✅ Face image loaded');
      };
      img.onerror = () => this.toast.show('❌ Failed to load image');
      img.src = reader.result as string;
    };
    reader.onerror = () => this.toast.show('❌ Failed to read file');
    reader.readAsDataURL(file);
  }

  async toggleVision() {
    if (this.vision.isRunning()) {
      this.vision.stopWebcam();
    } else {
      this.isInitializing.set(true);
      try {
        await this.vision.initVision();
        if (this.videoEl()) {
          await this.vision.startWebcam(this.videoEl()!.nativeElement);
        }
      } catch (err) {
        this.toast.show('❌ Failed to start Vision: ' + err);
      } finally {
        this.isInitializing.set(false);
      }
    }
  }

  // --- Canvas drawing ---

  private getCtx(): CanvasRenderingContext2D | null {
    const c = this.meshCanvas()?.nativeElement;
    if (!c) return null;
    const ctx = c.getContext('2d');
    if (!ctx) return null;

    const video = this.videoEl()?.nativeElement;
    if (!video) return null;

    const w = video.clientWidth || video.videoWidth || 640;
    const h = video.clientHeight || video.videoHeight || 480;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    return ctx;
  }

  private drawOverlay() {
    const lm = this.vision.faceLandmarks;
    if (!lm || lm.length === 0) {
      this.clearCanvas();
      return;
    }

    const ctx = this.getCtx();
    if (!ctx) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    // Mirror coordinates to match video's scale-x-[-1]
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);

    if (this.showFaceMesh()) {
      this.drawFaceMesh(ctx, lm, w, h);
    }

    if (this.faceImageEnabled()) {
      this.drawFaceImage(ctx, lm, w, h);
    }

    ctx.restore();
  }

  private drawFaceMesh(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < FACEMESH_TRIANGLES.length; i += 3) {
      const a = lm[FACEMESH_TRIANGLES[i]];
      const b = lm[FACEMESH_TRIANGLES[i + 1]];
      const c = lm[FACEMESH_TRIANGLES[i + 2]];
      if (!a || !b || !c) continue;
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.lineTo(c.x * w, c.y * h);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(96, 165, 250, 0.5)';
    for (const pt of lm) {
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, 1, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // --- Face image compositing ---

  private drawFaceImage(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    const img = this.loadedFaceImage();
    if (!img) return;

    // Landmark indices: 10=forehead, 152=chin, 234=left cheek, 454=right cheek
    const forehead = lm[10];
    const chin = lm[152];
    const leftEar = lm[234];
    const rightEar = lm[454];
    const lEye = lm[33];
    const rEye = lm[362];
    if (!forehead || !chin || !leftEar || !rightEar || !lEye || !rEye) return;

    const faceW = Math.abs(rightEar.x - leftEar.x) * w * 1.0;
    const faceH = Math.abs(chin.y - forehead.y) * h * 1.0;
    const cx = ((leftEar.x + rightEar.x) / 2) * w;
    const cy = ((forehead.y + chin.y) / 2) * h;
    const rot = Math.atan2(rEye.y - lEye.y, rEye.x - lEye.x);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // Diagnostic: outline ellipse to verify face tracking
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.ellipse(0, 0, faceW / 2, faceH / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Clip to oval
    ctx.beginPath();
    ctx.ellipse(0, 0, faceW / 2, faceH / 2, 0, 0, Math.PI * 2);
    ctx.clip();

    // Draw image scaled to fill the oval
    const imgA = img.naturalWidth / img.naturalHeight;
    const ovalA = faceW / faceH;
    let dw: number, dh: number;
    if (imgA > ovalA) {
      dh = faceH;
      dw = dh * imgA;
    } else {
      dw = faceW;
      dh = dw / imgA;
    }

    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);

    ctx.restore();
  }

  private clearCanvas() {
    const c = this.meshCanvas()?.nativeElement;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, c.width, c.height);
  }

  ngOnDestroy() {
    this.stopDrawLoop();
    this.vision.stopWebcam();
  }
}

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

// Face contour landmark indices from the MediaPipe canonical face mesh
const FACE_OVAL: number[] = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10,
];
const LIPS_OUTER: number[] = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61,
];
const LIPS_INNER: number[] = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78,
];
const LEFT_EYE: number[] = [
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263,
];
const RIGHT_EYE: number[] = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33,
];
const LEFT_EYEBROW: number[] = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336, 276];
const RIGHT_EYEBROW: number[] = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107, 46];
const NOSE_BRIDGE: number[] = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2];
const NOSE_BOTTOM: number[] = [98, 97, 2, 326, 327];

// Mesh edges connecting facial landmarks in a grid pattern (Google AI Edge style)
// Pairs of landmark indices forming the wireframe
const FACE_MESH_EDGES: [number, number][] = [
  // --- Vertical columns ---
  // Center column (nose bridge to chin)
  [10, 109],
  [109, 67],
  [67, 103],
  [103, 54],
  [54, 21],
  [21, 162],
  [162, 127],
  [127, 234],
  [234, 93],
  [93, 132],
  [132, 58],
  [58, 172],
  [172, 136],
  [136, 150],
  [150, 149],
  [149, 176],
  [176, 148],
  [148, 152],
  // Right eye vertical
  [338, 297],
  [297, 332],
  [332, 284],
  [284, 251],
  [251, 389],
  [389, 356],
  [356, 454],
  [454, 323],
  [323, 361],
  [361, 288],
  [288, 397],
  [397, 365],
  [365, 379],
  [379, 378],
  [378, 400],
  [400, 377],
  // Left eye vertical
  [10, 338],
  [162, 21],
  [127, 234],
  [152, 377],
  // --- Horizontal rows ---
  // Upper forehead
  [10, 338],
  [338, 297],
  [297, 332],
  [332, 284],
  [284, 251],
  [251, 389],
  [389, 356],
  [356, 454],
  // Mid-face (eye level)
  [127, 234],
  [234, 93],
  [93, 132],
  [132, 58],
  [58, 172],
  [172, 136],
  [136, 150],
  [150, 149],
  [149, 176],
  [176, 148],
  [148, 152],
  // Nose wing cross
  [54, 103],
  [103, 67],
  [67, 109],
  [109, 10],
  // Chin level
  [152, 377],
  [377, 378],
  [378, 400],
  [400, 379],
  [379, 365],
  [365, 397],
  [397, 288],
  [288, 361],
  [361, 323],
  [323, 454],
  // --- Cross / Diagonal connections for triangle mesh effect ---
  [10, 297],
  [338, 332],
  [297, 284],
  [332, 251],
  [284, 389],
  [251, 356],
  [389, 454],
  [356, 323],
  [454, 361],
  [323, 288],
  [361, 397],
  [288, 365],
  [397, 379],
  [365, 378],
  [379, 400],
  [378, 377],
  [400, 152],
  [10, 67],
  [338, 109],
  [54, 162],
  [103, 21],
  [109, 234],
  [10, 103],
  [93, 58],
  [132, 172],
  [58, 136],
  [172, 150],
  [136, 149],
  [150, 176],
  [149, 148],
  [176, 152],
  // Inner face connections from nose bridge to eyes and lips
  [168, 9],
  [9, 8],
  [8, 7],
  [7, 163],
  [163, 144],
  [144, 145],
  [145, 153],
  [153, 154],
  [154, 155],
  [155, 133],
  [168, 248],
  [248, 249],
  [249, 390],
  [390, 373],
  [373, 374],
  [374, 380],
  [380, 381],
  [381, 382],
  [382, 362],
  // Nose bridge vertical
  [168, 6],
  [6, 197],
  [197, 195],
  [195, 5],
  [5, 4],
  [4, 1],
  [1, 19],
  [19, 94],
  [94, 2],
  // Nose to lip
  [2, 0],
  [0, 17],
  [0, 37],
  [17, 61],
  [17, 291],
  [61, 39],
  [61, 40],
  [61, 185],
  [291, 409],
  [291, 270],
  [291, 375],
  [1, 2],
  [2, 98],
  [98, 97],
  [97, 326],
  [326, 327],
  // Eye brows to eyes
  [9, 46],
  [8, 53],
  [7, 52],
  [163, 65],
  [144, 55],
  [145, 70],
  [153, 63],
  [154, 105],
  [155, 66],
  [133, 107],
  [248, 276],
  [249, 283],
  [390, 282],
  [373, 295],
  [374, 285],
  [380, 300],
  [381, 293],
  [382, 334],
  [362, 296],
  [466, 336],
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
  cyberpunkFilter = signal(false);
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

        // Perform UI actions based on gesture
        if (g === 'Thumbs_Up') {
          this.toast.success('Positive feedback received!');
        } else if (g === 'Thumbs_Down') {
          this.toast.show('Negative feedback noted.');
        } else if (g === 'Victory') {
          this.addNotification('celebration', 'Celebration detected!', 'rose');
        }

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
      const shouldDraw = this.showFaceMesh() || this.faceImageEnabled() || this.cyberpunkFilter();
      if (shouldDraw && !this.drawRaf) {
        this.startDrawLoop();
      } else if (!shouldDraw && this.drawRaf) {
        this.stopDrawLoop();
      }
    });

    // Auto Power Save Logic
    effect(() => {
      if (!this.autoPowerSave() || !this.vision.isRunning()) {
        this.powerSaveActive.set(false);
        return;
      }
      const count = this.vision.faceCount();
      if (count === 0 && !this.powerSaveActive()) {
        this.powerSaveActive.set(true);
      } else if (count > 0 && this.powerSaveActive()) {
        this.powerSaveActive.set(false);
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

    if (this.cyberpunkFilter()) {
      this.drawCyberpunkFilter(ctx, lm, w, h);
    }

    if (this.faceImageEnabled()) {
      this.drawFaceImage(ctx, lm, w, h);
    }

    ctx.restore();
  }

  private drawCyberpunkFilter(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    const time = performance.now() / 1000;

    // 1. Scanning line
    const scanY = (time % 2) / 2;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, scanY * h);
    ctx.lineTo(w, scanY * h);
    ctx.stroke();

    // 2. Neon highlights on major landmarks
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';
    ctx.fillStyle = '#00ffff';

    // Highlight eyes and mouth with neon glow
    [468, 473, 13, 14].forEach((idx) => {
      const p = lm[idx];
      if (p) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 3. Digital "HUD" elements relative to head
    const forehead = lm[10];
    if (forehead) {
      // Draw text with identity transform so it's not mirrored
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = 'bold 10px monospace';
      const lines = [
        { text: `ID_SCAN: ACTIVE`, x: w - (forehead.x * w + 40), y: forehead.y * h - 20 },
        {
          text: `ENGAGEMENT: ${this.vision.engagement()}%`,
          x: w - (forehead.x * w + 40),
          y: forehead.y * h - 5,
        },
      ];
      for (const line of lines) {
        const m = ctx.measureText(line.text);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(line.x - 4, line.y - 9, m.width + 8, 14);
        ctx.fillStyle = '#00ffff';
        ctx.fillText(line.text, line.x, line.y);
      }
      ctx.restore();

      // Decorative brackets
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(forehead.x * w - 50, forehead.y * h - 30);
      ctx.lineTo(forehead.x * w - 60, forehead.y * h - 30);
      ctx.lineTo(forehead.x * w - 60, forehead.y * h + 30);
      ctx.lineTo(forehead.x * w - 50, forehead.y * h + 30);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  }

  private faceContours: { indices: number[]; color: string; width: number }[] = [
    { indices: FACE_OVAL, color: 'rgba(148, 163, 184, 0.4)', width: 1.2 },
    { indices: LIPS_OUTER, color: 'rgba(251, 113, 133, 0.6)', width: 1.5 },
    { indices: LIPS_INNER, color: 'rgba(251, 113, 133, 0.35)', width: 1 },
    { indices: LEFT_EYE, color: 'rgba(96, 165, 250, 0.65)', width: 1.5 },
    { indices: RIGHT_EYE, color: 'rgba(96, 165, 250, 0.65)', width: 1.5 },
    { indices: LEFT_EYEBROW, color: 'rgba(251, 191, 36, 0.55)', width: 1.3 },
    { indices: RIGHT_EYEBROW, color: 'rgba(251, 191, 36, 0.55)', width: 1.3 },
    { indices: NOSE_BRIDGE, color: 'rgba(192, 132, 252, 0.4)', width: 1 },
    { indices: NOSE_BOTTOM, color: 'rgba(192, 132, 252, 0.4)', width: 1 },
  ];

  private drawFaceMesh(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    // 1. Dense wireframe — thin, subtle edges connecting landmarks in a grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = 0.5;
    for (const [i, j] of FACE_MESH_EDGES) {
      const a = lm[i];
      const b = lm[j];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }

    // 2. Feature contours — face oval, eyes, lips, brows, nose
    for (const contour of this.faceContours) {
      const pts = contour.indices.map((i) => lm[i]).filter(Boolean);
      if (pts.length < 2) continue;
      ctx.strokeStyle = contour.color;
      ctx.lineWidth = contour.width;
      ctx.beginPath();
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * w, pts[i].y * h);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // 3. Iris glow (outer ring)
    ctx.shadowColor = 'rgba(129, 199, 255, 0.5)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(129, 199, 255, 0.15)';
    for (const idx of [468, 473]) {
      const p = lm[idx];
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 4. Iris center (bright dot)
    ctx.fillStyle = 'rgba(129, 199, 255, 0.9)';
    for (const idx of [468, 473]) {
      const p = lm[idx];
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Subtle landmark dots on contour points
    const keyPoints = [...FACE_OVAL, ...LEFT_EYE, ...RIGHT_EYE, ...LIPS_OUTER, ...LIPS_INNER];
    ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
    for (const i of keyPoints) {
      const pt = lm[i];
      if (!pt) continue;
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, 0.6, 0, Math.PI * 2);
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
    const leftCheek = lm[234];
    const rightCheek = lm[454];
    const lEye = lm[33];
    const rEye = lm[362];
    if (!forehead || !chin || !leftCheek || !rightCheek || !lEye || !rEye) return;

    const faceW = Math.abs(rightCheek.x - leftCheek.x) * w;
    const faceH = Math.abs(chin.y - forehead.y) * h;
    const cx = ((leftCheek.x + rightCheek.x) / 2) * w;
    const cy = ((forehead.y + chin.y) / 2) * h;
    const rot = Math.atan2(rEye.y - lEye.y, rEye.x - lEye.x);

    // Build face contour from landmarks (FACE_OVAL indices), centered at (cx, cy)
    const indices = FACE_OVAL;
    const contour = indices
      .map((i) => lm[i])
      .filter((p): p is { x: number; y: number } => !!p)
      .map((p) => ({ x: p.x * w - cx, y: p.y * h - cy }));
    if (contour.length < 3) return;

    // First pass — draw image clipped to the face contour
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    ctx.beginPath();
    ctx.moveTo(contour[0].x, contour[0].y);
    for (let i = 1; i < contour.length; i++) {
      ctx.lineTo(contour[i].x, contour[i].y);
    }
    ctx.closePath();
    ctx.clip();

    // Scale image to cover the face area (slightly oversize for seamless coverage)
    const imgA = img.naturalWidth / img.naturalHeight;
    const faceA = faceW / faceH;
    const pad = 1.15;
    let dw: number, dh: number;
    if (imgA > faceA) {
      dh = faceH * pad;
      dw = dh * imgA;
    } else {
      dw = faceW * pad;
      dh = dw / imgA;
    }
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    // Second pass — feather the edge by stroking the contour with a shadow blur
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    ctx.beginPath();
    ctx.moveTo(contour[0].x, contour[0].y);
    for (let i = 1; i < contour.length; i++) {
      ctx.lineTo(contour[i].x, contour[i].y);
    }
    ctx.closePath();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

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

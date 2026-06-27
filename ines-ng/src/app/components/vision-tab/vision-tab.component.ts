import { Component, inject, signal, viewChild, ElementRef, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { VisionService, FaceOverlayType } from '../../core/services/vision.service';
import { ToastService } from '../../core/services/toast.service';
import { LlmService } from '../../core/services/llm.service';
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

const OVERLAYS: { type: FaceOverlayType; icon: string; label: string; color: string }[] = [
  { type: 'pacman', icon: 'radio_button_checked', label: 'Pac-Man', color: 'accent-amber' },
  { type: 'cat', icon: 'pets', label: 'Cat', color: 'accent-orange' },
  { type: 'robot', icon: 'smart_toy', label: 'Robot', color: 'accent-cyan' },
  { type: 'alien', icon: 'bug_report', label: 'Alien', color: 'accent-green' },
  { type: 'ninja', icon: 'dark_mode', label: 'Ninja', color: 'text-2' },
  { type: 'joker', icon: 'sentiment_satisfied', label: 'Joker', color: 'accent-rose' },
  { type: 'sunglasses', icon: 'sunglasses', label: 'Shades', color: 'accent-purple' },
  { type: 'skull', icon: 'dangerous', label: 'Skull', color: 'accent-rose' },
  { type: 'photo', icon: 'switch_access_shortcut', label: 'Photo', color: 'accent-indigo' },
];

// Hand skeleton connections (21 landmarks)
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [5, 9],
  [9, 13],
  [13, 17],
];

// Pose skeleton connections (33 landmarks)
const POSE_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [11, 12],
  [11, 23],
  [12, 24],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [27, 31],
  [29, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [28, 32],
  [30, 32],
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
  llm = inject(LlmService);

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
  aiInsights = signal(false);
  aiInsightText = signal('');
  aiInsightLoading = signal(false);
  faceOverlayType = signal<FaceOverlayType | null>(null);
  showOverlayPicker = signal(false);
  showHandOverlay = signal(false);
  showPoseOverlay = signal(false);
  notifications = signal<{ id: number; icon: string; msg: string; type: string; time: string }[]>(
    [],
  );

  readonly emotions = ['Happy', 'Surprised', 'Sad', 'Thinking', 'Neutral'] as const;
  readonly Math = Math;
  readonly OVERLAYS = OVERLAYS;

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

    // Start/stop draw loop when any overlay is active
    effect(() => {
      const hasFaceOverlay =
        this.faceOverlayType() || this.faceImageEnabled() || this.cyberpunkFilter();
      const shouldDraw =
        this.showFaceMesh() || hasFaceOverlay || this.showHandOverlay() || this.showPoseOverlay();
      if (shouldDraw && !this.drawRaf) {
        this.startDrawLoop();
      } else if (!shouldDraw && this.drawRaf) {
        this.stopDrawLoop();
      }
    });

    // Enable/disable hand detection when toggled
    effect(() => {
      this.vision.enableHandDetection(this.showHandOverlay());
    });

    // Enable/disable pose detection when toggled
    effect(() => {
      this.vision.enablePoseDetection(this.showPoseOverlay());
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

  setOverlayType(type: FaceOverlayType) {
    if (this.faceOverlayType() === type) {
      this.faceOverlayType.set(null);
    } else {
      this.faceOverlayType.set(type);
      this.showOverlayPicker.set(false);
      if (type === 'photo') {
        this.faceImageEnabled.set(false);
        this.loadedFaceImage() ? this.faceImageEnabled.set(true) : this.openFacePicker();
      } else {
        this.faceImageEnabled.set(false);
      }
    }
  }

  toggleOverlayPicker() {
    this.showOverlayPicker.update((v) => !v);
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
    const ctx = this.getCtx();
    if (!ctx) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    const lm = this.vision.faceLandmarks;
    const hasFace = lm && lm.length > 0;

    // Mirror coordinates to match video's scale-x-[-1]
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);

    if (hasFace) {
      if (this.showFaceMesh()) {
        this.drawFaceMesh(ctx, lm, w, h);
      }
      if (this.cyberpunkFilter()) {
        this.drawCyberpunkFilter(ctx, lm, w, h);
      }
      if (this.faceImageEnabled()) {
        this.drawFaceImage(ctx, lm, w, h);
      }
      this.drawFaceOverlay(ctx, lm, w, h);
    }

    ctx.restore();

    // Hand & pose drawn without mirror so text/orientation reads correctly
    if (this.showHandOverlay()) {
      this.drawHandSkeleton(ctx);
    }
    if (this.showPoseOverlay()) {
      this.drawPoseSkeleton(ctx);
    }
  }

  private drawFaceOverlay(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    const type = this.faceOverlayType();
    if (!type || type === 'photo') return;
    const dispatch: Record<
      string,
      (c: CanvasRenderingContext2D, l: any[], w: number, h: number) => void
    > = {
      pacman: this.drawPacmanOverlay,
      cat: this.drawCatOverlay,
      robot: this.drawRobotOverlay,
      alien: this.drawAlienOverlay,
      ninja: this.drawNinjaOverlay,
      joker: this.drawJokerOverlay,
      sunglasses: this.drawSunglassesOverlay,
      skull: this.drawSkullOverlay,
    };
    dispatch[type]?.call(this, ctx, lm, w, h);
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

  // --- Icon face overlays (canvas-drawn meshes tracking face landmarks) ---

  private getOverlayTransform(
    lm: any[],
    w: number,
    h: number,
  ): { cx: number; cy: number; rot: number; faceW: number; faceH: number } | null {
    const forehead = lm[10],
      chin = lm[152],
      lEye = lm[33],
      rEye = lm[362];
    const leftCheek = lm[234],
      rightCheek = lm[454];
    if (!forehead || !chin || !lEye || !rEye || !leftCheek || !rightCheek) return null;
    return {
      cx: ((leftCheek.x + rightCheek.x) / 2) * w,
      cy: ((forehead.y + chin.y) / 2) * h,
      rot: Math.atan2(rEye.y - lEye.y, rEye.x - lEye.x),
      faceW: Math.abs(rightCheek.x - leftCheek.x) * w,
      faceH: Math.abs(chin.y - forehead.y) * h,
    };
  }

  private drawPacmanOverlay(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    const t = this.getOverlayTransform(lm, w, h);
    if (!t) return;
    const r = t.faceH * 0.55;
    const mouthAngle = (Math.sin(performance.now() / 200) * 0.3 + 0.4) * Math.PI;
    ctx.save();
    ctx.translate(t.cx, t.cy);
    ctx.rotate(t.rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, mouthAngle, Math.PI * 2 - mouthAngle);
    ctx.closePath();
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 2;
    ctx.stroke();
    const eyeX = r * 0.25,
      eyeY = -r * 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCatOverlay(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    const t = this.getOverlayTransform(lm, w, h);
    if (!t) return;
    const s = t.faceH * 0.55;
    ctx.save();
    ctx.translate(t.cx, t.cy - t.faceH * 0.05);
    ctx.rotate(t.rot);
    ctx.fillStyle = '#FF8C42';
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#CC6A2E';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Ears
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.5, -s * 0.1);
      ctx.lineTo(side * s * 0.9, -s * 0.85);
      ctx.lineTo(side * s * 0.1, -s * 0.55);
      ctx.closePath();
      ctx.fillStyle = '#FF8C42';
      ctx.fill();
      ctx.strokeStyle = '#CC6A2E';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Inner ear (pink)
      ctx.beginPath();
      ctx.moveTo(side * s * 0.45, -s * 0.15);
      ctx.lineTo(side * s * 0.75, -s * 0.65);
      ctx.lineTo(side * s * 0.2, -s * 0.5);
      ctx.closePath();
      ctx.fillStyle = '#FFB6C1';
      ctx.fill();
    }
    // Eyes
    ctx.fillStyle = '#2D5A27';
    for (const ex of [-s * 0.25, s * 0.25]) {
      ctx.beginPath();
      ctx.ellipse(ex, -s * 0.1, s * 0.08, s * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(ex, -s * 0.1, s * 0.04, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2D5A27';
    }
    // Nose
    ctx.fillStyle = '#FF69B4';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.12);
    ctx.lineTo(-s * 0.06, s * 0.18);
    ctx.lineTo(s * 0.06, s * 0.18);
    ctx.closePath();
    ctx.fill();
    // Whiskers
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 0.8;
    for (const side of [-1, 1]) {
      for (let wi = 0; wi < 3; wi++) {
        const wy = s * (0.12 + wi * 0.07);
        ctx.beginPath();
        ctx.moveTo(side * s * 0.08, wy);
        ctx.lineTo(side * s * 0.55, wy - s * 0.04 + wi * s * 0.03);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawRobotOverlay(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    const t = this.getOverlayTransform(lm, w, h);
    if (!t) return;
    const s = t.faceH * 0.6;
    ctx.save();
    ctx.translate(t.cx, t.cy);
    ctx.rotate(t.rot);
    // Head (rounded rectangle)
    ctx.fillStyle = '#A0A0A0';
    const rw = s * 1.2,
      rh = s * 1.3;
    this.roundRect(ctx, -rw / 2, -rh / 2, rw, rh, s * 0.15);
    ctx.fill();
    ctx.strokeStyle = '#707070';
    ctx.lineWidth = 2;
    this.roundRect(ctx, -rw / 2, -rh / 2, rw, rh, s * 0.15);
    ctx.stroke();
    // Antenna
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -rh / 2);
    ctx.lineTo(0, -rh / 2 - s * 0.3);
    ctx.stroke();
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(0, -rh / 2 - s * 0.3, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    // LED eyes
    ctx.fillStyle = '#00FF88';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00FF88';
    for (const ex of [-s * 0.25, s * 0.25]) {
      ctx.beginPath();
      ctx.roundRect(ex - s * 0.1, -s * 0.15, s * 0.2, s * 0.12, s * 0.03);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // Mouth grid
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    const my = s * 0.2;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        ctx.strokeRect(-s * 0.35 + col * s * 0.17, my + row * s * 0.12, s * 0.13, s * 0.08);
      }
    }
    ctx.restore();
  }

  private drawAlienOverlay(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    const t = this.getOverlayTransform(lm, w, h);
    if (!t) return;
    const s = t.faceH * 0.55;
    ctx.save();
    ctx.translate(t.cx, t.cy - t.faceH * 0.1);
    ctx.rotate(t.rot);
    ctx.fillStyle = '#7CCD7C';
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5B9E5B';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Antennae
    ctx.strokeStyle = '#7CCD7C';
    ctx.lineWidth = 3;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.35, -s * 0.45);
      ctx.quadraticCurveTo(side * s * 0.7, -s * 1.0, side * s * 0.5, -s * 1.1);
      ctx.stroke();
      ctx.fillStyle = '#FF69B4';
      ctx.beginPath();
      ctx.arc(side * s * 0.5, -s * 1.1, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    // Big black eyes
    ctx.fillStyle = '#000';
    for (const ex of [-s * 0.2, s * 0.2]) {
      ctx.beginPath();
      ctx.ellipse(ex, -s * 0.05, s * 0.15, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + s * 0.04, -s * 0.1, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
    }
    // Small mouth
    ctx.fillStyle = '#5B9E5B';
    ctx.beginPath();
    ctx.arc(0, s * 0.2, s * 0.06, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  }

  private drawNinjaOverlay(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    const t = this.getOverlayTransform(lm, w, h);
    if (!t) return;
    const s = t.faceH * 0.55;
    ctx.save();
    ctx.translate(t.cx, t.cy);
    ctx.rotate(t.rot);
    // Face circle (dark mask)
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2d2d44';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Eye cutouts (white glow)
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fff';
    for (const ex of [-s * 0.22, s * 0.22]) {
      ctx.beginPath();
      ctx.ellipse(ex, -s * 0.05, s * 0.1, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // Pupils
    ctx.fillStyle = '#000';
    for (const ex of [-s * 0.22, s * 0.22]) {
      ctx.beginPath();
      ctx.arc(ex, -s * 0.05, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
    // Headband
    ctx.fillStyle = '#C62828';
    ctx.fillRect(-s * 1.1, -s * 0.55, s * 2.2, s * 0.12);
    ctx.strokeStyle = '#B71C1C';
    ctx.lineWidth = 1;
    ctx.strokeRect(-s * 1.1, -s * 0.55, s * 2.2, s * 0.12);
    // Headband tail
    ctx.fillStyle = '#C62828';
    ctx.beginPath();
    ctx.moveTo(s * 0.8, -s * 0.55);
    ctx.quadraticCurveTo(s * 1.2, -s * 0.9, s * 0.7, -s * 1.0);
    ctx.lineTo(s * 0.6, -s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawJokerOverlay(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    const t = this.getOverlayTransform(lm, w, h);
    if (!t) return;
    const s = t.faceH * 0.55;
    ctx.save();
    ctx.translate(t.cx, t.cy - t.faceH * 0.02);
    ctx.rotate(t.rot);
    // Face (white base)
    ctx.fillStyle = '#F5F5DC';
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#CCC';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Green messy hair
    ctx.fillStyle = '#2E7D32';
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const r = s * 1.05;
      const hx = Math.cos(angle) * r,
        hy = Math.sin(angle) * r;
      if (hy < -s * 0.2) continue;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      const endX = hx + (Math.random() - 0.5) * s * 0.5;
      const endY = hy - s * 0.3 - Math.random() * s * 0.15;
      ctx.quadraticCurveTo((hx + endX) / 2, hy - s * 0.4, endX, endY);
      ctx.lineWidth = 4 + Math.random() * 3;
      ctx.stroke();
    }
    // Big red smile
    ctx.strokeStyle = '#C62828';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, s * 0.05, s * 0.45, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = '#B71C1C';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, s * 0.05, s * 0.45, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    // Teeth
    ctx.fillStyle = '#FFF';
    for (let tx = -s * 0.3; tx <= s * 0.3; tx += s * 0.1) {
      const ty = s * 0.05 + Math.sqrt(Math.max(0, (s * 0.45) ** 2 - tx ** 2));
      ctx.fillRect(tx - s * 0.03, ty - s * 0.03, s * 0.06, s * 0.06);
    }
    // Eyes (dark makeup)
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(-s * 0.22, -s * 0.1, s * 0.12, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.22, -s * 0.1, s * 0.12, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    // Red nose
    ctx.fillStyle = '#E53935';
    ctx.beginPath();
    ctx.arc(0, s * 0.08, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSunglassesOverlay(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    const t = this.getOverlayTransform(lm, w, h);
    if (!t) return;
    const s = t.faceH * 0.55;
    ctx.save();
    ctx.translate(t.cx, t.cy - t.faceH * 0.05);
    ctx.rotate(t.rot);
    // Two large lenses
    ctx.fillStyle = '#1a1a2e';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(side * s * 0.32 - s * 0.28, -s * 0.22, s * 0.5, s * 0.3, s * 0.06);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // Bridge
    ctx.fillStyle = '#333';
    ctx.fillRect(-s * 0.06, -s * 0.12, s * 0.12, s * 0.06);
    // Arms
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, -s * 0.07);
    ctx.lineTo(-s * 0.75, -s * 0.02);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.32, -s * 0.07);
    ctx.lineTo(s * 0.75, -s * 0.02);
    ctx.stroke();
    // Lens reflections
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(side * s * 0.32 - s * 0.2, -s * 0.17, s * 0.25, s * 0.08, s * 0.03);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSkullOverlay(ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) {
    const t = this.getOverlayTransform(lm, w, h);
    if (!t) return;
    const s = t.faceH * 0.55;
    ctx.save();
    ctx.translate(t.cx, t.cy);
    ctx.rotate(t.rot);
    // Skull shape
    ctx.fillStyle = '#F5F5F5';
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#CCC';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Jaw line
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, s * 0.1);
    ctx.quadraticCurveTo(-s * 0.75, s * 0.55, 0, s * 0.7);
    ctx.quadraticCurveTo(s * 0.75, s * 0.55, s * 0.7, s * 0.1);
    ctx.fill();
    ctx.stroke();
    // Eye sockets
    ctx.fillStyle = '#1a1a1a';
    for (const ex of [-s * 0.22, s * 0.22]) {
      ctx.beginPath();
      ctx.ellipse(ex, -s * 0.08, s * 0.16, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Nose hole
    ctx.beginPath();
    ctx.moveTo(0, s * 0.08);
    ctx.lineTo(-s * 0.05, s * 0.16);
    ctx.lineTo(s * 0.05, s * 0.16);
    ctx.closePath();
    ctx.fill();
    // Teeth
    ctx.fillStyle = '#E0E0E0';
    for (let row = 0; row < 2; row++) {
      for (let col = -3; col <= 3; col++) {
        if (col === 0 && row === 0) continue;
        const tx = col * s * 0.08;
        const ty = s * 0.28 + row * s * 0.1;
        ctx.fillRect(tx - s * 0.03, ty, s * 0.06, s * 0.08);
        ctx.strokeRect(tx - s * 0.03, ty, s * 0.06, s * 0.08);
      }
    }
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // --- Hand skeleton overlay ---

  private drawHandSkeleton(ctx: CanvasRenderingContext2D) {
    const hands = this.vision.handLandmarks();
    if (!hands.length) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    for (let hi = 0; hi < hands.length; hi++) {
      const lm = hands[hi];
      if (!lm || lm.length < 21) continue;

      // Bones
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
      ctx.lineWidth = 2;
      for (const [i, j] of HAND_CONNECTIONS) {
        const a = lm[i],
          b = lm[j];
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo((1 - a.x) * w, a.y * h);
        ctx.lineTo((1 - b.x) * w, b.y * h);
        ctx.stroke();
      }

      // Joint dots
      ctx.fillStyle = 'rgba(0, 255, 136, 0.9)';
      for (const p of lm) {
        if (!p) continue;
        ctx.beginPath();
        ctx.arc((1 - p.x) * w, p.y * h, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // --- Pose skeleton overlay ---

  private drawPoseSkeleton(ctx: CanvasRenderingContext2D) {
    const lm = this.vision.poseLandmarks();
    if (!lm || lm.length < 33) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
    ctx.lineWidth = 2;
    for (const [i, j] of POSE_CONNECTIONS) {
      const a = lm[i],
        b = lm[j];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo((1 - a.x) * w, a.y * h);
      ctx.lineTo((1 - b.x) * w, b.y * h);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
    for (const p of lm) {
      if (!p) continue;
      ctx.beginPath();
      ctx.arc((1 - p.x) * w, p.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private clearCanvas() {
    const c = this.meshCanvas()?.nativeElement;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, c.width, c.height);
  }

  toggleAiInsights() {
    this.aiInsights.update((v) => !v);
    if (!this.aiInsights()) {
      this.aiInsightText.set('');
    }
  }

  async runAiInsight() {
    if (this.aiInsightLoading() || !this.llm.isReady()) return;
    this.aiInsightLoading.set(true);
    this.aiInsightText.set('');

    const context = this.buildVisionContext();
    const system =
      "You are an on-device edge AI vision assistant. Analyze the user's current state based on the vision data below. Keep responses to 2-3 short sentences. Be insightful but concise.";
    const prompt = this.llm.buildPrompt(system, `Current vision state: ${context}`);

    try {
      await this.llm.generate(prompt, (partial, done, full) => {
        this.aiInsightText.set(full);
        if (done) {
          this.aiInsightLoading.set(false);
          this.addNotification('psychology', 'AI insight generated', 'purple');
        }
      });
    } catch (err) {
      this.aiInsightText.set('Failed to generate insight: ' + err);
      this.aiInsightLoading.set(false);
    }
  }

  private buildVisionContext(): string {
    const parts: string[] = [];
    parts.push(`Faces detected: ${this.vision.faceCount()}`);
    if (this.vision.faceCount() > 0) {
      parts.push(`Emotion: ${this.vision.emotion()}`);
      parts.push(`Gaze direction: ${this.vision.gaze()}`);
    }
    if (this.vision.gesture() !== 'None') {
      parts.push(
        `Gesture: ${this.gestureLabel(this.vision.gesture())} (${this.vision.gestureScore()}% confidence)`,
      );
    }
    if (this.vision.heartRate() > 0) {
      parts.push(`Heart rate: ~${this.vision.heartRate()} BPM`);
    }
    parts.push(`Engagement level: ${this.vision.engagement()}%`);
    const hands = this.vision.handLandmarks();
    if (hands.length > 0) {
      parts.push(`Hands detected: ${hands.length}`);
      const h = this.vision.handedness();
      if (h.length) parts.push(`Handedness: ${h.join(', ')}`);
    }
    const pose = this.vision.poseLandmarks();
    if (pose.length > 0) {
      parts.push('Body pose detected');
    }
    return parts.join('. ');
  }

  ngOnDestroy() {
    this.stopDrawLoop();
    this.vision.stopWebcam();
  }
}

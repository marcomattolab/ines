import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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

type InputMode = 'mouse' | 'pinch' | 'head';
type HeadClickMode = 'blink' | 'jaw';
type Player = 'X' | 'O';

const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

@Component({
  selector: 'app-tic-tac-toe-tab',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './tic-tac-toe-tab.component.html',
  styleUrl: './tic-tac-toe-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class TicTacToeTabComponent implements OnDestroy {
  private readonly mp = inject(MediaPipeTasksService);

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly cursor = viewChild.required<ElementRef<HTMLElement>>('cursor');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly overlay = viewChild.required<ElementRef<HTMLCanvasElement>>('overlay');

  protected readonly status = signal<'idle' | 'loading' | 'running'>('idle');
  protected readonly error = signal('');
  protected readonly mode = signal<InputMode>('mouse');
  protected readonly headClick = signal<HeadClickMode>('blink');
  protected readonly gain = signal(5);
  protected readonly blink = signal(0);
  protected readonly jaw = signal(0);
  protected readonly ratio = signal(0);
  protected readonly pinching = signal(false);
  protected readonly clicks = signal(0);

  protected readonly board = signal<(Player | null)[]>(Array(9).fill(null));
  protected readonly currentPlayer = signal<Player>('X');
  protected readonly score = signal<Record<Player, number>>({ X: 0, O: 0 });

  protected readonly cells = Array.from({ length: 9 }, (_, i) => i);
  protected readonly modes: ReadonlyArray<{ id: InputMode; label: string; icon: string }> = [
    { id: 'mouse', label: 'Mouse', icon: 'mouse' },
    { id: 'pinch', label: 'Pinch', icon: 'touch_app' },
    { id: 'head', label: 'Head', icon: 'face' },
  ];

  protected readonly winner = computed<{ player: Player; line: number[] } | null>(() => {
    const b = this.board();
    for (const [a, c, d] of LINES) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) {
        return { player: b[a] as Player, line: [a, c, d] };
      }
    }
    return null;
  });

  protected readonly isDraw = computed(
    () => !this.winner() && this.board().every((c) => c !== null),
  );

  protected readonly gameOver = computed(() => !!this.winner() || this.isDraw());

  protected readonly winningCells = computed(() => new Set(this.winner()?.line ?? []));

  protected readonly statusText = computed(() => {
    const w = this.winner();
    if (w) return `${w.player} wins the round!`;
    if (this.isDraw()) return "It's a draw — no more moves";
    return `${this.currentPlayer()}'s turn`;
  });

  private face: any = null;
  private landmarker: any = null;
  private drawing: any = null;
  private connections: any = null;
  private camera: CameraHandle | null = null;
  private stopLoop: (() => void) | null = null;
  private lastTime = -1;
  private last = { x: 0.5, y: 0.5 };
  private center?: { x: number; y: number };
  private pos?: { x: number; y: number };
  private closedSince = 0;
  private fired = false;
  private jawWasOpen = false;
  private pinchOn = false;
  private press = { t: 0, x: 0, y: 0 };

  protected setMode(m: InputMode): void {
    if (this.mode() === m) return;
    const wasRunning = this.status() === 'running';
    if (wasRunning) this.release();
    this.mode.set(m);
    this.cursor().nativeElement.style.opacity = '0';
    if (wasRunning) void this.start();
  }

  protected onHeadClick(e: Event): void {
    this.headClick.set((e.target as HTMLSelectElement).value as HeadClickMode);
  }

  protected onGain(e: Event): void {
    this.gain.set(Number((e.target as HTMLInputElement).value));
  }

  protected calibrate(): void {
    this.center = { ...this.last };
  }

  protected place(i: number): void {
    if (this.gameOver() || this.board()[i]) return;
    const next = [...this.board()];
    next[i] = this.currentPlayer();
    this.board.set(next);

    const w = this.winner();
    if (w) {
      this.score.update((s) => ({ ...s, [w.player]: s[w.player] + 1 }));
      return;
    }
    this.currentPlayer.update((p) => (p === 'X' ? 'O' : 'X'));
  }

  protected reset(): void {
    this.board.set(Array(9).fill(null));
    this.currentPlayer.set('X');
  }

  protected resetScore(): void {
    this.score.set({ X: 0, O: 0 });
  }

  async start(): Promise<void> {
    if (this.mode() === 'mouse') return;
    this.error.set('');
    this.status.set('loading');
    try {
      if (this.mode() === 'pinch') {
        const hand = await this.mp.hand();
        this.landmarker = hand.landmarker;
        this.connections = hand.connections;
        this.drawing = new hand.drawingCtor(this.overlay().nativeElement.getContext('2d'));
      } else {
        this.face = await this.mp.face();
      }
      this.camera = await startCamera(this.video().nativeElement);
      this.status.set('running');
      this.pos = undefined;
      this.center = undefined;
      this.closedSince = 0;
      this.fired = false;
      this.jawWasOpen = false;
      this.pinchOn = false;
      this.pinching.set(false);
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
    this.face?.close();
    this.face = null;
    this.landmarker?.close();
    this.landmarker = null;
    this.drawing = null;
    this.connections = null;
  }

  private tick(): void {
    const video = this.video().nativeElement;
    if (video.readyState < 2 || video.currentTime === this.lastTime) return;
    this.lastTime = video.currentTime;

    const rect = this.stage().nativeElement.getBoundingClientRect();
    const cursor = this.cursor().nativeElement;

    if (this.mode() === 'pinch') this.tickPinch(video, cursor, rect);
    else this.tickHead(video, cursor, rect);
  }

  private tickPinch(video: HTMLVideoElement, cursor: HTMLElement, rect: DOMRect): void {
    if (!this.landmarker) return;
    const res = this.landmarker.detectForVideo(video, performance.now());

    const canvas = this.overlay().nativeElement;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);

    const hand = res.landmarks[0];
    if (!hand) {
      this.pinchOn = false;
      this.pinching.set(false);
      cursor.style.opacity = '0';
      return;
    }
    this.drawing?.drawConnectors(hand, this.connections, { color: '#ffffff', lineWidth: 2 });
    this.drawing?.drawLandmarks(hand, { color: '#56d9ff', radius: 3 });

    const thumb = hand[4];
    const index = hand[8];
    const size = Math.hypot(hand[0].x - hand[9].x, hand[0].y - hand[9].y) || 1;
    const ratio = Math.hypot(thumb.x - index.x, thumb.y - index.y) / size;
    this.ratio.set(Math.round(ratio * 100) / 100);
    const on = this.pinchOn ? ratio < 0.42 : ratio < 0.28;

    const tx = clamp((1 - (thumb.x + index.x) / 2 - 0.12) / 0.76);
    const ty = clamp(((thumb.y + index.y) / 2 - 0.12) / 0.76);
    this.pos = this.pos
      ? { x: this.pos.x + (tx - this.pos.x) * 0.4, y: this.pos.y + (ty - this.pos.y) * 0.4 }
      : { x: tx, y: ty };

    cursor.style.opacity = '1';
    cursor.style.transform = `translate(${this.pos.x * rect.width}px, ${this.pos.y * rect.height}px)`;

    const now = performance.now();
    if (on && !this.pinchOn) {
      this.press = { t: now, x: this.pos.x, y: this.pos.y };
    } else if (!on && this.pinchOn && now - this.press.t < 450) {
      this.clickAt(rect, this.press.x, this.press.y);
    }
    this.pinchOn = on;
    this.pinching.set(on);
  }

  private tickHead(video: HTMLVideoElement, cursor: HTMLElement, rect: DOMRect): void {
    if (!this.face) return;
    const res = this.face.detectForVideo(video, performance.now());
    const nose = res.faceLandmarks[0]?.[1];
    if (!nose) {
      cursor.style.opacity = '0';
      return;
    }

    this.last = { x: 1 - nose.x, y: nose.y };
    this.center ??= { ...this.last };
    const g = this.gain();
    const tx = clamp(0.5 + (this.last.x - this.center.x) * g);
    const ty = clamp(0.5 + (this.last.y - this.center.y) * g * 1.4);
    this.pos = this.pos
      ? { x: this.pos.x + (tx - this.pos.x) * 0.25, y: this.pos.y + (ty - this.pos.y) * 0.25 }
      : { x: tx, y: ty };

    cursor.style.opacity = '1';
    cursor.style.transform = `translate(${this.pos.x * rect.width}px, ${this.pos.y * rect.height}px)`;

    const cats = res.faceBlendshapes[0]?.categories ?? [];
    const score = (name: string) => cats.find((c: any) => c.categoryName === name)?.score ?? 0;
    const blink = Math.min(score('eyeBlinkLeft'), score('eyeBlinkRight'));
    const jaw = score('jawOpen');
    this.blink.set(Math.round(blink * 100) / 100);
    this.jaw.set(Math.round(jaw * 100) / 100);

    const now = performance.now();
    if (this.headClick() === 'blink') {
      if (blink > 0.55) {
        this.closedSince ||= now;
        if (!this.fired && now - this.closedSince > 500) {
          this.fired = true;
          this.clickAt(rect, this.pos.x, this.pos.y);
        }
      } else {
        this.closedSince = 0;
        this.fired = false;
      }
    } else {
      const open = jaw > 0.5;
      if (open && !this.jawWasOpen) this.clickAt(rect, this.pos.x, this.pos.y);
      this.jawWasOpen = open;
    }
  }

  private clickAt(rect: DOMRect, x: number, y: number): void {
    const px = rect.left + x * rect.width;
    const py = rect.top + y * rect.height;
    const target = document.elementFromPoint(px, py)?.closest<HTMLElement>('button');
    if (!target) return;
    target.click();
    this.clicks.update((n) => n + 1);
    const c = this.cursor().nativeElement;
    c.classList.remove('tap');
    void c.offsetWidth;
    c.classList.add('tap');
  }
}

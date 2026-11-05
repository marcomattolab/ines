import { Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { SettingsService } from '../../core/services/settings.service';
import { SpeechService } from '../../core/services/speech.service';
import { ToastService } from '../../core/services/toast.service';

const HAND_LANDMARKER_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision';

/** Same DB/store used by VisionService so the hand model is downloaded once. */
const VISION_DB_NAME = 'InesVisionCacheDB';
const VISION_DB_VERSION = 1;
const VISION_STORE = 'models';

interface Point {
  x: number;
  y: number;
}

interface Gesture {
  id: string;
  name: string;
  /** Parola o espressione in siciliano. */
  sicilian: string;
  meaning: string;
  emoji: string;
  /** Esegue l'azione e restituisce il testo da registrare (o null). */
  action: () => string | null;
}

interface LogEntry {
  id: number;
  emoji: string;
  text: string;
  time: string;
}

const SICILIAN_PHRASES = [
  'Chi voi? Non ti capisco!',
  'Bedda matri, che caldo!',
  'Veni cca, ti devo dire una cosa.',
  'Minchia, che bello!',
  'Unn è? Dove vai di fretta?',
  'Ma chi si? Chi ti credi di essere?',
  'Nun mi rumpiri i scatuli!',
  'Nenti, nun è nenti.',
  'Sta attentu, ca cadi!',
  'Ammuccia, ca veni u maistru!',
];

const STABLE_FRAMES = 5;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

@Component({
  selector: 'app-sicilian-gestures-tab',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './sicilian-gestures-tab.component.html',
  styleUrl: './sicilian-gestures-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class SicilianGesturesTabComponent implements OnDestroy {
  private readonly settings = inject(SettingsService);
  private readonly speech = inject(SpeechService);
  private readonly toast = inject(ToastService);

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly overlay = viewChild.required<ElementRef<HTMLCanvasElement>>('overlay');

  protected readonly status = signal<'idle' | 'loading' | 'running'>('idle');
  protected readonly error = signal('');
  protected readonly current = signal<string | null>(null);
  protected readonly likes = signal(0);
  protected readonly voice = signal(true);
  protected readonly log = signal<LogEntry[]>([]);

  protected readonly gestures: Gesture[] = [
    {
      id: 'open',
      name: 'Mano aperta',
      sicilian: 'Basta!',
      meaning: 'Fermati / Basta',
      emoji: '🖐',
      action: () => {
        this.stop();
        return 'Ferma la webcam';
      },
    },
    {
      id: 'fist',
      name: 'Pugno',
      sicilian: 'Nienti!',
      meaning: 'Niente / Chiudi',
      emoji: '✊',
      action: () => {
        this.log.set([]);
        return null;
      },
    },
    {
      id: 'horns',
      name: 'Corna',
      sicilian: 'Si u bàbbaluci!',
      meaning: 'Contro il malocchio',
      emoji: '🤘',
      action: () => {
        this.settings.lightTheme.update((v) => !v);
        return this.settings.lightTheme()
          ? 'Tema chiaro attivato'
          : 'Tema scuro attivato: protezione dal malocchio';
      },
    },
    {
      id: 'pigna',
      name: 'A pigna',
      sicilian: 'Chì booi?',
      meaning: 'Che vuoi? / Ma chi ti credi?',
      emoji: '🤌',
      action: () => SICILIAN_PHRASES[Math.floor(Math.random() * SICILIAN_PHRASES.length)],
    },
    {
      id: 'thumbup',
      name: 'Pollice su',
      sicilian: 'Braaavu!',
      meaning: 'Tutto a posto / Bravo',
      emoji: '👍',
      action: () => {
        this.likes.update((n) => n + 1);
        return 'Mi piace +1';
      },
    },
    {
      id: 'thumbdown',
      name: 'Pollice giù',
      sicilian: 'Mi siddìia!',
      meaning: 'Non mi va',
      emoji: '👎',
      action: () => {
        this.likes.update((n) => n - 1);
        return 'Mi piace −1';
      },
    },
    {
      id: 'peace',
      name: 'V di pace',
      sicilian: 'Pigghiamouni u cafè!',
      meaning: 'Pace',
      emoji: '✌️',
      action: () => this.copyToClipboard('Paci!'),
    },
    {
      id: 'one',
      name: 'Indice su',
      sicilian: 'Staccùra!',
      meaning: 'Attento / Ascolta',
      emoji: '☝️',
      action: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return 'Scorri in cima alla pagina';
      },
    },
    {
      id: 'call',
      name: 'Telefono',
      sicilian: 'Ti chiamu!',
      meaning: 'Ti chiamo',
      emoji: '🤙',
      action: () => this.copyToClipboard('Ti chiamu!'),
    },
    {
      id: 'ok',
      name: 'OK',
      sicilian: 'Ok, Un ci su probblemi!',
      meaning: 'Va bene / Perfetto',
      emoji: '👌',
      action: () => {
        this.toast.success('Ok, Un ci su probblemi!');
        return 'Ok, Un ci su probblemi!';
      },
    },
    {
      id: 'crossed',
      name: 'Dita incrociate',
      sicilian: 'Speriaaaaamo!',
      meaning: 'Buona fortuna / Speriamo',
      emoji: '🤞',
      action: () => this.copyToClipboard('Speriaaaaamo!'),
    },
    {
      id: 'gun',
      name: 'Pistola',
      sicilian: 'Forza Palermo!',
      meaning: 'Forza Palermo',
      emoji: '🔫',
      action: () => {
        this.toast.show('Bang! Forza Palermo 💥');
        return 'Bang!';
      },
    },
  ];

  private readonly byId = new Map(this.gestures.map((g) => [g.id, g]));

  private landmarker: any = null;
  private drawing: any = null;
  private camera: { stop: () => void } | null = null;
  private stopLoop: (() => void) | null = null;
  private lastTime = -1;
  private heldId: string | null = null;
  private heldFrames = 0;
  private lastId: string | null = null;
  private logId = 0;
  /** Smussamento temporale delle classificazioni (voto a maggioranza sulle ultime 3). */
  private recent: (string | null)[] = [];

  protected onVoice(e: Event): void {
    this.voice.set((e.target as HTMLInputElement).checked);
  }

  protected currentGesture(): Gesture | null {
    const id = this.current();
    return id ? (this.byId.get(id) ?? null) : null;
  }

  protected currentLabel(): string {
    const g = this.currentGesture();
    return g ? `${g.emoji} ${g.sicilian}` : 'Mano non rilevata';
  }

  protected clear(): void {
    this.log.set([]);
    this.likes.set(0);
  }

  private copyToClipboard(text: string): string {
    const p = navigator.clipboard?.writeText(text);
    if (p) {
      void p
        .then(() => this.toast.success(`Copiato: ${text}`))
        .catch(() => this.toast.error('Impossibile copiare'));
    } else {
      this.toast.error('Copiare non è disponibile');
    }
    return `Copia «${text}» negli appunti`;
  }

  async start(): Promise<void> {
    this.error.set('');
    this.status.set('loading');
    try {
      this.landmarker = await this.createLandmarker();
      this.camera = await this.startCamera(this.video().nativeElement);
      this.drawing = this.createDrawingUtils();
      this.status.set('running');
      this.stopLoop = this.frameLoop(() => this.tick());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
      this.release();
      this.status.set('idle');
    }
  }

  stop(): void {
    this.release();
    this.heldId = null;
    this.heldFrames = 0;
    this.current.set(null);
    this.recent = [];
    this.status.set('idle');
  }

  ngOnDestroy(): void {
    this.release();
    this.speech.stop();
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

  private async createLandmarker(): Promise<any> {
    const vision = await new Function('url', 'return import(url)')(MEDIAPIPE_CDN);
    const { FilesetResolver, HandLandmarker, DrawingUtils } = vision;
    this.drawingCtor = DrawingUtils;
    this.handConnections = HandLandmarker.HAND_CONNECTIONS;
    const fileset = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_CDN}/wasm`);
    const buffer = await this.getModelBuffer(HAND_LANDMARKER_URL);
    const create = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: buffer, delegate },
        runningMode: 'VIDEO',
        numHands: 1,
      });
    try {
      return await create('GPU');
    } catch {
      return create('CPU');
    }
  }

  private drawingCtor: any = null;
  private handConnections: any = null;

  private createDrawingUtils(): any {
    const ctx = this.overlay().nativeElement.getContext('2d');
    return ctx ? new this.drawingCtor(ctx) : null;
  }

  private startCamera(video: HTMLVideoElement): Promise<{ stop: () => void }> {
    if (!navigator.mediaDevices?.getUserMedia) {
      return Promise.reject(new Error('Webcam non disponibile: serve HTTPS oppure localhost.'));
    }
    return navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      .then((stream) => {
        video.srcObject = stream;
        return video.play().then(() => ({
          stop: () => {
            stream.getTracks().forEach((t) => t.stop());
            video.srcObject = null;
          },
        }));
      });
  }

  private frameLoop(cb: () => void): () => void {
    let id = 0;
    let on = true;
    const tick = () => {
      if (!on) return;
      cb();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => {
      on = false;
      cancelAnimationFrame(id);
    };
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

    const hand = res.landmarks[0];
    if (!hand) {
      this.heldId = null;
      this.heldFrames = 0;
      this.current.set(null);
      this.recent = [];
      return;
    }
    this.drawing?.drawConnectors(hand, this.handConnections, { color: '#ffffff', lineWidth: 2 });
    this.drawing?.drawLandmarks(hand, { color: '#3b5bff', radius: 3 });

    // Classificazione statica smussata con voto a maggioranza (3 frame) per ridurre i falsi scatti.
    this.recent.push(this.classify(hand));
    if (this.recent.length > 3) this.recent.shift();
    const id = this.majority(this.recent);

    if (id !== this.heldId) {
      this.heldId = id;
      this.heldFrames = 0;
    }
    this.heldFrames++;
    this.current.set(id);

    if (id && this.heldFrames === STABLE_FRAMES && id !== this.lastId) {
      this.lastId = id;
      this.trigger(id);
    }
    if (!id && this.heldFrames >= STABLE_FRAMES * 2) this.lastId = null;
  }

  private majority(ids: (string | null)[]): string | null {
    const counts = new Map<string, number>();
    for (const id of ids) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    let best: string | null = null;
    let bestN = 0;
    for (const [id, n] of counts)
      if (n > bestN) {
        bestN = n;
        best = id;
      }
    return bestN >= 2 ? best : null;
  }

  private classify(lm: Point[]): string | null {
    const wrist = lm[0];
    const scale = Math.max(dist(lm[0], lm[9]), 1e-4);
    const extended = (tip: number, pip: number) => dist(lm[tip], wrist) > dist(lm[pip], wrist);

    // Il pollice è "teso" se la punta è lontana dall'attaccatura dell'indice (lm[5]);
    // quando è piegato sul palmo la punta resta vicino alle nocche. Molto più affidabile
    // del confronto punta/polso, che scambiava "indice su" con "pistola".
    const thumb = dist(lm[4], lm[5]) > scale * 0.6;
    const index = extended(8, 6);
    const middle = extended(12, 10);
    const ring = extended(16, 14);
    const pinky = extended(20, 18);

    const fingersFolded = !index && !middle && !ring && !pinky;

    // "A pigna" (che vuoi?): tutte e cinque le punte convergono in un punto.
    // Includendo il pollice si evita di confonderla con l'OK.
    const fiveTips = [lm[4], lm[8], lm[12], lm[16], lm[20]];
    let fiveSpread = 0;
    for (let i = 0; i < fiveTips.length; i++)
      for (let j = i + 1; j < fiveTips.length; j++)
        fiveSpread = Math.max(fiveSpread, dist(fiveTips[i], fiveTips[j]));

    if (!fingersFolded && fiveSpread < scale * 0.45) return 'pigna';

    if (fingersFolded) {
      // Pollice su/giù: le altre quattro dita sono chiuse. Soglia proporzionale alla mano.
      if (thumb && lm[4].y < wrist.y - scale * 0.5) return 'thumbup';
      if (thumb && lm[4].y > wrist.y + scale * 0.5) return 'thumbdown';
      return 'fist';
    }

    // Telefono: pollice e mignolo tesi, indice, medio e anulare chiusi.
    if (thumb && pinky && !index && !middle && !ring) return 'call';

    // Pistola: pollice e indice tesi, le altre tre dita chiuse.
    if (thumb && index && !middle && !ring && !pinky) return 'gun';

    // OK: pollice e indice formano un anello, le altre tre dita sono aperte.
    if (thumb && middle && ring && pinky && dist(lm[4], lm[8]) < scale * 0.3) return 'ok';

    if (thumb && index && middle && ring && pinky) return 'open';
    if (index && pinky && !middle && !ring) return 'horns';
    if (index && middle && !ring && !pinky) {
      // Dita incrociate: punte sovrapposte; V di pace: punte separate.
      return dist(lm[8], lm[12]) < scale * 0.35 ? 'crossed' : 'peace';
    }
    if (index && !middle && !ring && !pinky) return 'one';
    return null;
  }

  private trigger(id: string): void {
    const g = this.byId.get(id);
    if (!g) return;
    const text = g.action();
    if (text) {
      this.log.update((l) =>
        [
          { id: ++this.logId, emoji: g.emoji, text, time: new Date().toLocaleTimeString('it-IT') },
          ...l,
        ].slice(0, 30),
      );
    }
    if (this.voice())
      this.speech.speak('sicilian-gestures', `${g.sicilian}. ${g.meaning}.`, 'it-IT');
  }

  // --- Model caching (shared with VisionService's IndexedDB) ---

  private async getModelBuffer(url: string): Promise<Uint8Array> {
    const cached = await this.getCachedVisionModel(url);
    if (cached) return new Uint8Array(cached);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch hand model from ${url} (Status: ${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    try {
      await this.saveVisionModelToCache(url, buffer);
    } catch (e) {
      console.warn('Failed to cache hand model in IndexedDB:', e);
    }
    return new Uint8Array(buffer);
  }

  private openVisionDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(VISION_DB_NAME, VISION_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(VISION_STORE)) {
          db.createObjectStore(VISION_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getCachedVisionModel(url: string): Promise<ArrayBuffer | null> {
    try {
      const db = await this.openVisionDB();
      const tx = db.transaction(VISION_STORE, 'readonly');
      const request = tx.objectStore(VISION_STORE).get(url);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result?.buffer ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  private async saveVisionModelToCache(url: string, buffer: ArrayBuffer): Promise<void> {
    try {
      const db = await this.openVisionDB();
      const tx = db.transaction(VISION_STORE, 'readwrite');
      tx.objectStore(VISION_STORE).put({ buffer }, url);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }
}

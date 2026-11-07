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
import { CaptioningService } from '../../core/services/captioning.service';
import { OcrService } from '../../core/services/ocr.service';
import { SpeechService } from '../../core/services/speech.service';
import { CameraHandle, errorMessage, startCamera } from '../../core/services/camera';
import { joinWords } from '../../core/services/pii';

type Mode = 'caption' | 'ocr';

const VOICE_KEY = 'ines.vision-assist.voice';

@Component({
  selector: 'app-vision-assist-tab',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './vision-assist-tab.component.html',
  styleUrl: './vision-assist-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0' },
})
export class VisionAssistTabComponent implements OnDestroy {
  protected readonly caption = inject(CaptioningService);
  protected readonly ocr = inject(OcrService);
  private readonly speech = inject(SpeechService);

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly mode = signal<Mode>('caption');
  protected readonly voice = signal(true);
  protected readonly cameraOn = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal('');

  private readonly voicePrefs = signal<Record<string, string>>(this.readVoicePrefs());
  private readonly lang = computed(() => (this.mode() === 'caption' ? 'en-US' : 'it-IT'));
  protected readonly voices = computed(() =>
    this.speech.voices().filter((v) => {
      const l = v.lang.toLowerCase();
      return (
        l === this.lang().toLowerCase() || l.startsWith(this.lang().split('-')[0].toLowerCase())
      );
    }),
  );
  protected readonly selectedVoiceUri = computed(() => this.voicePrefs()[this.lang()] ?? '');

  private camera: CameraHandle | null = null;
  private bitmap?: ImageBitmap;

  protected onVoice(e: Event): void {
    this.voice.set((e.target as HTMLInputElement).checked);
  }

  protected onVoiceSelect(e: Event): void {
    const uri = (e.target as HTMLSelectElement).value;
    this.voicePrefs.update((prefs) => {
      const next = { ...prefs, [this.lang()]: uri };
      localStorage.setItem(VOICE_KEY, JSON.stringify(next));
      return next;
    });
  }

  protected previewVoice(): void {
    const sample =
      this.mode() === 'caption'
        ? 'This is how the selected voice sounds.'
        : 'This is how the selected voice sounds.';
    this.speech.speak('vision-assist-preview', sample, this.lang(), this.selectedVoiceUri());
  }

  protected async start(): Promise<void> {
    this.error.set('');
    try {
      this.camera = await startCamera(this.video().nativeElement);
      this.cameraOn.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected stop(): void {
    this.camera?.stop();
    this.camera = null;
    this.cameraOn.set(false);
  }

  ngOnDestroy(): void {
    this.stop();
    this.speech.stop();
  }

  protected async onFile(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.error.set('');
    try {
      this.bitmap = await createImageBitmap(file);
      this.paintBitmap();
      this.result.set('');
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  protected async analyze(): Promise<void> {
    this.error.set('');
    this.result.set('');
    this.busy.set(true);
    try {
      const canvas = this.canvas().nativeElement;
      if (this.bitmap) {
        this.paintBitmap();
      } else {
        if (!this.camera) await this.start();
        await this.ensureFrame();
        const video = this.video().nativeElement;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')!.drawImage(video, 0, 0);
      }

      if (this.mode() === 'caption') {
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.result.set(await this.caption.caption(imageData));
      } else {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Cannot read the image'))),
            'image/png',
          ),
        );
        const text = joinWords(await this.ocr.recognizeWords(blob)).text.trim();
        if (!text) this.error.set('No text recognized in the image.');
        else this.result.set(text);
      }

      if (this.voice() && this.result()) this.speak();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected speak(): void {
    this.speech.speak('vision-assist', this.result(), this.lang(), this.selectedVoiceUri());
  }

  private paintBitmap(): void {
    const b = this.bitmap;
    if (!b) return;
    const canvas = this.canvas().nativeElement;
    canvas.width = b.width;
    canvas.height = b.height;
    canvas.getContext('2d')!.drawImage(b, 0, 0);
  }

  private async ensureFrame(): Promise<void> {
    const v = this.video().nativeElement;
    const start = performance.now();
    while ((v.readyState < 2 || v.videoWidth === 0) && performance.now() - start < 5000) {
      await new Promise((r) => setTimeout(r, 60));
    }
    await new Promise((r) => setTimeout(r, 150));
    if (v.videoWidth === 0) throw new Error('The webcam has not produced a frame yet.');
  }

  private readVoicePrefs(): Record<string, string> {
    try {
      return (
        (JSON.parse(localStorage.getItem(VOICE_KEY) ?? 'null') as Record<string, string> | null) ??
        {}
      );
    } catch {
      return {};
    }
  }
}

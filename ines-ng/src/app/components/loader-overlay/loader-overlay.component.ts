import { Component, inject, input, output, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

/** Recommended on-device model, streamed straight from HuggingFace. */
const RECOMMENDED_MODEL_URL =
  'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-gpu.litertlm';
const RECOMMENDED_MODEL_NAME = 'gemma-4-E2B-it-gpu.litertlm';

@Component({
  selector: 'app-loader-overlay',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './loader-overlay.component.html',
  styleUrl: './loader-overlay.css',
})
export class LoaderOverlayComponent implements OnInit {
  visible = input<boolean>(true);
  closed = output<void>();

  readonly llm = inject(LlmService);
  readonly toast = inject(ToastService);

  showText = signal<boolean>(false);
  dragging = false;
  dropText = 'Drag and drop the model file here or click to select';
  cachedModelAvailable = signal(false);
  showSettings = signal(false);
  downloadingRecommended = signal(false);

  async ngOnInit() {
    this.cachedModelAvailable.set(await this.llm.hasCachedModel());
  }

  close() {
    this.closed.emit();
  }

  async clearCached() {
    try {
      await this.llm.clearModelCache();
      this.cachedModelAvailable.set(false);
      this.toast.show('Cached model cleared');
    } catch {
      this.toast.error('Failed to clear model cache');
    }
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.load(file);
  }

  onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.load(file);
  }

  private async load(file: File) {
    this.dropText = `📦 ${file.name} (${(file.size / 1024 / 1024).toFixed(0)} MB)`;
    try {
      await this.llm.initModel(file);
      setTimeout(() => this.closed.emit(), 600);
    } catch (err: any) {
      this.toast.error('Error loading model: ' + (err?.message ?? err));
    }
  }

  /** One-click onboarding: stream + cache the recommended model in-app. */
  async downloadRecommended() {
    if (this.llm.modelStatus() === 'loading' || this.downloadingRecommended()) return;
    this.downloadingRecommended.set(true);
    this.dropText = 'Downloading recommended model (Gemma 4 E2B, ~2.6 GB)...';
    try {
      await this.llm.initModelFromUrl(RECOMMENDED_MODEL_URL, RECOMMENDED_MODEL_NAME);
      setTimeout(() => this.closed.emit(), 600);
    } catch (err: any) {
      this.toast.error('Error downloading model: ' + (err?.message ?? err));
    } finally {
      this.downloadingRecommended.set(false);
    }
  }
}

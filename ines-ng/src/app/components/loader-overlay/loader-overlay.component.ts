import { Component, inject, input, output, ElementRef, ViewChild } from '@angular/core';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-loader-overlay',
  standalone: true,
  template: `
    @if (visible()) {
      <div id="loader-overlay">
        <div class="loader-logo">Intelligent Neural Edge System</div>
        <div class="loader-subtitle">ON-DEVICE · PRIVATE · ZERO CLOUD</div>

        <div class="loader-box">
          <h2>Load a local LLM model</h2>
          <p>
            This tool uses <strong>Google MediaPipe LLM Inference API</strong> to run models
            completely in the browser via WebGPU — no data sent to external servers.
          </p>

          <div class="model-steps">
            <div class="model-step">
              <div class="step-num">1</div>
              <div>Download a compatible model from HuggingFace:
                <br><a href="https://huggingface.co/litert-community/Gemma3-1B-IT" target="_blank">Gemma-3 1B IT (.task, ~1GB, recommended)</a>
                <br><a href="https://huggingface.co/google/gemma-3n-E2B-it-litert-lm" target="_blank">Gemma-3n E2B (.litertlm, ~2GB, multimodal)</a>
              </div>
            </div>
            <div class="model-step">
              <div class="step-num">2</div>
              <div>Drag and drop the .task or .litertlm file here (stays 100% local)</div>
            </div>
            <div class="model-step">
              <div class="step-num">3</div>
              <div>Requires Chrome/Edge with <strong>WebGPU enabled</strong></div>
            </div>
          </div>

          <div class="file-drop-zone"
               [class.drag-over]="dragging"
               (click)="fileInput.click()"
               (dragover)="$event.preventDefault(); dragging = true"
               (dragleave)="dragging = false"
               (drop)="onDrop($event)">
            <input #fileInput type="file" accept=".task,.litertlm,.bin"
                   style="display:none" (change)="onFileChange($event)">
            <div>{{ dropText }}</div>
          </div>

          @if (llm.modelStatus() === 'loading' || llm.progress().pct > 0) {
            <div class="progress-wrap">
              <div class="progress-track">
                <div class="progress-fill" [style.width.%]="llm.progress().pct"></div>
              </div>
              <div class="progress-text">
                <span>{{ llm.progress().label }}</span>
                <span>{{ llm.progress().pct }}%</span>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styleUrl: './loader-overlay.css'
})
export class LoaderOverlayComponent {
  visible = input<boolean>(true);
  closed  = output<void>();

  llm   = inject(LlmService);
  toast = inject(ToastService);

  dragging = false;
  dropText = '📦 Drag and drop the model file here or click to select';

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
      this.toast.show('❌ Error loading model: ' + (err?.message ?? err));
    }
  }
}

import { Component, inject, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LlmService } from '../../core/services/llm.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-loader-overlay',
  standalone: true,
  imports: [MatIconModule, ButtonComponent],
  templateUrl: './loader-overlay.component.html',
  styleUrl: './loader-overlay.css',
})
export class LoaderOverlayComponent {
  visible = input<boolean>(true);
  closed = output<void>();

  llm = inject(LlmService);
  toast = inject(ToastService);

  showText = signal<boolean>(false);
  dragging = false;
  dropText = 'Drag and drop the model file here or click to select';

  close() {
    this.closed.emit();
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
      this.toast.show('❌ Error loading model: ' + (err?.message ?? err));
    }
  }
}

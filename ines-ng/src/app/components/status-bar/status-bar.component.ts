import { Component, inject, output } from '@angular/core';
import { LlmService } from '../../core/services/llm.service';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  template: `
    <div id="status-bar">
      <div class="brand">
        <div class="brand-dot"></div>
        Ines
      </div>
      <div id="model-status">
        <div class="status-dot" [class]="llm.modelStatus()"></div>
        <span>
          @switch (llm.modelStatus()) {
            @case ('idle')    { No model loaded }
            @case ('loading') { Loading... }
            @case ('ready')   { ✓ {{ llm.modelName() }} }
            @case ('error')   { ✗ Error }
          }
        </span>
        <button class="pill-btn" style="margin-left:8px" (click)="openLoader.emit()">⚡ Load Model</button>
      </div>
    </div>
  `,
  styleUrl: './status-bar.css'
})
export class StatusBarComponent {
  llm = inject(LlmService);
  openLoader = output<void>();
}

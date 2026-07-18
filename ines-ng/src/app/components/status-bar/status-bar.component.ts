import { Component, inject, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { LlmService } from '../../core/services/llm.service';
import { SpeechService } from '../../core/services/speech.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [MatIcon, ButtonComponent],
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.css',
})
export class StatusBarComponent {
  readonly llm = inject(LlmService);
  readonly speech = inject(SpeechService);
  openLoader = output<void>();
  openInfo = output<void>();

  readonly isDictating = signal(false);

  toggleDictation() {
    if (this.speech.recording()) {
      this.speech.stopRecording();
      this.isDictating.set(false);
    } else {
      const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      const baseText = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? el.value : '';
      this.speech.startRecording(baseText, (text) => {
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          el.value = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      this.isDictating.set(true);
    }
  }
}

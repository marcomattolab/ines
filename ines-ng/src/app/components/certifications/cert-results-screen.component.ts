import { Component, input, output, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ExamResult } from '../../core/models/certification.model';

@Component({
  selector: 'app-cert-results-screen',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './cert-results-screen.component.html',
  styleUrls: ['./cert-shared.css', './cert-results-screen.component.css'],
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class CertResultsScreenComponent {
  readonly result = input.required<ExamResult>();

  readonly home = output<void>();
  readonly review = output<void>();
  readonly practiceWrong = output<void>();
  readonly retake = output<void>();

  readonly formattedTime = computed<string>(() => {
    const s = this.result().elapsedSeconds;
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}m ${secs}s`;
  });
}

import { Component, inject, output, signal, computed, effect } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CertificationExamService } from '../../core/services/certification-exam.service';
import { CertificationSoundService } from '../../core/services/certification-sound.service';
import { ExamResult } from '../../core/models/certification.model';

@Component({
  selector: 'app-cert-exam-screen',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './cert-exam-screen.component.html',
  styleUrls: ['./cert-shared.css', './cert-exam-screen.component.css'],
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class CertExamScreenComponent {
  protected readonly exam = inject(CertificationExamService);
  protected readonly sound = inject(CertificationSoundService);

  readonly cancel = output<void>();
  readonly finish = output<ExamResult>();

  readonly showConfirmFinishModal = signal<boolean>(false);
  readonly showQuestionPalette = signal<boolean>(false);

  constructor() {
    // When the countdown reaches zero the exam service finalizes the exam on
    // its own; make sure the UI follows through to the results screen.
    effect(
      () => {
        if (this.exam.isCompleted() && this.exam.result()) {
          this.finish.emit(this.exam.result()!);
        }
      },
      { allowSignalWrites: true },
    );
  }

  readonly formattedTime = computed<string>(() => {
    const s = this.exam.timeRemainingSeconds();
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  });

  readonly isTimeUrgent = computed<boolean>(() => this.exam.timeRemainingSeconds() < 300);
  readonly isTimeWarning = computed<boolean>(() => this.exam.timeRemainingSeconds() < 600);

  readonly unansweredCount = computed<number>(() => {
    const total = this.exam.questions().length;
    const answered = Object.keys(this.exam.selectedAnswers()).length;
    return total - answered;
  });

  readonly optionKeys = computed<string[]>(() => {
    const q = this.exam.currentQuestion();
    if (!q) return [];
    return Object.keys(q.options).sort();
  });

  onSelectOption(letter: string): void {
    this.sound.playSelectOption();
    this.exam.toggleOption(letter);
  }

  onFinishClick(): void {
    this.showConfirmFinishModal.set(true);
  }

  confirmFinish(): void {
    this.showConfirmFinishModal.set(false);
    const result = this.exam.finishExam();
    this.finish.emit(result);
  }

  cancelFinish(): void {
    this.showConfirmFinishModal.set(false);
  }
}

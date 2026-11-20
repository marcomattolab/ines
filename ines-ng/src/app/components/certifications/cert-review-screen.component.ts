import { Component, input, output, signal, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Question } from '../../core/models/certification.model';

@Component({
  selector: 'app-cert-review-screen',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './cert-review-screen.component.html',
  styleUrls: ['./cert-shared.css', './cert-review-screen.component.css'],
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class CertReviewScreenComponent {
  readonly questions = input.required<Question[]>();
  readonly userAnswers = input.required<Record<number, string[]>>();

  readonly back = output<void>();

  readonly currentIndex = signal<number>(0);
  readonly showDiscussion = signal<boolean>(false);

  readonly currentQuestion = computed<Question | null>(() => {
    const list = this.questions();
    return list[this.currentIndex()] || null;
  });

  readonly currentUserSelected = computed<string[]>(
    () => this.userAnswers()[this.currentIndex()] || [],
  );

  readonly isCorrect = computed<boolean>(() => {
    const q = this.currentQuestion();
    if (!q) return false;
    const user = this.currentUserSelected().sort().join('');
    const correct = q.correct_answer
      .replace(/[^A-Z]/gi, '')
      .split('')
      .sort()
      .join('');
    return user === correct;
  });

  readonly isUnanswered = computed<boolean>(() => this.currentUserSelected().length === 0);

  readonly optionKeys = computed<string[]>(() => {
    const q = this.currentQuestion();
    if (!q) return [];
    return Object.keys(q.options).sort();
  });

  readonly voteBars = computed<
    { letter: string; count: number; percentage: number; isCorrect: boolean }[]
  >(() => {
    const q = this.currentQuestion();
    if (!q || !q.vote_counts) return [];
    const total = Object.values(q.vote_counts).reduce((a, b) => a + b, 0);
    const correctClean = q.correct_answer.toUpperCase();
    return Object.entries(q.vote_counts)
      .sort((a, b) => b[1] - a[1])
      .map(([letter, count]) => ({
        letter,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        isCorrect: correctClean.includes(letter),
      }));
  });

  nextQuestion(): void {
    if (this.currentIndex() < this.questions().length - 1) {
      this.currentIndex.update((i) => i + 1);
      this.showDiscussion.set(false);
    }
  }

  prevQuestion(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.update((i) => i - 1);
      this.showDiscussion.set(false);
    }
  }
}

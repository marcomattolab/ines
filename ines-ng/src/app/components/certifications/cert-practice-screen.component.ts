import { Component, inject, input, output, signal, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Question } from '../../core/models/certification.model';
import { CertificationCatalogService } from '../../core/services/certification-catalog.service';
import { CertificationSoundService } from '../../core/services/certification-sound.service';

@Component({
  selector: 'app-cert-practice-screen',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './cert-practice-screen.component.html',
  styleUrls: ['./cert-shared.css', './cert-practice-screen.component.css'],
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class CertPracticeScreenComponent {
  private readonly catalog = inject(CertificationCatalogService);
  protected readonly sound = inject(CertificationSoundService);

  readonly questions = input.required<Question[]>();
  readonly context = input<'all' | 'wrong'>('all');

  readonly back = output<void>();

  readonly currentIndex = signal<number>(0);
  readonly selectedLetters = signal<Set<string>>(new Set());
  readonly answerRevealed = signal<boolean>(false);
  readonly showDiscussion = signal<boolean>(false);
  readonly showJumpModal = signal<boolean>(false);

  readonly currentQuestion = computed<Question | null>(() => {
    const list = this.questions();
    return list[this.currentIndex()] || null;
  });

  readonly isMultiChoice = computed<boolean>(() => {
    const q = this.currentQuestion();
    if (!q) return false;
    const text = q.question.toLowerCase();
    const correctLetters = q.correct_answer.replace(/[^A-Z]/gi, '');
    return (
      text.includes('choose two') || text.includes('choose three') || correctLetters.length > 1
    );
  });

  readonly maxSelections = computed<number>(() => {
    const q = this.currentQuestion();
    if (!q) return 1;
    const text = q.question.toLowerCase();
    if (text.includes('choose three')) return 3;
    if (text.includes('choose two')) return 2;
    const correctLetters = q.correct_answer.replace(/[^A-Z]/gi, '');
    if (correctLetters.length > 1) return correctLetters.length;
    return 1;
  });

  readonly optionKeys = computed<string[]>(() => {
    const q = this.currentQuestion();
    if (!q) return [];
    return Object.keys(q.options).sort();
  });

  readonly isCorrectVerdict = computed<boolean>(() => {
    const q = this.currentQuestion();
    if (!q) return false;
    const userSel = Array.from(this.selectedLetters()).sort().join('');
    const cleanCorrect = q.correct_answer
      .replace(/[^A-Z]/gi, '')
      .split('')
      .sort()
      .join('');
    return userSel === cleanCorrect;
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

  toggleOption(letter: string): void {
    if (this.answerRevealed()) return;

    this.sound.playSelectOption();
    const current = new Set(this.selectedLetters());
    const multi = this.isMultiChoice();
    const max = this.maxSelections();

    if (multi) {
      if (current.has(letter)) {
        current.delete(letter);
      } else {
        if (current.size >= max) {
          const first = current.values().next().value;
          if (first) current.delete(first);
        }
        current.add(letter);
      }
    } else {
      current.clear();
      current.add(letter);
    }
    this.selectedLetters.set(current);
  }

  revealAnswer(): void {
    if (this.selectedLetters().size === 0) return;
    this.answerRevealed.set(true);

    const isCorrect = this.isCorrectVerdict();
    if (isCorrect) {
      this.sound.playCorrect();
    } else {
      this.sound.playWrong();
    }

    const q = this.currentQuestion();
    if (q) {
      this.catalog.recordAnswer(q, Array.from(this.selectedLetters()), isCorrect);
    }
  }

  nextQuestion(): void {
    if (this.currentIndex() < this.questions().length - 1) {
      this.goToIndex(this.currentIndex() + 1);
    }
  }

  prevQuestion(): void {
    if (this.currentIndex() > 0) {
      this.goToIndex(this.currentIndex() - 1);
    }
  }

  jumpTo(index: number): void {
    this.showJumpModal.set(false);
    this.goToIndex(index);
  }

  goToIndex(index: number): void {
    this.currentIndex.set(index);
    this.selectedLetters.set(new Set());
    this.answerRevealed.set(false);
    this.showDiscussion.set(false);

    if (this.sound.enabled()) {
      this.sound.playBackground();
    }
  }
}

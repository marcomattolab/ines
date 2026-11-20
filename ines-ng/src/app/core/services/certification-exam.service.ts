import { Injectable, signal, computed } from '@angular/core';
import { Question, ExamConfig, ExamResult } from '../models/certification.model';

/**
 * State machine for a single exam simulation. Mirrors the exam service of the
 * aws-ai-practitioner trainer but is course-agnostic.
 */
@Injectable({ providedIn: 'root' })
export class CertificationExamService {
  readonly config = signal<ExamConfig>({ numQuestions: 65, passThreshold: 70 });
  readonly questions = signal<Question[]>([]);
  readonly currentIndex = signal<number>(0);
  readonly selectedAnswers = signal<Record<number, string[]>>({});
  readonly markedForReview = signal<Set<number>>(new Set());

  readonly elapsedSeconds = signal<number>(0);
  readonly totalTimeSeconds = signal<number>(90 * 60);
  readonly timeRemainingSeconds = computed(() =>
    Math.max(0, this.totalTimeSeconds() - this.elapsedSeconds()),
  );

  readonly isCompleted = signal<boolean>(false);
  readonly result = signal<ExamResult | null>(null);

  private timerInterval: ReturnType<typeof setInterval> | null = null;

  readonly currentQuestion = computed<Question | null>(() => {
    const list = this.questions();
    const idx = this.currentIndex();
    return list[idx] || null;
  });

  readonly isCurrentMarkedForReview = computed<boolean>(() =>
    this.markedForReview().has(this.currentIndex()),
  );

  readonly currentSelectedOptions = computed<string[]>(
    () => this.selectedAnswers()[this.currentIndex()] || [],
  );

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

  startExam(config: ExamConfig, pool: Question[]): void {
    this.config.set(config);
    this.cleanup();

    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(config.numQuestions, pool.length));

    this.questions.set(selected);
    this.currentIndex.set(0);
    this.selectedAnswers.set({});
    this.markedForReview.set(new Set());
    this.elapsedSeconds.set(0);
    this.isCompleted.set(false);
    this.result.set(null);

    // ~1.4 minutes per question, with a 15 minute floor.
    const minutes = Math.max(15, Math.round(selected.length * 1.4));
    this.totalTimeSeconds.set(minutes * 60);

    this.startTimer();
  }

  toggleOption(letter: string): void {
    const idx = this.currentIndex();
    const current = this.selectedAnswers()[idx] || [];
    const multi = this.isMultiChoice();
    const max = this.maxSelections();

    let next: string[];
    if (multi) {
      if (current.includes(letter)) {
        next = current.filter((l) => l !== letter);
      } else if (current.length >= max) {
        next = [...current.slice(1), letter];
      } else {
        next = [...current, letter];
      }
    } else {
      next = [letter];
    }

    this.selectedAnswers.set({ ...this.selectedAnswers(), [idx]: next.sort() });
  }

  toggleMarkForReview(): void {
    const idx = this.currentIndex();
    const marked = new Set(this.markedForReview());
    if (marked.has(idx)) {
      marked.delete(idx);
    } else {
      marked.add(idx);
    }
    this.markedForReview.set(marked);
  }

  goToQuestion(index: number): void {
    if (index >= 0 && index < this.questions().length) {
      this.currentIndex.set(index);
    }
  }

  nextQuestion(): void {
    if (this.currentIndex() < this.questions().length - 1) {
      this.currentIndex.update((i) => i + 1);
    }
  }

  prevQuestion(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.update((i) => i - 1);
    }
  }

  finishExam(): ExamResult {
    this.cleanupTimer();
    const list = this.questions();
    const answers = this.selectedAnswers();
    const total = list.length;

    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    const wrongQuestions: Question[] = [];

    list.forEach((q, idx) => {
      const userSelected = (answers[idx] || []).join('').toUpperCase();
      const correctClean = q.correct_answer.replace(/[^A-Z]/gi, '').toUpperCase();

      if (!userSelected) {
        unanswered++;
        wrongQuestions.push(q);
      } else if (userSelected === correctClean) {
        correct++;
      } else {
        incorrect++;
        wrongQuestions.push(q);
      }
    });

    const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
    // Certification-style scaled score: 100 to 1000.
    const scaledScore = Math.round(100 + (scorePct / 100) * 900);
    const passThreshold = this.config().passThreshold;
    const passed = scorePct >= passThreshold;

    const result: ExamResult = {
      totalQuestions: total,
      correctCount: correct,
      incorrectCount: incorrect,
      unansweredCount: unanswered,
      scorePercentage: scorePct,
      scaledScore,
      passed,
      passThreshold,
      elapsedSeconds: this.elapsedSeconds(),
      wrongQuestions,
    };

    this.isCompleted.set(true);
    this.result.set(result);
    return result;
  }

  private startTimer(): void {
    this.cleanupTimer();
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds.update((s) => s + 1);
      if (this.timeRemainingSeconds() <= 0) {
        this.finishExam();
      }
    }, 1000);
  }

  private cleanupTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  cleanup(): void {
    this.cleanupTimer();
  }
}

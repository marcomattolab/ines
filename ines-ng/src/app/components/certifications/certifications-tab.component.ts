import { Component, inject, signal, computed } from '@angular/core';
import {
  CertScreenMode,
  ExamConfig,
  ExamResult,
  Question,
} from '../../core/models/certification.model';
import { CertificationCatalogService } from '../../core/services/certification-catalog.service';
import { CertificationExamService } from '../../core/services/certification-exam.service';
import { CertificationSoundService } from '../../core/services/certification-sound.service';
import { CertCatalogScreenComponent } from './cert-catalog-screen.component';
import { CertHomeScreenComponent } from './cert-home-screen.component';
import { CertExamSetupComponent } from './cert-exam-setup.component';
import { CertPracticeScreenComponent } from './cert-practice-screen.component';
import { CertExamScreenComponent } from './cert-exam-screen.component';
import { CertResultsScreenComponent } from './cert-results-screen.component';
import { CertReviewScreenComponent } from './cert-review-screen.component';

/**
 * Certification Hub — course-agnostic exam trainer.
 *
 * This is the tab-level orchestrator and mirrors the screen state machine of
 * the aws-ai-practitioner app (home → setup/practice/exam → results → review),
 * extended with a course catalog as the entry point.
 */
@Component({
  selector: 'app-certifications-tab',
  standalone: true,
  imports: [
    CertCatalogScreenComponent,
    CertHomeScreenComponent,
    CertExamSetupComponent,
    CertPracticeScreenComponent,
    CertExamScreenComponent,
    CertResultsScreenComponent,
    CertReviewScreenComponent,
  ],
  templateUrl: './certifications-tab.component.html',
  styleUrl: './certifications-tab.component.css',
  host: { class: 'flex flex-1 overflow-hidden min-w-0 h-full' },
})
export class CertificationsTabComponent {
  private readonly catalog = inject(CertificationCatalogService);
  private readonly exam = inject(CertificationExamService);
  private readonly sound = inject(CertificationSoundService);

  readonly screen = signal<CertScreenMode>('catalog');
  readonly practiceContext = signal<'all' | 'wrong'>('all');
  readonly practiceQuestions = signal<Question[]>([]);
  readonly examResult = signal<ExamResult | null>(null);
  readonly reviewQuestions = signal<Question[]>([]);
  readonly reviewAnswers = signal<Record<number, string[]>>({});

  /** Course accent color (falls back to the INES blue). */
  readonly accent = computed(() => this.catalog.activeCourse()?.accent ?? 'var(--accent-blue)');

  openCourse(id: string): void {
    this.sound.stopAll();
    this.exam.cleanup();
    // selectCourse sets the active course + stats synchronously, then loads questions.
    void this.catalog.selectCourse(id);
    this.screen.set('course-home');
  }

  backToCatalog(): void {
    this.sound.stopAll();
    this.exam.cleanup();
    this.screen.set('catalog');
  }

  goCourseHome(): void {
    this.sound.stopAll();
    this.exam.cleanup();
    this.screen.set('course-home');
  }

  openExamSetup(): void {
    this.screen.set('exam-setup');
  }

  startPractice(context: 'all' | 'wrong'): void {
    let questions =
      context === 'wrong' ? this.catalog.getFailedQuestions() : this.catalog.questions();
    let effectiveContext = context;
    if (questions.length === 0) {
      questions = this.catalog.questions();
      effectiveContext = 'all';
    }
    this.practiceContext.set(effectiveContext);
    this.practiceQuestions.set(questions);
    this.screen.set('practice');
  }

  startExam(config: ExamConfig): void {
    this.sound.stopAll();
    this.exam.startExam(config, this.catalog.questions());
    this.screen.set('exam');
  }

  cancelExam(): void {
    this.sound.stopAll();
    this.exam.cleanup();
    this.screen.set('course-home');
  }

  onExamFinished(result: ExamResult): void {
    this.examResult.set(result);
    this.screen.set('results');
  }

  reviewExam(): void {
    this.reviewQuestions.set(this.exam.questions());
    this.reviewAnswers.set(this.exam.selectedAnswers());
    this.screen.set('review');
  }

  backToResults(): void {
    this.screen.set('results');
  }

  retakeExam(): void {
    this.exam.startExam(this.exam.config(), this.catalog.questions());
    this.screen.set('exam');
  }

  practiceWrongFromResult(): void {
    const wrong = this.examResult()?.wrongQuestions ?? [];
    this.practiceContext.set('wrong');
    this.practiceQuestions.set(wrong.length > 0 ? wrong : this.catalog.questions());
    this.screen.set('practice');
  }
}

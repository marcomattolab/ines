import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CourseDefinition, Question, AnswerHistoryItem } from '../models/certification.model';

const CATALOG_URL = 'certifications/courses.json';
const ACTIVE_COURSE_KEY = 'ines_cert_active_course';

const historyKey = (id: string) => `ines_cert_${id}_history`;
const wrongKey = (id: string) => `ines_cert_${id}_wrong`;

/**
 * Loads the certification course catalog and, for the active course, the
 * question bank. Progress (answer history + failed question ids) is persisted
 * per course in localStorage so each course keeps its own statistics.
 */
@Injectable({ providedIn: 'root' })
export class CertificationCatalogService {
  private readonly http = inject(HttpClient);

  readonly courses = signal<CourseDefinition[]>([]);
  readonly loadingCourses = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  readonly activeCourseId = signal<string | null>(this.loadActiveCourseId());
  readonly activeCourse = computed<CourseDefinition | null>(
    () => this.courses().find((c) => c.id === this.activeCourseId()) ?? null,
  );

  readonly questions = signal<Question[]>([]);
  readonly loadingQuestions = signal<boolean>(false);
  readonly questionError = signal<string | null>(null);

  readonly answerHistory = signal<Record<string, AnswerHistoryItem>>({});
  readonly failedUrls = signal<Set<string>>(new Set());

  readonly totalQuestions = computed(() => this.questions().length);
  readonly answeredCount = computed(() => Object.keys(this.answerHistory()).length);
  readonly failedCount = computed(() => this.failedUrls().size);
  readonly correctCount = computed(() => {
    let count = 0;
    for (const item of Object.values(this.answerHistory())) {
      if (item.isCorrect) count++;
    }
    return count;
  });
  readonly accuracyPercentage = computed(() => {
    const total = this.answeredCount();
    if (total === 0) return 0;
    return Math.round((this.correctCount() / total) * 100);
  });

  private questionsCache = new Map<string, Question[]>();

  constructor() {
    void this.loadCourses();
  }

  async loadCourses(): Promise<CourseDefinition[]> {
    if (this.courses().length > 0) return this.courses();
    this.loadingCourses.set(true);
    this.error.set(null);

    try {
      const data = await firstValueFrom(this.http.get<CourseDefinition[]>(CATALOG_URL));
      this.courses.set(data || []);
      const activeId = this.activeCourseId();
      if (activeId) {
        void this.loadQuestionsForCourse(activeId);
      }
      return data || [];
    } catch (err) {
      console.error('Failed to load certification catalog:', err);
      this.error.set('Could not load certification catalog. Check certifications/courses.json.');
      return [];
    } finally {
      this.loadingCourses.set(false);
    }
  }

  /** Select a course and load its question bank + persisted progress. */
  async selectCourse(id: string): Promise<void> {
    this.activeCourseId.set(id);
    this.saveActiveCourseId(id);
    this.loadStatsForCourse(id);
    await this.loadQuestionsForCourse(id);
  }

  async loadQuestionsForCourse(id: string): Promise<Question[]> {
    const cached = this.questionsCache.get(id);
    if (cached) {
      if (this.activeCourseId() === id) {
        this.questions.set(cached);
        this.loadingQuestions.set(false);
        this.questionError.set(null);
      }
      return cached;
    }

    const course = this.courses().find((c) => c.id === id);
    if (!course) return [];

    if (this.activeCourseId() === id) {
      this.loadingQuestions.set(true);
      this.questionError.set(null);
    }

    try {
      const data = await firstValueFrom(this.http.get<Question[]>(course.fileName));
      const list = data || [];
      this.questionsCache.set(id, list);
      if (this.activeCourseId() === id) {
        this.questions.set(list);
      }
      return list;
    } catch (err) {
      console.error(`Failed to load questions for "${id}":`, err);
      if (this.activeCourseId() === id) {
        this.questions.set([]);
        this.questionError.set(
          `Could not load questions for "${course.name}". Check ${course.fileName}.`,
        );
      }
      return [];
    } finally {
      if (this.activeCourseId() === id) {
        this.loadingQuestions.set(false);
      }
    }
  }

  recordAnswer(question: Question, selected: string[], isCorrect: boolean): void {
    const id = this.activeCourseId();
    if (!id) return;

    const key = question.url || question.question_no;

    const history = { ...this.answerHistory() };
    history[key] = { selected, isCorrect, timestamp: Date.now() };
    this.answerHistory.set(history);
    this.saveHistory(id, history);

    const failed = new Set(this.failedUrls());
    if (isCorrect) {
      failed.delete(key);
    } else {
      failed.add(key);
    }
    this.failedUrls.set(failed);
    this.saveFailedUrls(id, failed);
  }

  getFailedQuestions(): Question[] {
    const failedSet = this.failedUrls();
    return this.questions().filter((q) => failedSet.has(q.url || q.question_no));
  }

  resetProgress(): void {
    const id = this.activeCourseId();
    this.answerHistory.set({});
    this.failedUrls.set(new Set());
    if (id) {
      try {
        localStorage.removeItem(historyKey(id));
        localStorage.removeItem(wrongKey(id));
      } catch {
        /* ignore */
      }
    }
  }

  private loadActiveCourseId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_COURSE_KEY);
    } catch {
      return null;
    }
  }

  private saveActiveCourseId(id: string): void {
    try {
      localStorage.setItem(ACTIVE_COURSE_KEY, id);
    } catch {
      /* ignore */
    }
  }

  private loadStatsForCourse(id: string): void {
    this.answerHistory.set(this.loadHistory(id));
    this.failedUrls.set(this.loadFailedUrls(id));
  }

  private loadHistory(id: string): Record<string, AnswerHistoryItem> {
    try {
      const raw = localStorage.getItem(historyKey(id));
      return raw ? (JSON.parse(raw) as Record<string, AnswerHistoryItem>) : {};
    } catch {
      return {};
    }
  }

  private saveHistory(id: string, history: Record<string, AnswerHistoryItem>): void {
    try {
      localStorage.setItem(historyKey(id), JSON.stringify(history));
    } catch {
      /* ignore storage quota errors */
    }
  }

  private loadFailedUrls(id: string): Set<string> {
    try {
      const raw = localStorage.getItem(wrongKey(id));
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  }

  private saveFailedUrls(id: string, set: Set<string>): void {
    try {
      localStorage.setItem(wrongKey(id), JSON.stringify(Array.from(set)));
    } catch {
      /* ignore */
    }
  }
}

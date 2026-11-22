import { Injectable, signal, computed } from '@angular/core';
import { Achievement, ProgressProfile, SessionRecord } from '../models/certification.model';

const progressKey = (id: string) => `ines_cert_${id}_progress`;
const MAX_SESSIONS = 100;

const EMPTY_PROFILE: ProgressProfile = {
  xp: 0,
  sessions: [],
  lastActiveDay: null,
  streakDays: 0,
};

/**
 * Gamification + result history for the certification trainer.
 *
 * Persists a per-course profile in localStorage: XP, completed exam sessions
 * (score history) and a daily streak. Derived values (level, achievements) are
 * exposed as signals so the dashboard reacts automatically.
 */
@Injectable({ providedIn: 'root' })
export class CertificationProgressService {
  private courseId: string | null = null;

  readonly xp = signal<number>(0);
  readonly sessions = signal<SessionRecord[]>([]);
  readonly lastActiveDay = signal<string | null>(null);
  readonly streakDays = signal<number>(0);

  /** Streak that is still "alive" (last activity today or yesterday). */
  readonly currentStreak = computed<number>(() => {
    const last = this.lastActiveDay();
    if (last === this.dayKey() || last === this.dayKey(new Date(Date.now() - 86_400_000))) {
      return this.streakDays();
    }
    return 0;
  });

  readonly level = computed<number>(() => Math.floor(Math.sqrt(this.xp() / 100)) + 1);
  readonly currentLevelXp = computed<number>(() => (this.level() - 1) ** 2 * 100);
  readonly nextLevelXp = computed<number>(() => this.level() ** 2 * 100);
  readonly levelProgress = computed<number>(() => {
    const span = this.nextLevelXp() - this.currentLevelXp();
    if (span <= 0) return 100;
    return Math.min(100, Math.round(((this.xp() - this.currentLevelXp()) / span) * 100));
  });

  readonly examSessions = computed<SessionRecord[]>(() =>
    this.sessions().filter((s) => s.type === 'exam'),
  );
  readonly examCount = computed<number>(() => this.examSessions().length);
  readonly passedCount = computed<number>(() => this.examSessions().filter((s) => s.passed).length);
  readonly bestScore = computed<number>(() =>
    this.examSessions().reduce((best, s) => Math.max(best, s.scorePercentage), 0),
  );
  readonly averageScore = computed<number>(() => {
    const exams = this.examSessions();
    if (exams.length === 0) return 0;
    const sum = exams.reduce((acc, s) => acc + s.scorePercentage, 0);
    return Math.round(sum / exams.length);
  });

  readonly achievements = computed<Achievement[]>(() => {
    const xp = this.xp();
    const streak = this.currentStreak();
    const exams = this.examCount();
    const passed = this.passedCount();
    const perfect = this.examSessions().some((s) => s.scorePercentage === 100);

    return [
      {
        id: 'first-steps',
        icon: '🐣',
        label: 'First Steps',
        description: 'Earn your first XP',
        earned: xp > 0,
      },
      {
        id: 'centurion',
        icon: '💯',
        label: 'Centurion',
        description: 'Reach 100 XP',
        earned: xp >= 100,
      },
      {
        id: 'veteran',
        icon: '🏅',
        label: 'Veteran',
        description: 'Reach 300 XP',
        earned: xp >= 300,
      },
      { id: 'master', icon: '👑', label: 'Master', description: 'Reach 750 XP', earned: xp >= 750 },
      {
        id: 'exam-rookie',
        icon: '📝',
        label: 'Exam Rookie',
        description: 'Complete an exam',
        earned: exams >= 1,
      },
      {
        id: 'exam-master',
        icon: '🎓',
        label: 'Exam Master',
        description: 'Complete 10 exams',
        earned: exams >= 10,
      },
      {
        id: 'victor',
        icon: '🏆',
        label: 'Victor',
        description: 'Pass an exam',
        earned: passed >= 1,
      },
      {
        id: 'perfect',
        icon: '⭐',
        label: 'Perfect',
        description: 'Score 100% on an exam',
        earned: perfect,
      },
      {
        id: 'streak-3',
        icon: '🔥',
        label: 'On Fire',
        description: '3-day streak',
        earned: streak >= 3,
      },
      {
        id: 'streak-7',
        icon: '☄️',
        label: 'Unstoppable',
        description: '7-day streak',
        earned: streak >= 7,
      },
    ];
  });

  /** Load the persisted profile for a course (no-op if already active). */
  load(courseId: string): void {
    if (this.courseId === courseId) return;
    this.courseId = courseId;
    const profile = this.readProfile(courseId);
    this.xp.set(profile.xp);
    this.sessions.set(profile.sessions);
    this.lastActiveDay.set(profile.lastActiveDay);
    this.streakDays.set(profile.streakDays);
  }

  /** Record a finished exam simulation and award XP. */
  recordExamSession(correct: number, total: number, passed: boolean, elapsedSeconds: number): void {
    if (!this.courseId) return;
    const scorePercentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    const session: SessionRecord = {
      type: 'exam',
      timestamp: Date.now(),
      correct,
      total,
      scorePercentage,
      passed,
      elapsedSeconds,
    };

    let gained = correct * 10;
    if (passed) gained += 50;
    if (scorePercentage === 100) gained += 100;

    this.sessions.set([...this.sessions(), session].slice(-MAX_SESSIONS));
    this.xp.update((x) => x + gained);
    this.touchActivity();
  }

  /** Record a single practice answer and award a small amount of XP. */
  recordPracticeAnswer(correct: boolean): void {
    if (!this.courseId) return;
    this.xp.update((x) => x + (correct ? 10 : 2));
    this.touchActivity();
  }

  reset(): void {
    this.xp.set(0);
    this.sessions.set([]);
    this.lastActiveDay.set(null);
    this.streakDays.set(0);
    if (this.courseId) {
      this.writeProfile(this.courseId, EMPTY_PROFILE);
    }
  }

  private touchActivity(): void {
    const today = this.dayKey();
    const last = this.lastActiveDay();
    if (last === today) {
      this.persist();
      return;
    }

    const yesterday = this.dayKey(new Date(Date.now() - 86_400_000));
    const streak = last === yesterday ? this.streakDays() + 1 : 1;

    this.lastActiveDay.set(today);
    this.streakDays.set(streak);
    this.persist();
  }

  private persist(): void {
    if (!this.courseId) return;
    this.writeProfile(this.courseId, {
      xp: this.xp(),
      sessions: this.sessions(),
      lastActiveDay: this.lastActiveDay(),
      streakDays: this.streakDays(),
    });
  }

  private readProfile(courseId: string): ProgressProfile {
    try {
      const raw = localStorage.getItem(progressKey(courseId));
      if (!raw) return { ...EMPTY_PROFILE };
      const parsed = JSON.parse(raw) as Partial<ProgressProfile>;
      return {
        xp: typeof parsed.xp === 'number' ? parsed.xp : 0,
        sessions: Array.isArray(parsed.sessions) ? (parsed.sessions as SessionRecord[]) : [],
        lastActiveDay: parsed.lastActiveDay ?? null,
        streakDays: typeof parsed.streakDays === 'number' ? parsed.streakDays : 0,
      };
    } catch {
      return { ...EMPTY_PROFILE };
    }
  }

  private writeProfile(courseId: string, profile: ProgressProfile): void {
    try {
      localStorage.setItem(progressKey(courseId), JSON.stringify(profile));
    } catch {
      /* ignore storage quota errors */
    }
  }

  private dayKey(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

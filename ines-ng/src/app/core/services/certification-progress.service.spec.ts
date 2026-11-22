import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CertificationProgressService } from './certification-progress.service';

describe('CertificationProgressService', () => {
  let service: CertificationProgressService;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    service = new CertificationProgressService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads an empty profile when nothing is persisted', () => {
    service.load('angular');
    expect(service.xp()).toBe(0);
    expect(service.sessions().length).toBe(0);
    expect(service.currentStreak()).toBe(0);
    expect(service.level()).toBe(1);
  });

  it('awards XP for practice answers and keeps profiles per course', () => {
    service.load('angular');
    service.recordPracticeAnswer(true);
    expect(service.xp()).toBe(10);
    service.recordPracticeAnswer(false);
    expect(service.xp()).toBe(12);

    const other = new CertificationProgressService();
    other.load('java');
    expect(other.xp()).toBe(0);
  });

  it('records exam sessions and computes score with bonuses', () => {
    service.load('angular');
    service.recordExamSession(5, 10, true, 120);

    expect(service.examCount()).toBe(1);
    expect(service.passedCount()).toBe(1);
    expect(service.sessions()[0].scorePercentage).toBe(50);
    // 5 correct * 10 XP + 50 XP pass bonus.
    expect(service.xp()).toBe(100);

    service.recordExamSession(10, 10, true, 60);
    expect(service.bestScore()).toBe(100);
    // Perfect score adds a 100 XP bonus on top of the base + pass bonus.
    expect(service.xp()).toBe(350);
  });

  it('computes level and achievements', () => {
    service.load('angular');
    expect(service.level()).toBe(1);

    service.recordExamSession(10, 10, true, 60); // 250 XP total.
    expect(service.level()).toBeGreaterThan(1);
    expect(service.achievements().find((a) => a.id === 'victor')?.earned).toBe(true);
    expect(service.achievements().find((a) => a.id === 'perfect')?.earned).toBe(true);
    expect(service.achievements().find((a) => a.id === 'exam-master')?.earned).toBe(false);
  });

  it('tracks daily streaks and resets them after a gap', () => {
    service.load('angular');

    vi.setSystemTime(new Date('2025-01-01T12:00:00'));
    service.recordPracticeAnswer(true);
    expect(service.currentStreak()).toBe(1);

    vi.setSystemTime(new Date('2025-01-02T12:00:00'));
    service.recordPracticeAnswer(true);
    expect(service.currentStreak()).toBe(2);

    vi.setSystemTime(new Date('2025-01-05T12:00:00'));
    service.recordPracticeAnswer(true);
    expect(service.currentStreak()).toBe(1);
  });

  it('resets progress and clears storage', () => {
    service.load('angular');
    service.recordExamSession(5, 10, false, 60);
    service.reset();

    expect(service.xp()).toBe(0);
    expect(service.sessions().length).toBe(0);
    expect(localStorage.getItem('ines_cert_angular_progress')).toBe(
      JSON.stringify({
        xp: 0,
        sessions: [],
        lastActiveDay: null,
        streakDays: 0,
      }),
    );
  });
});

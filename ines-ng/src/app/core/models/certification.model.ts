/**
 * Generic certification trainer models.
 *
 * The Question shape is intentionally identical to the one used in the
 * aws-ai-practitioner repository so any existing question bank can be dropped
 * into `public/certifications/` without conversion.
 */
export interface Question {
  url: string;
  question_no: string;
  question: string;
  options: Record<string, string>;
  images?: string[];
  is_hotspot?: boolean;
  discussion?: string[];
  vote_counts?: Record<string, number>;
  most_voted?: string;
  community_answer?: string;
  correct_answer: string;
}

export interface CourseDefinition {
  /** Stable, unique identifier used for per-course progress persistence. */
  id: string;
  name: string;
  description: string;
  /** Path (relative to `public/`) of the question bank JSON file. */
  fileName: string;
  /** Small uppercase label shown on the course card, e.g. "AWS Certified". */
  badge?: string;
  /** Subtitle shown next to the course name, e.g. "AIF-C01". */
  subtitle?: string;
  /** Accent color used across the course experience. */
  accent?: string;
  /** Full exam title shown on the results screen. */
  examTitle?: string;
  /** Optional explanatory text shown on the exam setup screen. */
  examInfo?: string;
  /** Default number of questions for the exam simulation. */
  numQuestions?: number;
  /** Default passing threshold (percentage). */
  passThreshold?: number;
  /** Optional metadata used by the catalog dashboard before questions load. */
  totalQuestions?: number;
}

export type CertScreenMode =
  | 'catalog'
  | 'course-home'
  | 'exam-setup'
  | 'practice'
  | 'exam'
  | 'results'
  | 'review'
  | 'dashboard';

export interface ExamConfig {
  numQuestions: number;
  passThreshold: number;
}

export interface ExamResult {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  scorePercentage: number;
  scaledScore: number;
  passed: boolean;
  passThreshold: number;
  elapsedSeconds: number;
  wrongQuestions: Question[];
}

export interface AnswerHistoryItem {
  selected: string[];
  isCorrect: boolean;
  timestamp: number;
}

/** A single completed session (exam or practice set) stored in local history. */
export interface SessionRecord {
  type: 'exam' | 'practice';
  timestamp: number;
  correct: number;
  total: number;
  scorePercentage: number;
  passed: boolean;
  elapsedSeconds: number;
}

/** Gamification + history profile persisted per course. */
export interface ProgressProfile {
  xp: number;
  sessions: SessionRecord[];
  lastActiveDay: string | null;
  streakDays: number;
}

export interface Achievement {
  id: string;
  icon: string;
  label: string;
  description: string;
  earned: boolean;
}

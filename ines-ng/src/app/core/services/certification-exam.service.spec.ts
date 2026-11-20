import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CertificationExamService } from './certification-exam.service';
import { Question } from '../models/certification.model';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    url: 'https://example.com/q',
    question_no: 'question 1',
    question: 'What is the answer?',
    options: { A: 'Alpha', B: 'Beta', C: 'Gamma', D: 'Delta' },
    images: [],
    is_hotspot: false,
    correct_answer: 'A',
    ...overrides,
  };
}

describe('CertificationExamService', () => {
  let service: CertificationExamService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new CertificationExamService();
  });

  afterEach(() => {
    service.cleanup();
    vi.useRealTimers();
  });

  describe('startExam', () => {
    it('selects at most the requested number of questions', () => {
      const pool = [
        makeQuestion(),
        makeQuestion({ question_no: 'question 2' }),
        makeQuestion({ question_no: 'question 3' }),
      ];
      service.startExam({ numQuestions: 2, passThreshold: 70 }, pool);

      expect(service.questions().length).toBe(2);
      expect(service.currentIndex()).toBe(0);
      expect(service.elapsedSeconds()).toBe(0);
      expect(service.isCompleted()).toBe(false);
    });

    it('caps the pool at the available questions', () => {
      const pool = [makeQuestion()];
      service.startExam({ numQuestions: 5, passThreshold: 70 }, pool);
      expect(service.questions().length).toBe(1);
    });
  });

  describe('isMultiChoice / maxSelections', () => {
    it('detects single answer questions', () => {
      service.questions.set([makeQuestion()]);
      service.currentIndex.set(0);
      expect(service.isMultiChoice()).toBe(false);
      expect(service.maxSelections()).toBe(1);
    });

    it('detects choose two questions', () => {
      service.questions.set([makeQuestion({ question: 'Choose two valid options.' })]);
      service.currentIndex.set(0);
      expect(service.isMultiChoice()).toBe(true);
      expect(service.maxSelections()).toBe(2);
    });

    it('detects choose three questions', () => {
      service.questions.set([makeQuestion({ question: 'Choose three correct answers.' })]);
      service.currentIndex.set(0);
      expect(service.maxSelections()).toBe(3);
    });

    it('detects multi-letter correct answers', () => {
      service.questions.set([makeQuestion({ correct_answer: 'AB' })]);
      service.currentIndex.set(0);
      expect(service.isMultiChoice()).toBe(true);
      expect(service.maxSelections()).toBe(2);
    });

    it('handles comma-separated correct answers', () => {
      service.questions.set([makeQuestion({ correct_answer: 'A, C' })]);
      service.currentIndex.set(0);
      expect(service.isMultiChoice()).toBe(true);
      expect(service.maxSelections()).toBe(2);
    });
  });

  describe('toggleOption', () => {
    it('replaces the selection for single-choice questions', () => {
      service.questions.set([makeQuestion()]);
      service.currentIndex.set(0);
      service.toggleOption('A');
      service.toggleOption('B');
      expect(service.currentSelectedOptions()).toEqual(['B']);
    });

    it('accumulates selections for multi-choice questions', () => {
      service.questions.set([makeQuestion({ question: 'Choose two valid options.' })]);
      service.currentIndex.set(0);
      service.toggleOption('A');
      service.toggleOption('B');
      expect(service.currentSelectedOptions()).toEqual(['A', 'B']);
      service.toggleOption('A');
      expect(service.currentSelectedOptions()).toEqual(['B']);
    });
  });

  describe('finishExam', () => {
    it('scores correct, incorrect and unanswered answers', () => {
      service.config.set({ numQuestions: 3, passThreshold: 70 });
      service.questions.set([
        makeQuestion({ question_no: 'q1', correct_answer: 'A' }),
        makeQuestion({ question_no: 'q2', correct_answer: 'B' }),
        makeQuestion({ question_no: 'q3', correct_answer: 'C' }),
      ]);
      service.selectedAnswers.set({ 0: ['A'], 1: ['A'] });

      const result = service.finishExam();

      expect(result.correctCount).toBe(1);
      expect(result.incorrectCount).toBe(1);
      expect(result.unansweredCount).toBe(1);
      expect(result.scorePercentage).toBe(33);
      expect(result.scaledScore).toBe(Math.round(100 + (33 / 100) * 900));
      expect(result.passed).toBe(false);
    });

    it('passes when the score reaches the threshold', () => {
      service.config.set({ numQuestions: 2, passThreshold: 50 });
      service.questions.set([
        makeQuestion({ question_no: 'q1', correct_answer: 'A' }),
        makeQuestion({ question_no: 'q2', correct_answer: 'B' }),
      ]);
      service.selectedAnswers.set({ 0: ['A'], 1: ['A'] });

      const result = service.finishExam();
      expect(result.scorePercentage).toBe(50);
      expect(result.passed).toBe(true);
      expect(result.wrongQuestions.length).toBe(1);
    });
  });
});

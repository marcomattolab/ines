import { describe, it, expect } from 'vitest';
import {
  computePercent,
  elapsedSeconds,
  etaSeconds,
  formatDuration,
  isFinishedStatus,
  statusLabel,
  DocJob,
} from './document-studio.service';

function makeJob(overrides: Partial<DocJob> = {}): DocJob {
  return {
    id: 'job-1',
    status: 'running',
    message: '',
    output_dir: '/out',
    total: 10,
    completed: 5,
    succeeded: 4,
    failed: 0,
    skipped: 1,
    current_file: null,
    errors: [],
    files: [],
    pages_done: 0,
    pages_total: 0,
    started_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('document-studio helpers', () => {
  it('detects terminal statuses', () => {
    expect(isFinishedStatus('completed')).toBe(true);
    expect(isFinishedStatus('completed_with_errors')).toBe(true);
    expect(isFinishedStatus('failed')).toBe(true);
    expect(isFinishedStatus('running')).toBe(false);
    expect(isFinishedStatus('queued')).toBe(false);
  });

  it('computes percent from completed files', () => {
    expect(computePercent(makeJob({ total: 10, completed: 5 }))).toBe(50);
    expect(computePercent(makeJob({ total: 10, completed: 10 }))).toBe(100);
    expect(computePercent(makeJob({ total: 0, completed: 0 }))).toBe(0);
  });

  it('weights per-page progress into the percent', () => {
    const job = makeJob({ total: 2, completed: 1, pages_total: 4, pages_done: 2 });
    // 1 completed file + 0.5 page fraction = 1.5 / 2 = 75%.
    expect(computePercent(job)).toBe(75);
  });

  it('computes elapsed and ETA', () => {
    const now = Date.parse('2025-01-01T00:01:00.000Z');
    const job = makeJob({ total: 10, completed: 5, started_at: '2025-01-01T00:00:00.000Z' });
    expect(elapsedSeconds(job, now)).toBe(60);
    expect(etaSeconds(job, now)).toBe(60);
    expect(etaSeconds(makeJob({ status: 'completed' }), now)).toBeNull();
  });

  it('formats durations', () => {
    expect(formatDuration(59)).toBe('59s');
    expect(formatDuration(95)).toBe('1m 35s');
    expect(formatDuration(3725)).toBe('1h 2m');
  });

  it('maps statuses to Italian labels', () => {
    expect(statusLabel('done')).toBe('fatto');
    expect(statusLabel('processing')).toBe('in corso');
    expect(statusLabel('skipped')).toBe('saltato');
    expect(statusLabel('unknown')).toBe('unknown');
  });
});

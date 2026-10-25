import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from './embedding.service';

describe('embedding — cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it('is 0 when lengths differ or vectors are empty', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('handles negative values', () => {
    expect(cosineSimilarity([1, -1], [-1, 1])).toBeCloseTo(-1, 5);
  });
});

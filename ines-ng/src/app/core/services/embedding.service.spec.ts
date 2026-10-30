import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cosineSimilarity, EmbeddingService, EMBEDDING_MODEL_ID } from './embedding.service';

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

describe('embedding — model versioning', () => {
  const KEY = 'ines_embedding_model_id';

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('reports an unknown stored model as not current', () => {
    localStorage.setItem(KEY, 'universal-sentence-encoder-v1');
    expect(new EmbeddingService().isCurrentModel()).toBe(false);
  });

  it('reports the current model as current after marking it', () => {
    const svc = new EmbeddingService();
    svc.markCurrentModel();
    expect(svc.isCurrentModel()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe(EMBEDDING_MODEL_ID);
  });
});

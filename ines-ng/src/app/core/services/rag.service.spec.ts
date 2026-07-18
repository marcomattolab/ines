import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import { Injector } from '@angular/core';
import { TextProcessingService } from './text-processing.service';
import { RagService } from './rag.service';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

describe('RagService', () => {
  let service: RagService;

  beforeEach(() => {
    const injector = Injector.create({
      providers: [TextProcessingService, RagService],
    });
    service = injector.get(RagService);
  });

  it('should start with no context', () => {
    expect(service.hasContext()).toBe(false);
  });

  it('should return empty string for empty context query', () => {
    const result = service.getRelevantChunks('test query');
    expect(result).toBe('');
  });

  it('should clear context', () => {
    service.clearContext();
    expect(service.hasContext()).toBe(false);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import { Injector } from '@angular/core';
import { TextProcessingService } from './text-processing.service';
import { ProjectService } from './project.service';
import { KnowledgeManagerService } from './knowledge-manager.service';
import { BaseChunk } from './base-indexed-db.service';

const makeChunk = (id: string, text: string, docName: string): BaseChunk => ({
  id,
  docId: `d-${id}`,
  docName,
  text,
  position: 0,
  keywords: [],
  hash: `h-${id}`,
});

describe('BaseIndexedDbService (via ProjectService)', () => {
  let service: ProjectService;

  beforeEach(() => {
    const injector = Injector.create({
      providers: [TextProcessingService, ProjectService],
    });
    service = injector.get(ProjectService);
  });

  describe('getRelevantChunks scoring', () => {
    it('should score exact phrase match highest', async () => {
      const chunks = [
        makeChunk('1', 'unrelated text here', 'a.txt'),
        makeChunk('2', 'angular signals are great for reactivity', 'b.txt'),
        makeChunk('3', 'more unrelated stuff', 'c.txt'),
      ];
      vi.spyOn(service as never, 'getAllFromStore').mockResolvedValue(chunks);

      const results = await service.getRelevantChunks('angular signals', 1);
      expect(results).toHaveLength(1);
      expect(results[0].text).toContain('angular signals');
    });

    it('should return empty array for empty query', async () => {
      vi.spyOn(service as never, 'getAllFromStore').mockResolvedValue([]);
      const results = await service.getRelevantChunks('', 1);
      expect(results).toHaveLength(0);
    });

    it('should return empty array for all-stop-word query', async () => {
      vi.spyOn(service as never, 'getAllFromStore').mockResolvedValue([
        makeChunk('1', 'text', 'a.txt'),
      ]);
      const results = await service.getRelevantChunks('the and is', 1);
      expect(results).toHaveLength(0);
    });

    it('should respect topK limit', async () => {
      const chunks = [
        makeChunk('1', 'react one', 'a.tsx'),
        makeChunk('2', 'react two', 'b.tsx'),
        makeChunk('3', 'react three', 'c.tsx'),
      ];
      vi.spyOn(service as never, 'getAllFromStore').mockResolvedValue(chunks);
      const results = await service.getRelevantChunks('react', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should include docName in results', async () => {
      vi.spyOn(service as never, 'getAllFromStore').mockResolvedValue([
        makeChunk('1', 'angular forms', 'forms.md'),
      ]);
      const results = await service.getRelevantChunks('angular forms', 1);
      expect(results[0].docName).toBe('forms.md');
    });
  });

  describe('document operations', () => {
    it('should start with empty documents signal', () => {
      expect(service.documents()).toEqual([]);
    });

    it('should have isProcessing initially false', () => {
      expect(service.isProcessing()).toBe(false);
    });
  });
});

describe('BaseIndexedDbService (via KnowledgeManagerService)', () => {
  let service: KnowledgeManagerService;

  beforeEach(() => {
    const injector = Injector.create({
      providers: [TextProcessingService, KnowledgeManagerService],
    });
    service = injector.get(KnowledgeManagerService);
  });

  describe('initial state', () => {
    it('should start with empty documents', () => {
      expect(service.documents()).toEqual([]);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import { Injector, runInInjectionContext } from '@angular/core';
import { TextProcessingService } from './text-processing.service';
import { KnowledgeManagerService } from './knowledge-manager.service';

describe('KnowledgeManagerService', () => {
  let service: KnowledgeManagerService;
  let injector: Injector;

  beforeEach(() => {
    injector = Injector.create({
      providers: [TextProcessingService, KnowledgeManagerService],
    });
    service = injector.get(KnowledgeManagerService);
  });

  describe('getChunksByDocName', () => {
    it('should filter and sort chunks by document name', async () => {
      const mockChunks = [
        {
          id: '1',
          docId: 'd1',
          docName: 'angular.md',
          text: 'third',
          position: 2,
          keywords: [],
          hash: 'h1',
        },
        {
          id: '2',
          docId: 'd1',
          docName: 'angular.md',
          text: 'first',
          position: 0,
          keywords: [],
          hash: 'h2',
        },
        {
          id: '3',
          docId: 'd2',
          docName: 'react.md',
          text: 'different',
          position: 0,
          keywords: [],
          hash: 'h3',
        },
      ];
      vi.spyOn(service as never, 'getAllFromStore').mockResolvedValue(mockChunks);

      const result = await service.getChunksByDocName('angular.md');
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('first');
      expect(result[1].text).toBe('third');
    });

    it('should return empty array for unknown doc name', async () => {
      vi.spyOn(service as never, 'getAllFromStore').mockResolvedValue([]);
      const result = await service.getChunksByDocName('nonexistent.md');
      expect(result).toEqual([]);
    });
  });

  describe('QA operations', () => {
    it('should save and retrieve QAs sorted by date', async () => {
      const savedQAs = [
        { id: 'q1', question: 'Q1', answer: 'A1', sources: [], date: 1000 },
        { id: 'q2', question: 'Q2', answer: 'A2', sources: [], date: 2000 },
      ];
      vi.spyOn(service as never, 'getAllFromStore').mockResolvedValue(savedQAs);
      vi.spyOn(service as never, 'putInStore').mockResolvedValue(undefined);

      const qas = await service.getQAs();
      expect(qas).toHaveLength(2);
      expect(qas[0].date).toBeGreaterThanOrEqual(qas[1].date);
    });

    it('should call deleteFromStore for deleteQA', async () => {
      vi.spyOn(service as never, 'deleteFromStore').mockResolvedValue(undefined);
      await service.deleteQA('qa-1');
      expect((service as never).deleteFromStore).toHaveBeenCalledWith('qas', 'qa-1');
    });

    it('should save QA with current timestamp', async () => {
      const before = Date.now();
      vi.spyOn(service as never, 'putInStore').mockResolvedValue(undefined);

      await service.saveQA('test question', 'test answer', [
        { docName: 'doc.txt', text: 'source' },
      ]);

      const args = (service as never).putInStore.mock.calls[0];
      expect(args[0]).toBe('qas');
      expect(args[1].question).toBe('test question');
      expect(args[1].date).toBeGreaterThanOrEqual(before);
    });
  });

  describe('exportKnowledgeBase', () => {
    it('should export as JSON blob', async () => {
      vi.spyOn(service as never, 'getAllFromStore')
        .mockResolvedValueOnce([{ id: 'd1', name: 'doc.md' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const blob = await service.exportKnowledgeBase();
      expect(blob).toBeInstanceOf(Blob);
      const text = await blob.text();
      const payload = JSON.parse(text);
      expect(payload.version).toBe(1);
    });
  });

  describe('importKnowledgeBase', () => {
    it('should reject invalid file format', async () => {
      const file = new File(['not json'], 'bad.ines-knowledge', { type: 'application/json' });
      await expect(service.importKnowledgeBase(file)).rejects.toThrow(
        'Invalid knowledge base file',
      );
    });

    it('should reject payload without version', async () => {
      const payload = JSON.stringify({ documents: [] });
      const file = new File([payload], 'export.ines-knowledge', { type: 'application/json' });
      await expect(service.importKnowledgeBase(file)).rejects.toThrow(
        'Invalid knowledge base format',
      );
    });
  });

  describe('clearAll', () => {
    it('should clear documents and extra stores', async () => {
      vi.spyOn(service as never, 'clearStore').mockResolvedValue(undefined);
      service.documents.set([{ id: 'd1' } as never]);

      await service.clearAll();

      expect((service as never).clearStore).toHaveBeenCalledTimes(4);
      expect(service.documents()).toEqual([]);
    });
  });

  describe('initial state', () => {
    it('should start with empty documents', () => {
      expect(service.documents()).toEqual([]);
    });

    it('should have isProcessing initially false', () => {
      expect(service.isProcessing()).toBe(false);
    });
  });
});

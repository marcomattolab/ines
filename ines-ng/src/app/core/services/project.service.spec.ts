import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import { Injector } from '@angular/core';
import { TextProcessingService } from './text-processing.service';
import { ProjectService, ProjectChunk } from './project.service';

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(() => {
    const injector = Injector.create({
      providers: [TextProcessingService, ProjectService],
    });
    service = injector.get(ProjectService);
  });

  describe('getChunksForDocument', () => {
    it('should filter and sort chunks by docId', async () => {
      const mockChunks: ProjectChunk[] = [
        {
          id: 'c1',
          docId: 'd1',
          docName: 'comp.ts',
          text: 'third',
          position: 2,
          keywords: [],
          hash: 'h1',
        },
        {
          id: 'c2',
          docId: 'd1',
          docName: 'comp.ts',
          text: 'first',
          position: 0,
          keywords: [],
          hash: 'h2',
        },
        {
          id: 'c3',
          docId: 'd2',
          docName: 'other.ts',
          text: 'other',
          position: 0,
          keywords: [],
          hash: 'h3',
        },
      ];
      vi.spyOn(service as never, 'getAllFromStore').mockResolvedValue(mockChunks);

      const result = await service.getChunksForDocument('d1');
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('first');
      expect(result[1].text).toBe('third');
    });

    it('should return empty array for unknown docId', async () => {
      vi.spyOn(service as never, 'getAllFromStore').mockResolvedValue([]);
      const result = await service.getChunksForDocument('nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('exportProject', () => {
    it('should export documents and chunks as JSON blob', async () => {
      vi.spyOn(service as never, 'getAllFromStore')
        .mockResolvedValueOnce([
          { id: 'd1', name: 'app.ts', type: 'ts', date: 1, size: 100, hash: 'abc' },
        ])
        .mockResolvedValueOnce([]);

      const blob = await service.exportProject();
      expect(blob).toBeInstanceOf(Blob);
      const text = await blob.text();
      const payload = JSON.parse(text);
      expect(payload.version).toBe(1);
    });
  });

  describe('importProject', () => {
    it('should reject file with no documents', async () => {
      const payload = JSON.stringify({ version: 1, documents: [] });
      const file = new File([payload], 'project.ines-project', { type: 'application/json' });
      await expect(service.importProject(file)).rejects.toThrow('Invalid project file');
    });

    it('should reject non-JSON file', async () => {
      const file = new File(['not json'], 'bad.ines-project', { type: 'application/json' });
      await expect(service.importProject(file)).rejects.toThrow();
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

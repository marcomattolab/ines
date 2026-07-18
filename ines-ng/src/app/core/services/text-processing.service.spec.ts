import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import { TextProcessingService } from './text-processing.service';

describe('TextProcessingService', () => {
  let service: TextProcessingService;

  beforeEach(() => {
    service = new TextProcessingService();
  });

  describe('STOP_WORDS', () => {
    it('should contain common English stop words', () => {
      expect(TextProcessingService.STOP_WORDS.has('the')).toBe(true);
      expect(TextProcessingService.STOP_WORDS.has('and')).toBe(true);
    });

    it('should contain common Italian stop words', () => {
      expect(TextProcessingService.STOP_WORDS.has('il')).toBe(true);
      expect(TextProcessingService.STOP_WORDS.has('che')).toBe(true);
    });

    it('should not contain meaningful words', () => {
      expect(TextProcessingService.STOP_WORDS.has('angular')).toBe(false);
      expect(TextProcessingService.STOP_WORDS.has('component')).toBe(false);
    });
  });

  describe('computeHash', () => {
    it('should return a 16-char hex string', async () => {
      const hash = await service.computeHash('test data');
      expect(hash).toHaveLength(16);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('should produce different hashes for different inputs', async () => {
      const h1 = await service.computeHash('hello');
      const h2 = await service.computeHash('world');
      expect(h1).not.toBe(h2);
    });

    it('should produce the same hash for identical inputs', async () => {
      const h1 = await service.computeHash('same text');
      const h2 = await service.computeHash('same text');
      expect(h1).toBe(h2);
    });
  });

  describe('extractKeywords', () => {
    it('should remove stop words', () => {
      const keywords = service.extractKeywords('the quick brown fox');
      expect(keywords).toContain('quick');
      expect(keywords).toContain('brown');
      expect(keywords).toContain('fox');
      expect(keywords).not.toContain('the');
    });

    it('should return unique lowercase keywords', () => {
      const keywords = service.extractKeywords('Component component SIGNAL signal');
      const componentCount = keywords.filter((k) => k === 'component').length;
      const signalCount = keywords.filter((k) => k === 'signal').length;
      expect(componentCount).toBe(1);
      expect(signalCount).toBe(1);
    });

    it('should ignore words shorter than 2 chars', () => {
      const keywords = service.extractKeywords('a b x hi hello');
      expect(keywords).not.toContain('a');
      expect(keywords).not.toContain('x');
      expect(keywords).toContain('hi');
    });
  });

  describe('chunkText', () => {
    it('should split text into overlapping chunks with metadata', () => {
      const words = Array.from({ length: 50 }, (_, i) => `w${i}`);
      const text = words.join(' ');
      const chunks = service.chunkText(text, 'doc.txt', 'doc-1', 10, 2);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].docName).toBe('doc.txt');
      expect(chunks[0].docId).toBe('doc-1');
    });

    it('should not exceed chunkSize in words', () => {
      const text = Array.from({ length: 50 }, (_, i) => `w${i}`).join(' ');
      const chunks = service.chunkText(text, 'f.txt', 'd1', 15, 3);

      for (const chunk of chunks) {
        const wordCount = chunk.text.split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(15);
      }
    });

    it('should have increasing positions', () => {
      const text = Array.from({ length: 60 }, (_, i) => `w${i}`).join(' ');
      const chunks = service.chunkText(text, 'f.txt', 'd1', 10, 2);

      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].position).toBeGreaterThan(chunks[i - 1].position);
      }
    });

    it('should produce keywords per chunk', () => {
      const text = 'Angular uses signals for reactivity and standalone components';
      const chunks = service.chunkText(text, 'f.txt', 'd1', 100, 10);
      expect(chunks[0].keywords.length).toBeGreaterThan(0);
    });

    it('should return single chunk for short text', () => {
      const chunks = service.chunkText('short', 'f.txt', 'd1', 100, 10);
      expect(chunks).toHaveLength(1);
    });
  });

  describe('extractTextFromHtml', () => {
    it('should extract text from HTML files', async () => {
      const htmlContent = '<html><body><h1>Title</h1><p>Paragraph.</p></body></html>';
      const file = new File([htmlContent], 'test.html', { type: 'text/html' });
      const text = await service.extractTextFromHtml(file);
      expect(text).toContain('Title');
      expect(text).toContain('Paragraph.');
    });
  });

  describe('extractTextFromFile', () => {
    it('should read plain text files', async () => {
      const file = new File(['plain text'], 'readme.txt', { type: 'text/plain' });
      const text = await service.extractTextFromFile(file);
      expect(text).toBe('plain text');
    });

    it('should read markdown files', async () => {
      const file = new File(['# Title'], 'readme.md', { type: 'text/plain' });
      const text = await service.extractTextFromFile(file);
      expect(text).toBe('# Title');
    });

    it('should throw for unsupported file types', async () => {
      const file = new File(['binary'], 'img.png', { type: 'image/png' });
      await expect(service.extractTextFromFile(file)).rejects.toThrow('Unsupported file type');
    });
  });
});

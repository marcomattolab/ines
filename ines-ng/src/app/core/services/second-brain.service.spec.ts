import { describe, it, expect, vi } from 'vitest';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import {
  extractTags,
  tokenize,
  searchNotes,
  rankByEmbedding,
  BrainNote,
} from './second-brain.service';

function note(id: string, text: string, tags: string[] = []): BrainNote {
  return { id, text, tags, source: 'typed', date: 1, pinned: false, kind: 'note', folder: 'Inbox' };
}

describe('SecondBrainService — extractTags', () => {
  it('extracts hashtags', () => {
    expect(extractTags('idea #work about #AI and #ai')).toEqual(['work', 'ai']);
  });

  it('returns empty when no tags', () => {
    expect(extractTags('just a plain note')).toEqual([]);
  });

  it('handles accented and hyphenated tags', () => {
    expect(extractTags('todo #caffè #meeting-notes')).toEqual(['caffè', 'meeting-notes']);
  });
});

describe('SecondBrainService — tokenize', () => {
  it('lowercases and removes stop words', () => {
    expect(tokenize('The Meeting with the Client')).toEqual(['meeting', 'client']);
  });

  it('splits on punctuation', () => {
    expect(tokenize('project-planning, roadmap!')).toEqual(['project', 'planning', 'roadmap']);
  });
});

describe('SecondBrainService — searchNotes (BM25 index)', () => {
  const notes = [
    note('1', 'discuss the project timeline'),
    note('2', 'project meeting about the roadmap and budget'),
    note('3', 'buy groceries for dinner'),
  ];

  it('ranks the note matching both query terms first', () => {
    const result = searchNotes(notes, 'project meeting');
    expect(result[0].id).toBe('2');
    expect(result.map((n) => n.id)).toContain('1');
    expect(result.map((n) => n.id)).not.toContain('3');
  });

  it('returns all notes for an empty query', () => {
    expect(searchNotes(notes, '').length).toBe(3);
  });

  it('excludes irrelevant notes', () => {
    expect(searchNotes(notes, 'groceries').map((n) => n.id)).toEqual(['3']);
  });
});

describe('SecondBrainService — rankByEmbedding (semantic)', () => {
  const notes: BrainNote[] = [
    {
      id: 'a',
      text: 'meeting',
      tags: [],
      source: 'typed',
      date: 1,
      pinned: false,
      kind: 'note',
      folder: 'Inbox',
      embedding: [1, 0, 0],
    },
    {
      id: 'b',
      text: 'groceries',
      tags: [],
      source: 'typed',
      date: 1,
      pinned: false,
      kind: 'note',
      folder: 'Inbox',
      embedding: [0, 1, 0],
    },
    {
      id: 'c',
      text: 'no embedding yet',
      tags: [],
      source: 'typed',
      date: 1,
      pinned: false,
      kind: 'note',
      folder: 'Inbox',
    },
  ];

  it('ranks by semantic similarity', () => {
    const result = rankByEmbedding(notes, [1, 0, 0]);
    expect(result[0].id).toBe('a');
    expect(result.map((n) => n.id)).not.toContain('b');
    expect(result.map((n) => n.id)).not.toContain('c');
  });

  it('excludes notes without embeddings', () => {
    const result = rankByEmbedding(notes, [0, 1, 0]);
    expect(result.map((n) => n.id)).toEqual(['b']);
  });
});

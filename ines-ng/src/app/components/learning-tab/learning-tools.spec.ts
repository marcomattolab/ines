import { describe, it, expect } from 'vitest';
import {
  buildFlashcardsPrompt,
  buildMindmapPrompt,
  buildQuizPrompt,
  cleanMermaidCode,
  parseCsvCells,
  parseFlashcards,
} from './learning-tools';

describe('learning-tools — cleanMermaidCode', () => {
  it('extracts mindmap code from a fenced block', () => {
    const raw = '```mermaid\nmindmap\n  root((X))\n```';
    const out = cleanMermaidCode(raw);
    expect(out.startsWith('mindmap')).toBe(true);
    expect(out).toContain('(rootX)');
  });

  it('strips bullets and normalizes indentation', () => {
    const out = cleanMermaidCode('mindmap\n- root\n  - child');
    expect(out).toContain('(root)');
    expect(out).toContain('(child)');
    expect(out).not.toContain('-');
  });

  it('removes problematic characters from labels', () => {
    const out = cleanMermaidCode('mindmap\n  root((a[b]{c}"d"))');
    expect(out).not.toContain('[');
    expect(out).not.toContain('{');
    expect(out).not.toContain('"');
    expect(out).toContain('(rootabcd)');
  });

  it('adds a placeholder when nothing meaningful is extracted', () => {
    const out = cleanMermaidCode('mindmap');
    expect(out).toContain('No concepts extracted');
  });
});

describe('learning-tools — parseCsvCells', () => {
  it('splits simple CSV', () => {
    expect(parseCsvCells('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields containing commas', () => {
    expect(parseCsvCells('"a,b",c')).toEqual(['a,b', 'c']);
  });

  it('handles escaped double quotes', () => {
    expect(parseCsvCells('"a""b",c')).toEqual(['a"b', 'c']);
  });
});

describe('learning-tools — parseFlashcards', () => {
  it('parses simple CSV lines, skipping the header', () => {
    const out = parseFlashcards('front,back\nWhat is Angular?,A web framework');
    expect(out).toEqual([{ front: 'What is Angular?', back: 'A web framework' }]);
  });

  it('parses markdown table rows and skips the separator', () => {
    const raw = '| front | back |\n|---|---|\n| Q1 | A1 |';
    const out = parseFlashcards(raw);
    expect(out).toEqual([{ front: 'Q1', back: 'A1' }]);
  });

  it('parses inline Q/A lines', () => {
    const out = parseFlashcards('Q: What is X? A: It is Y');
    expect(out).toEqual([{ front: 'What is X?', back: 'It is Y' }]);
  });

  it('strips fenced csv markers', () => {
    const out = parseFlashcards('```csv\nfront,back\nQ,A\n```');
    expect(out).toEqual([{ front: 'Q', back: 'A' }]);
  });

  it('returns an empty list for garbage input', () => {
    expect(parseFlashcards('just some text')).toEqual([]);
  });
});

describe('learning-tools — prompt builders', () => {
  it('embeds the context and key instructions', () => {
    const ctx = 'CONTEXT-CONTENT';
    expect(buildMindmapPrompt(ctx)).toContain(ctx);
    expect(buildMindmapPrompt(ctx)).toContain('mindmap');
    expect(buildQuizPrompt(5, 4, ctx)).toContain('5 multiple-choice');
    expect(buildQuizPrompt(5, 4, ctx)).toContain('4 options');
    expect(buildFlashcardsPrompt(ctx)).toContain(ctx);
    expect(buildFlashcardsPrompt(ctx)).toContain('front');
  });
});

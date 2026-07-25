import { describe, it, expect } from 'vitest';
import { SpeechService } from './speech.service';

describe('SpeechService — normalizePunctuation', () => {
  let service: SpeechService;

  function normalize(text: string): string {
    return (service as any).normalizePunctuation(text);
  }

  beforeEach(() => {
    service = new SpeechService();
  });

  // ── Basic punctuation ──

  it('should convert comma', () => {
    expect(normalize('hello comma world')).toBe('hello, world');
  });

  it('should convert period', () => {
    expect(normalize('end of sentence period')).toBe('end of sentence.');
  });

  it('should convert dot', () => {
    expect(normalize('say dot')).toBe('say.');
  });

  it('should convert full stop', () => {
    expect(normalize('that is all full stop')).toBe('that is all.');
  });

  it('should convert question mark', () => {
    expect(normalize('are you sure question mark')).toBe('are you sure?');
  });

  it('should convert exclamation point', () => {
    expect(normalize('watch out exclamation point')).toBe('watch out!');
  });

  it('should convert exclamation mark', () => {
    expect(normalize('amazing exclamation mark')).toBe('amazing!');
  });

  // ── Special characters ──

  it('should convert colon', () => {
    expect(normalize('note colon')).toBe('note:');
  });

  it('should convert semicolon', () => {
    expect(normalize('continue semicolon next')).toBe('continue; next');
  });

  it('should convert dash', () => {
    expect(normalize('well dash thought out')).toBe('well- thought out');
  });

  it('should convert hyphen', () => {
    expect(normalize('state of the hyphen art')).toBe('state of the- art');
  });

  it('should convert slash', () => {
    expect(normalize('and slash or')).toBe('and/ or');
  });

  it('should convert at sign', () => {
    expect(normalize('email at sign example dot com')).toBe('email@ example. com');
  });

  it('should convert hashtag', () => {
    expect(normalize('trending hashtag code')).toBe('trending# code');
  });

  it('should convert hash', () => {
    expect(normalize('tag hash 123')).toBe('tag# 123');
  });

  it('should convert ampersand', () => {
    expect(normalize('rock ampersand roll')).toBe('rock& roll');
  });

  // ── Parentheses ──

  it('should convert open parenthesis', () => {
    expect(normalize('see open parenthesis note close parenthesis')).toBe('see (note)');
  });

  it('should convert open paren / close paren', () => {
    expect(normalize('see open paren note close paren')).toBe('see (note)');
  });

  // ── Newlines ──

  it('should convert new line', () => {
    const result = normalize('first item new line second item');
    expect(result).toBe('first item\nsecond item');
  });

  it('should convert newline (one word)', () => {
    const result = normalize('hello newline world');
    expect(result).toBe('hello\nworld');
  });

  // ── Space cleanup ──

  it('should clean spaces before punctuation', () => {
    expect(normalize('hello comma world period')).toBe('hello, world.');
  });

  it('should not double-suffix', () => {
    expect(normalize('hello comma comma world')).toBe('hello,, world');
  });

  it('should handle multiple punctuations in sequence', () => {
    expect(normalize('hello comma world period how are you question mark')).toBe(
      'hello, world. how are you?',
    );
  });

  it('should handle text without punctuation words', () => {
    expect(normalize('hello world today is sunny')).toBe('hello world today is sunny');
  });

  it('should handle empty text', () => {
    expect(normalize('')).toBe('');
  });

  // ── Case insensitivity ──

  it('should be case insensitive for comma', () => {
    expect(normalize('Hello COMMA World')).toBe('Hello, World');
  });

  it('should be case insensitive for period', () => {
    expect(normalize('Done PERIOD')).toBe('Done.');
  });

  // ── Complex sentence ──

  it('should handle a realistic spoken sentence', () => {
    const spoken =
      'Meeting at 10am comma bring laptop period Do not forget slides period New topic colon budget review question mark';
    expect(normalize(spoken)).toBe(
      'Meeting at 10am, bring laptop. Do not forget slides. New topic: budget review?',
    );
  });

  it('should handle numbered list with punctuation', () => {
    const spoken =
      'First comma update the README period Second comma add tests period Third comma deploy newline Ready question mark';
    const result = normalize(spoken);
    expect(result).toContain('\n');
    expect(result).toContain(',');
    expect(result).toContain('.');
    expect(result).toContain('?');
  });

  // ── Regression: words containing punctuation words as substrings ──

  it('should not convert words containing punctuation as substring', () => {
    expect(normalize('commando periodico dotted slashdot ampersando')).toBe(
      'commando periodico dotted slashdot ampersando',
    );
  });
});

import { describe, it, expect } from 'vitest';
import { LlmService, ChatMessage } from './llm.service';

describe('LlmService — estimateTokens', () => {
  it('estimates ~4 characters per token', () => {
    expect(LlmService.estimateTokens('')).toBe(0);
    expect(LlmService.estimateTokens('abcd')).toBe(1);
    expect(LlmService.estimateTokens('abcdefgh')).toBe(2);
  });
});

describe('LlmService — trimConversation', () => {
  const svc = new LlmService();

  it('keeps all recent messages within budget, in order', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'aaaa' },
      { role: 'assistant', content: 'bbbb' },
      { role: 'user', content: 'cccc' },
    ];
    // 1 token each; budget of 10 tokens fits everything.
    expect(svc.trimConversation('', '', history, 10, 0)).toEqual(history);
  });

  it('drops oldest messages when the budget is exceeded', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'aaaaaaaa' }, // 2 tokens
      { role: 'assistant', content: 'bbbbbbbb' }, // 2 tokens
      { role: 'user', content: 'cccccccc' }, // 2 tokens
    ];
    // Budget of 4 tokens keeps only the two most recent messages.
    const trimmed = svc.trimConversation('', '', history, 4, 0);
    expect(trimmed.map((m) => m.content)).toEqual(['bbbbbbbb', 'cccccccc']);
  });

  it('returns an empty list when system+user already exceed the budget', () => {
    const history: ChatMessage[] = [{ role: 'user', content: 'recent' }];
    const system = 'a'.repeat(1000); // 250 tokens — over any small budget
    expect(svc.trimConversation(system, 'b'.repeat(1000), history, 10, 0)).toEqual([]);
  });
});

describe('LlmService — generate guard rails', () => {
  it('throws when no model is loaded', async () => {
    const svc = new LlmService();
    await expect(svc.generate('system', 'hi', [], () => {})).rejects.toThrow(/Model not loaded/);
  });
});

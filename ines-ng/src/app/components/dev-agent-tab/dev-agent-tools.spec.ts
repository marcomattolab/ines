import { describe, it, expect } from 'vitest';
import {
  diffLines,
  extractCodeBlocks,
  formatSize,
  MODE_ICONS,
  MODE_LABELS,
  MODE_PROMPTS,
  SYSTEM_DEV_AGENT,
} from './dev-agent-tools';

describe('dev-agent-tools — formatSize', () => {
  it('formats bytes, KB and MB', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
  });
});

describe('dev-agent-tools — extractCodeBlocks', () => {
  it('extracts a fenced block with its language', () => {
    const out = extractCodeBlocks('```ts\nconst a = 1;\n```');
    expect(out).toHaveLength(1);
    expect(out[0].language).toBe('ts');
    expect(out[0].fileName).toBe('');
    expect(out[0].code).toBe('const a = 1;');
    expect(out[0].applied).toBe(false);
  });

  it('treats the language tag as a file path when it contains a dot or slash', () => {
    const out = extractCodeBlocks('```src/app.ts\ncode\n```');
    expect(out).toHaveLength(1);
    expect(out[0].fileName).toBe('src/app.ts');
    expect(out[0].language).toBe('ts');
  });

  it('ignores empty blocks and returns [] for no blocks', () => {
    expect(extractCodeBlocks('no code here')).toEqual([]);
    expect(extractCodeBlocks('```ts\n\n```')).toEqual([]);
  });
});

describe('dev-agent-tools — diffLines', () => {
  it('returns identical lines as same', () => {
    const out = diffLines('a\nb', 'a\nb');
    expect(out.map((l) => l.type)).toEqual(['same', 'same']);
  });

  it('detects additions', () => {
    const out = diffLines('a', 'a\nb');
    expect(out).toContainEqual({ type: 'add', text: 'b' });
  });

  it('detects deletions', () => {
    const out = diffLines('a\nb', 'a');
    expect(out).toContainEqual({ type: 'del', text: 'b' });
  });

  it('treats undefined original as empty', () => {
    const out = diffLines(undefined, 'x');
    expect(out).toContainEqual({ type: 'add', text: 'x' });
  });
});

describe('dev-agent-tools — constants', () => {
  it('covers all four modes consistently', () => {
    const modes = ['chat', 'review', 'modify', 'explain'] as const;
    for (const m of modes) {
      expect(MODE_LABELS[m]).toBeTruthy();
      expect(MODE_ICONS[m]).toBeTruthy();
      expect(MODE_PROMPTS[m]).toBeDefined();
    }
  });

  it('keeps the agent prompt placeholders', () => {
    expect(SYSTEM_DEV_AGENT).toContain('{CONTEXT}');
    expect(SYSTEM_DEV_AGENT).toContain('{MODE}');
    expect(SYSTEM_DEV_AGENT).toContain('{MODE_INSTRUCTIONS}');
  });
});

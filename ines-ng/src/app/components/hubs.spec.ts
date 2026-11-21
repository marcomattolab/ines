import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

import { AssistantTabComponent } from './assistant-tab/assistant-tab.component';
import { KnowledgeTabComponent } from './knowledge-tab/knowledge-tab.component';
import { CodeTabComponent } from './code-tab/code-tab.component';
import { LabsTabComponent } from './labs-tab/labs-tab.component';

describe('Tab hubs — tool definitions & switching', () => {
  it('Assistant: chat + voice, default chat', () => {
    const c = TestBed.runInInjectionContext(() => new AssistantTabComponent());
    expect(c.tools.map((t) => t.id)).toEqual(['chat', 'voice']);
    expect(c.active()).toBe('chat');
    c.active.set('voice');
    expect(c.active()).toBe('voice');
  });

  it('Knowledge: brain + project, default brain', () => {
    const c = TestBed.runInInjectionContext(() => new KnowledgeTabComponent());
    expect(c.tools.map((t) => t.id)).toEqual(['brain', 'project']);
    expect(c.active()).toBe('brain');
    c.active.set('project');
    expect(c.active()).toBe('project');
  });

  it('Code: coding + dev-agent + agents, default coding', () => {
    const c = new CodeTabComponent();
    expect(c.tools.map((t) => t.id)).toEqual(['coding', 'dev-agent', 'agents']);
    expect(c.active()).toBe('coding');
    c.active.set('agents');
    expect(c.active()).toBe('agents');
  });

  it('Labs: 8 vision tools, unique ids, default vision', () => {
    const c = new LabsTabComponent();
    expect(c.tools.map((t) => t.id)).toEqual([
      'vision',
      'assist',
      'ocr',
      'gestures',
      'pinch',
      'cursor',
      'background',
      'tris',
    ]);
    // ids unique
    expect(new Set(c.tools.map((t) => t.id)).size).toBe(c.tools.length);
    // every tool has icon + label + color
    for (const t of c.tools) {
      expect(t.icon).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.color).toMatch(/^text-/);
    }
    expect(c.active()).toBe('vision');
    c.active.set('tris');
    expect(c.active()).toBe('tris');
  });
});

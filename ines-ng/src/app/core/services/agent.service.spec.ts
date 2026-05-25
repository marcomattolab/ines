import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AgentService } from './agent.service';

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AgentService]
    });
    service = TestBed.inject(AgentService);
  });

  it('should have initial default skills', () => {
    const skills = service.skills();
    expect(skills.length).toBeGreaterThan(0);
    const names = skills.map(s => s.name);
    expect(names).toContain('Sustainability');
    expect(names).toContain('Financial Literacy');
    expect(names).toContain('Creative Writing');
  });

  it('should have initial default agents', () => {
    const agents = service.agents();
    expect(agents.length).toBeGreaterThan(0);
    const names = agents.map(a => a.name);
    expect(names).toContain('Eco Mentor');
    expect(names).toContain('Budget Buddy');
    expect(names).toContain('Story Partner');
  });

  it('should generate full prompt including skill instructions', () => {
    const ecoMentor = service.agents().find(a => a.name === 'Eco Mentor');
    expect(ecoMentor).toBeDefined();
    if (ecoMentor) {
      const fullPrompt = service.getAgentFullPrompt(ecoMentor);
      expect(fullPrompt).toContain(ecoMentor.systemPrompt);
      expect(fullPrompt).toContain('Focus on practical, actionable tips'); // sustainability skill
      expect(fullPrompt).toContain('Keep responses under 3 sentences'); // brevity skill
    }
  });
});

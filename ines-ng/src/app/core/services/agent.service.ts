import { Injectable, signal, computed, effect } from '@angular/core';

export interface Skill {
  id: string;
  name: string;
  description: string;
  instructions: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  skillIds: string[];
}

const AGENTS_STORAGE_KEY = 'ines_agents';
const SKILLS_STORAGE_KEY = 'ines_skills';

const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'skill-code-expert',
    name: 'Code Expert',
    description: 'Provides advanced coding advice and follows best practices.',
    instructions: 'Always use modern ES6+ syntax for JavaScript. Provide clear explanations for complex logic. Suggest unit tests where appropriate.'
  },
  {
    id: 'skill-concise',
    name: 'Brevity',
    description: 'Ensures responses are short and to the point.',
    instructions: 'Keep responses under 3 sentences unless explicitly asked for detail.'
  }
];

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-dev-lead',
    name: 'Senior Developer',
    description: 'A seasoned engineer who helps with architectural decisions and code reviews.',
    systemPrompt: 'You are a Senior Software Engineer with 15 years of experience. You focus on scalability, maintainability, and clean code.',
    skillIds: ['skill-code-expert']
  }
];

@Injectable({ providedIn: 'root' })
export class AgentService {
  readonly agents = signal<Agent[]>(this.loadFromStorage(AGENTS_STORAGE_KEY, DEFAULT_AGENTS));
  readonly skills = signal<Skill[]>(this.loadFromStorage(SKILLS_STORAGE_KEY, DEFAULT_SKILLS));

  constructor() {
    effect(() => {
      localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(this.agents()));
    });
    effect(() => {
      localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(this.skills()));
    });
  }

  private loadFromStorage<T>(key: string, defaultValue: T): T {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  }

  // Agent CRUD
  addAgent(agent: Omit<Agent, 'id'>) {
    const newAgent = { ...agent, id: crypto.randomUUID() };
    this.agents.update(a => [...a, newAgent]);
    return newAgent;
  }

  updateAgent(agent: Agent) {
    this.agents.update(list => list.map(a => a.id === agent.id ? agent : a));
  }

  deleteAgent(id: string) {
    this.agents.update(list => list.filter(a => a.id !== id));
  }

  // Skill CRUD
  addSkill(skill: Omit<Skill, 'id'>) {
    const newSkill = { ...skill, id: crypto.randomUUID() };
    this.skills.update(s => [...s, newSkill]);
    return newSkill;
  }

  updateSkill(skill: Skill) {
    this.skills.update(list => list.map(s => s.id === skill.id ? skill : s));
  }

  deleteSkill(id: string) {
    this.skills.update(list => list.filter(s => s.id !== id));
    // Also remove from agents
    this.agents.update(list => list.map(a => ({
      ...a,
      skillIds: a.skillIds.filter(sid => sid !== id)
    })));
  }

  getAgentFullPrompt(agent: Agent): string {
    const agentSkills = this.skills().filter(s => agent.skillIds.includes(s.id));
    const skillInstructions = agentSkills.map(s => s.instructions).join('\n');
    return `${agent.systemPrompt}\n\nAdditional Instructions:\n${skillInstructions}`;
  }
}

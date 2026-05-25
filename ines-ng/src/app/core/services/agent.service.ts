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
  },
  {
    id: 'skill-step-by-step',
    name: 'Step-by-Step',
    description: 'Breaks down complex tasks into logical, numbered steps.',
    instructions: 'Always break down your answer into clear, numbered steps. Start with a high-level summary and end with a "Next Action" recommendation.'
  },
  {
    id: 'skill-empathy',
    name: 'Empathy',
    description: 'Provides supportive and emotionally intelligent responses.',
    instructions: 'Acknowledge the user\'s feelings and use a warm, supportive tone. Avoid being overly clinical or robotic.'
  }
];

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-dev-lead',
    name: 'Senior Developer',
    description: 'A seasoned engineer who helps with architectural decisions and code reviews.',
    systemPrompt: 'You are a Senior Software Engineer with 15 years of experience. You focus on scalability, maintainability, and clean code.',
    skillIds: ['skill-code-expert']
  },
  {
    id: 'agent-life-coach',
    name: 'Life Coach',
    description: 'A motivational assistant to help with goal setting and personal growth.',
    systemPrompt: 'You are a world-class life coach and mentor. You help users find clarity, set realistic goals, and stay motivated.',
    skillIds: ['skill-empathy', 'skill-step-by-step']
  },
  {
    id: 'agent-travel',
    name: 'Travel Specialist',
    description: 'Expert in local culture, hidden gems, and efficient travel logistics.',
    systemPrompt: 'You are an expert travel consultant with deep knowledge of global destinations. You focus on unique experiences and practical advice.',
    skillIds: ['skill-step-by-step']
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

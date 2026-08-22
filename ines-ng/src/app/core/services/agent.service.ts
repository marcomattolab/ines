import { Injectable, signal, effect, inject } from '@angular/core';
import { StorageService } from './storage.service';

export interface Skill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  category?: string;
  icon?: string;
}

export interface SkillLibraryPayload {
  version: 1;
  date: number;
  skills: Skill[];
}

export interface SkillImportResult {
  added: number;
  updated: number;
  skipped: number;
}

function normalizeSkill(skill: Skill): Skill {
  return {
    ...skill,
    category: skill.category || 'General',
    icon: skill.icon || 'auto_awesome',
  };
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
    instructions:
      'Always use modern ES6+ syntax for JavaScript. Provide clear explanations for complex logic. Suggest unit tests where appropriate.',
    category: 'Coding',
    icon: 'code',
  },
  {
    id: 'skill-concise',
    name: 'Brevity',
    description: 'Ensures responses are short and to the point.',
    instructions: 'Keep responses under 3 sentences unless explicitly asked for detail.',
    category: 'Communication',
    icon: 'short_text',
  },
  {
    id: 'skill-step-by-step',
    name: 'Step-by-Step',
    description: 'Breaks down complex tasks into logical, numbered steps.',
    instructions:
      'Always break down your answer into clear, numbered steps. Start with a high-level summary and end with a "Next Action" recommendation.',
    category: 'Productivity',
    icon: 'format_list_numbered',
  },
  {
    id: 'skill-empathy',
    name: 'Empathy',
    description: 'Provides supportive and emotionally intelligent responses.',
    instructions:
      "Acknowledge the user's feelings and use a warm, supportive tone. Avoid being overly clinical or robotic.",
    category: 'Coaching',
    icon: 'favorite',
  },
  {
    id: 'skill-writing-editor',
    name: 'Writing & Editing',
    description: 'Reviews and improves text for clarity, grammar, tone, and structure.',
    instructions:
      "Edit the user's text for clarity, grammar, conciseness, and tone. Provide the revised version along with brief explanations of key changes. Offer suggestions rather than rewrites when appropriate.",
    category: 'Writing',
    icon: 'edit_note',
  },
  {
    id: 'skill-formal-tone',
    name: 'Professional Tone',
    description: 'Maintains a polished, business-appropriate tone.',
    instructions:
      'Use a professional, polished tone suitable for business communication. Avoid slang, contractions, and overly casual language. Prioritize clarity and precision.',
    category: 'Writing',
    icon: 'business',
  },
  {
    id: 'skill-summarizer',
    name: 'Summarizer',
    description: 'Extracts key points and creates concise summaries.',
    instructions:
      'Extract the most important points from the provided text. Structure summaries with a one-sentence TL;DR followed by 3-5 bullet points. Omit minor details and examples unless asked.',
    category: 'Productivity',
    icon: 'summarize',
  },
  {
    id: 'skill-decision-framework',
    name: 'Decision Analysis',
    description: 'Weighs pros, cons, trade-offs, and recommends a path forward.',
    instructions:
      'Structure your analysis with: Context, Options, Pros/Cons per option, and a Recommendation. Highlight key trade-offs and risks. End with a clear, actionable recommendation.',
    category: 'Analysis',
    icon: 'account_tree',
  },
  {
    id: 'skill-brainstorming',
    name: 'Brainstorming',
    description: 'Generates creative ideas and explores possibilities.',
    instructions:
      'Generate diverse ideas without judging feasibility too early. Aim for quantity first, then help the user refine. Use lateral thinking: combine, reverse, exaggerate, or adapt existing concepts. Organize ideas into themes or categories.',
    category: 'Analysis',
    icon: 'lightbulb',
  },
  {
    id: 'skill-code-review',
    name: 'Code Review',
    description:
      'Thorough programmer code review — bugs, style, security, performance, and architecture.',
    instructions:
      'Conduct a rigorous code review. Check for: logical errors, edge cases, null/undefined handling, race conditions, memory leaks, security vulnerabilities (XSS, injection, auth bypass), performance bottlenecks, and adherence to project conventions. For each issue found, cite the file and line reference, explain the problem, and suggest a concrete fix. Rate severity: Critical / Major / Minor / Nit. End with an overall assessment.',
    category: 'Coding',
    icon: 'rate_review',
  },
  {
    id: 'skill-code-change',
    name: 'Source Code Changer',
    description: 'Modifies source code — refactors, adds features, fixes bugs, writes patches.',
    instructions:
      'You are a code modification specialist. When asked to change source code, output the complete modified file content in a markdown code block with the file path comment. Always show a brief diff summary before the code: list what was added, removed, or changed. Preserve all existing code not related to the change. Match the existing indentation, naming, and style conventions. Never truncate files — output them fully.',
    category: 'Coding',
    icon: 'build',
  },
  {
    id: 'skill-dev-agent',
    name: 'DevAgent Core',
    description:
      'Core skill for the DevAgent — enables repository-aware analysis and code assistance.',
    instructions:
      'You are operating as a DevAgent embedded in a developer workspace. You have access to the project repository context. Use it to ground your answers. When suggesting code changes, show the full file with modifications. When reviewing, cite specific files. Be concise, actionable, and follow project conventions.',
    category: 'Coding',
    icon: 'smart_toy',
  },
];

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-dev-lead',
    name: 'Senior Developer',
    description: 'A seasoned engineer who helps with architectural decisions and code reviews.',
    systemPrompt:
      'You are a Senior Software Engineer with 15 years of experience. You focus on scalability, maintainability, clean code, and thorough code reviews.',
    skillIds: ['skill-code-expert', 'skill-dev-agent', 'skill-code-review'],
  },
  {
    id: 'agent-code-reviewer',
    name: 'Code Reviewer',
    description:
      'Dedicated code review specialist — finds bugs, security issues, and anti-patterns.',
    systemPrompt:
      'You are a meticulous code reviewer. Your purpose is to audit code for correctness, security, performance, and style. You leave no stone unturned.',
    skillIds: ['skill-code-review', 'skill-dev-agent', 'skill-step-by-step'],
  },
  {
    id: 'agent-code-changer',
    name: 'Code Changer',
    description: 'Modifies and improves source code — refactors, adds features, applies fixes.',
    systemPrompt:
      'You are an expert at modifying source code. You produce complete, working file revisions that follow project conventions. You show the full modified file, never just diffs.',
    skillIds: ['skill-code-change', 'skill-dev-agent', 'skill-code-expert'],
  },
  {
    id: 'agent-life-coach',
    name: 'Life Coach',
    description: 'A motivational assistant to help with goal setting and personal growth.',
    systemPrompt:
      'You are a world-class life coach and mentor. You help users find clarity, set realistic goals, and stay motivated.',
    skillIds: ['skill-empathy', 'skill-step-by-step'],
  },
  {
    id: 'agent-travel',
    name: 'Travel Specialist',
    description: 'Expert in local culture, hidden gems, and efficient travel logistics.',
    systemPrompt:
      'You are an expert travel consultant with deep knowledge of global destinations. You focus on unique experiences and practical advice.',
    skillIds: ['skill-step-by-step'],
  },
  {
    id: 'agent-editor',
    name: 'Writing Editor',
    description: 'Polishes your writing — emails, essays, docs, and more.',
    systemPrompt:
      "You are a professional editor. You improve writing for clarity, impact, and correctness while preserving the author's voice. When editing, show the revised version and briefly explain what you changed and why.",
    skillIds: ['skill-writing-editor', 'skill-formal-tone'],
  },
  {
    id: 'agent-debugger',
    name: 'Debugging Expert',
    description: 'Helps systematically track down and fix bugs in your code.',
    systemPrompt:
      'You are a debugging specialist. Guide users through a systematic process: reproduce the issue, isolate the root cause, fix, and verify. Ask clarifying questions before jumping to conclusions. Suggest logging, breakpoints, or minimal reproducers.',
    skillIds: ['skill-code-expert', 'skill-step-by-step'],
  },
  {
    id: 'agent-interview-coach',
    name: 'Interview Coach',
    description: 'Mock interviews and feedback for tech and behavioral questions.',
    systemPrompt:
      'You are an interview coach. Ask realistic interview questions, evaluate answers constructively, and provide actionable feedback. Cover structure (STAR method), clarity, depth, and confidence. Be encouraging but honest.',
    skillIds: ['skill-empathy', 'skill-step-by-step'],
  },
  {
    id: 'agent-meeting-assistant',
    name: 'Meeting Assistant',
    description: 'Prepares agendas, takes minutes, and summarizes decisions.',
    systemPrompt:
      'You are a meeting assistant. Help prepare agendas with clear goals and timeboxes. During discussions, capture decisions, action items, and owners. Summarize meetings into: Key Decisions, Action Items, Open Questions.',
    skillIds: ['skill-summarizer', 'skill-concise'],
  },
];

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly storage = inject(StorageService);

  readonly agents = signal<Agent[]>(
    this.storage.get<Agent[]>(AGENTS_STORAGE_KEY) ?? DEFAULT_AGENTS,
  );
  readonly skills = signal<Skill[]>(
    (this.storage.get<Skill[]>(SKILLS_STORAGE_KEY) ?? DEFAULT_SKILLS).map(normalizeSkill),
  );

  constructor() {
    effect(() => {
      this.storage.set(AGENTS_STORAGE_KEY, this.agents());
    });
    effect(() => {
      this.storage.set(SKILLS_STORAGE_KEY, this.skills());
    });
  }

  // Agent CRUD
  addAgent(agent: Omit<Agent, 'id'>) {
    const newAgent = { ...agent, id: crypto.randomUUID() };
    this.agents.update((a) => [...a, newAgent]);
    return newAgent;
  }

  updateAgent(agent: Agent) {
    this.agents.update((list) => list.map((a) => (a.id === agent.id ? agent : a)));
  }

  deleteAgent(id: string) {
    this.agents.update((list) => list.filter((a) => a.id !== id));
  }

  // Skill CRUD
  addSkill(skill: Omit<Skill, 'id'>) {
    const newSkill = { ...skill, id: crypto.randomUUID() };
    this.skills.update((s) => [...s, newSkill]);
    return newSkill;
  }

  updateSkill(skill: Skill) {
    this.skills.update((list) => list.map((s) => (s.id === skill.id ? skill : s)));
  }

  deleteSkill(id: string) {
    this.skills.update((list) => list.filter((s) => s.id !== id));
    // Also remove from agents
    this.agents.update((list) =>
      list.map((a) => ({
        ...a,
        skillIds: a.skillIds.filter((sid) => sid !== id),
      })),
    );
  }

  getAgentFullPrompt(agent: Agent): string {
    const agentSkills = this.skills().filter((s) => agent.skillIds.includes(s.id));
    const skillInstructions = agentSkills.map((s) => s.instructions).join('\n');
    return `${agent.systemPrompt}\n\nAdditional Instructions:\n${skillInstructions}`;
  }

  // ── Skill export / import ──

  exportSkillsLibrary(): string {
    const payload: SkillLibraryPayload = {
      version: 1,
      date: Date.now(),
      skills: this.skills(),
    };
    return JSON.stringify(payload, null, 2);
  }

  exportSkill(skill: Skill): string {
    return JSON.stringify(skill, null, 2);
  }

  importSkills(text: string): SkillImportResult {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Invalid skills file (not valid JSON)');
    }

    let incoming: Skill[];
    if (Array.isArray(data)) {
      incoming = data as Skill[];
    } else if (
      data &&
      typeof data === 'object' &&
      Array.isArray((data as SkillLibraryPayload).skills)
    ) {
      incoming = (data as SkillLibraryPayload).skills;
    } else if (data && typeof data === 'object' && (data as Skill).name) {
      incoming = [data as Skill];
    } else {
      throw new Error('Invalid skills file format');
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;

    this.skills.update((list) => {
      const next = [...list];
      for (const raw of incoming) {
        if (!raw?.name || !raw?.instructions) {
          skipped++;
          continue;
        }
        const skill = normalizeSkill(raw as Skill);
        const byId = next.findIndex((x) => x.id === raw.id);
        if (byId >= 0) {
          next[byId] = { ...next[byId], ...skill, id: next[byId].id };
          updated++;
          continue;
        }
        const byName = next.findIndex(
          (x) => x.name.trim().toLowerCase() === skill.name.trim().toLowerCase(),
        );
        if (byName >= 0) {
          next[byName] = { ...next[byName], ...skill, id: next[byName].id };
          updated++;
          continue;
        }
        next.push({ ...skill, id: raw.id || crypto.randomUUID() });
        added++;
      }
      return next;
    });

    return { added, updated, skipped };
  }
}

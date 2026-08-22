import { Injectable, signal, effect, inject } from '@angular/core';
import { StorageService } from './storage.service';

export interface Skill {
  id: string;
  name: string;
  description: string;
  body: string;
  license?: string;
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

/** Loose shape used when reading skills from storage or legacy/imported files. */
interface RawSkill {
  id: string;
  name: string;
  description: string;
  body?: string;
  instructions?: string;
  license?: string;
  category?: string;
  icon?: string;
}

function normalizeSkill(skill: RawSkill): Skill {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    body: skill.body ?? skill.instructions ?? '',
    license: skill.license,
    category: skill.category || 'General',
    icon: skill.icon || 'auto_awesome',
  };
}

export function slugifySkill(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function unquoteYaml(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  return v;
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
    description:
      'Writes idiomatic, maintainable code in any language. Use when the user asks for code, wants a function or component implemented, or needs best-practice guidance.',
    body: `## When to use
The user asks you to write, complete, or improve code in any language.

## Guidelines
- Use the latest stable syntax and APIs for the language.
- Prefer modern idioms (ES6+ for JS, type hints for Python, etc.).
- Handle errors and edge cases; never leave TODOs without explanation.
- Match the surrounding project's conventions and style.

## Workflow
1. Clarify the requirement if it is ambiguous.
2. Explain the approach in 1-2 sentences.
3. Output complete, runnable code in a fenced block with the file name.
4. Suggest at least one unit test.

## Examples
- "Write a debounce function in TypeScript."
- "Add pagination to this endpoint."`,
    category: 'Coding',
    icon: 'code',
  },
  {
    id: 'skill-concise',
    name: 'Brevity',
    description:
      'Keeps answers short and to the point. Use when the user asks for a quick answer or when output length matters.',
    body: `## When to use
The user wants a quick, direct answer with no fluff.

## Guidelines
- Lead with the answer.
- Keep responses under 3 sentences unless asked for detail.
- Drop filler, apologies, and redundant restatements.

## Examples
- "What is a closure?" → one or two sentences plus a one-line snippet.`,
    category: 'Communication',
    icon: 'short_text',
  },
  {
    id: 'skill-step-by-step',
    name: 'Step-by-Step',
    description:
      'Breaks complex tasks into numbered, ordered steps. Use when the user asks "how do I..." or needs a procedure, tutorial, or plan.',
    body: `## When to use
The user needs a procedure, tutorial, or plan.

## Guidelines
- Start with a one-line summary of the goal.
- Number each step; keep each step a single, concrete action.
- End with a "Next action" recommendation.

## Workflow
1. Summarize the objective.
2. List ordered steps with any prerequisites.
3. Call out expected outcomes and pitfalls.
4. Recommend the immediate next step.`,
    category: 'Productivity',
    icon: 'format_list_numbered',
  },
  {
    id: 'skill-empathy',
    name: 'Empathy',
    description:
      'Responds with emotional intelligence and support. Use when the user shares feelings, stress, or personal challenges.',
    body: `## When to use
The user is emotional, stressed, or seeking support.

## Guidelines
- Acknowledge feelings before problem-solving.
- Use a warm, supportive, non-judgmental tone.
- Avoid being clinical, robotic, or dismissive.

## Examples
- Validate first: "That sounds really frustrating."
- Then offer support, not lectures.`,
    category: 'Coaching',
    icon: 'favorite',
  },
  {
    id: 'skill-writing-editor',
    name: 'Writing & Editing',
    description:
      'Revises text for clarity, grammar, tone, and structure. Use when the user asks to improve, proofread, or tighten writing.',
    body: `## When to use
The user wants text improved, proofread, or restructured.

## Guidelines
- Preserve the author's voice and intent.
- Fix grammar, clarity, conciseness, and tone.
- Show the revised version, then briefly list key changes.
- Prefer suggestions over silent rewrites.

## Workflow
1. Read for meaning.
2. Produce the revised text.
3. Summarize what changed and why.`,
    category: 'Writing',
    icon: 'edit_note',
  },
  {
    id: 'skill-formal-tone',
    name: 'Professional Tone',
    description:
      'Rewrites content into polished, business-appropriate language. Use when the user needs formal communication such as emails, reports, or proposals.',
    body: `## When to use
The user needs polished, professional writing.

## Guidelines
- Use a clear, confident, business tone.
- Avoid slang, contractions, and casual phrasing.
- Prioritize clarity and precision over flourish.

## Examples
- "Fix this email" → formal, courteous, actionable.`,
    category: 'Writing',
    icon: 'business',
  },
  {
    id: 'skill-summarizer',
    name: 'Summarizer',
    description:
      'Condenses long content into concise summaries with key points. Use when the user asks for a summary, TL;DR, or meeting minutes.',
    body: `## When to use
The user wants a concise summary of a longer input.

## Guidelines
- Start with a one-sentence TL;DR.
- Follow with 3-5 bullet points of the most important ideas.
- Omit minor details and examples unless asked.
- Preserve key facts, numbers, and decisions.

## Examples
- Summarize a meeting, article, or document.`,
    category: 'Productivity',
    icon: 'summarize',
  },
  {
    id: 'skill-decision-framework',
    name: 'Decision Analysis',
    description:
      'Weighs options, trade-offs, and risks to recommend a path forward. Use when the user faces a decision or comparison.',
    body: `## When to use
The user must choose between options or make a decision.

## Guidelines
- Structure: Context, Options, Pros/Cons per option, Recommendation.
- Highlight trade-offs and risks explicitly.
- End with a clear, actionable recommendation.

## Workflow
1. Restate the decision and context.
2. Enumerate viable options.
3. Compare each with pros/cons.
4. Recommend one, with rationale and risk notes.`,
    category: 'Analysis',
    icon: 'account_tree',
  },
  {
    id: 'skill-brainstorming',
    name: 'Brainstorming',
    description:
      'Generates and organizes creative ideas. Use when the user wants ideas, names, or to explore possibilities.',
    body: `## When to use
The user wants to generate ideas or explore possibilities.

## Guidelines
- Aim for quantity before quality.
- Defer judgment during ideation.
- Use lateral thinking: combine, reverse, exaggerate, adapt.
- Group ideas into themes at the end.

## Workflow
1. Generate many ideas quickly.
2. Cluster into themes or categories.
3. Help the user pick and refine the strongest.`,
    category: 'Analysis',
    icon: 'lightbulb',
  },
  {
    id: 'skill-code-review',
    name: 'Code Review',
    description:
      'Audits code for bugs, security, performance, and style. Use when the user asks for a review or wants their code checked.',
    body: `## When to use
The user asks you to review, audit, or critique code.

## Guidelines
- Check for logical errors, edge cases, and null/undefined handling.
- Check for race conditions, memory leaks, and security issues (XSS, injection, auth bypass).
- Check performance, style, and adherence to conventions.
- Cite file and line for every issue.
- Rate severity: Critical / Major / Minor / Nit.

## Workflow
1. Read the code end-to-end.
2. List issues with file/line references and fixes.
3. End with an overall assessment.`,
    category: 'Coding',
    icon: 'rate_review',
  },
  {
    id: 'skill-code-change',
    name: 'Source Code Changer',
    description:
      'Modifies source code — refactors, adds features, fixes bugs. Use when the user asks you to change or patch code.',
    body: `## When to use
The user asks you to modify, refactor, or fix code.

## Guidelines
- Output the complete modified file in a code block with the file path.
- Show a brief diff summary before the code (added / removed / changed).
- Preserve all unrelated code exactly.
- Match existing indentation, naming, and style.
- Never truncate files.

## Workflow
1. Identify the change.
2. Summarize the diff.
3. Emit the full modified file.`,
    category: 'Coding',
    icon: 'build',
  },
  {
    id: 'skill-dev-agent',
    name: 'DevAgent Core',
    description:
      'Grounds answers in the user repository context. Use when operating within a codebase with the DevAgent.',
    body: `## When to use
You are operating on the user's local repository.

## Guidelines
- Ground answers in the provided project context.
- Cite specific files and paths.
- Show full files for modifications; cite lines for reviews.
- Match project conventions and existing style.

## Workflow
1. Consult the repository context.
2. Answer or modify with file references.
3. Be concise and actionable.`,
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
    (this.storage.get<RawSkill[]>(SKILLS_STORAGE_KEY) ?? DEFAULT_SKILLS).map(normalizeSkill),
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
    const blocks = agentSkills.map((s) => `## Skill: ${s.name}\n${s.description}\n\n${s.body}`);
    return `${agent.systemPrompt}\n\nActive Skills (apply these when relevant):\n\n${blocks.join('\n\n')}`;
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
    const lines = ['---', `name: ${slugifySkill(skill.name)}`, `description: ${skill.description}`];
    if (skill.license) lines.push(`license: ${skill.license}`);
    lines.push('metadata:');
    lines.push(`  title: ${JSON.stringify(skill.name)}`);
    if (skill.category) lines.push(`  category: ${JSON.stringify(skill.category)}`);
    if (skill.icon) lines.push(`  icon: ${JSON.stringify(skill.icon)}`);
    lines.push('---', '', `# ${skill.name}`, '', skill.body);
    return lines.join('\n') + '\n';
  }

  importSkills(text: string): SkillImportResult {
    if (text.trimStart().startsWith('---')) {
      return this.upsertSkills([this.parseSkillMarkdown(text)]);
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Invalid skills file (not valid JSON or SKILL.md)');
    }

    let incoming: RawSkill[];
    if (Array.isArray(data)) {
      incoming = data as RawSkill[];
    } else if (
      data &&
      typeof data === 'object' &&
      Array.isArray((data as SkillLibraryPayload).skills)
    ) {
      incoming = (data as SkillLibraryPayload).skills as RawSkill[];
    } else if (data && typeof data === 'object' && (data as Skill).name) {
      incoming = [data as RawSkill];
    } else {
      throw new Error('Invalid skills file format');
    }

    return this.upsertSkills(incoming);
  }

  private upsertSkills(incoming: RawSkill[]): SkillImportResult {
    let added = 0;
    let updated = 0;
    let skipped = 0;

    this.skills.update((list) => {
      const next = [...list];
      for (const raw of incoming) {
        if (!raw?.name || !raw?.description) {
          skipped++;
          continue;
        }
        const skill = normalizeSkill(raw);
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

  private parseSkillMarkdown(text: string): RawSkill {
    const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!match) throw new Error('Invalid SKILL.md (missing frontmatter)');

    const frontmatter: { name?: string; description?: string; license?: string } = {};
    const metadata: { title?: string; category?: string; icon?: string } = {};
    let inMetadata = false;

    for (const line of match[1].split('\n')) {
      if (!line.trim()) continue;
      const metaMatch = line.match(/^\s{2,}([\w-]+):\s*(.*)$/);
      if (metaMatch && inMetadata) {
        const key = metaMatch[1];
        const value = unquoteYaml(metaMatch[2]);
        if (key === 'title') metadata.title = value;
        else if (key === 'category') metadata.category = value;
        else if (key === 'icon') metadata.icon = value;
        continue;
      }
      const kv = line.match(/^([\w-]+):\s*(.*)$/);
      if (!kv) continue;
      const key = kv[1];
      const value = unquoteYaml(kv[2]);
      inMetadata = key === 'metadata';
      if (key === 'name') frontmatter.name = value;
      else if (key === 'description') frontmatter.description = value;
      else if (key === 'license') frontmatter.license = value;
    }

    const slug = frontmatter.name;
    const description = frontmatter.description;
    if (!slug || !description) {
      throw new Error('Invalid SKILL.md (missing name or description)');
    }

    return {
      id: crypto.randomUUID(),
      name: metadata.title ?? titleCaseSlug(slug),
      description,
      body: (match[2] || '').trim(),
      license: frontmatter.license,
      category: metadata.category,
      icon: metadata.icon,
    };
  }
}

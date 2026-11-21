/**
 * Pure helpers, types and prompt strings extracted from DevAgentTabComponent.
 * These are framework-free so they can be unit-tested in isolation.
 */

export type Mode = 'chat' | 'review' | 'modify' | 'explain';

export interface CodePatch {
  fileName: string;
  language: string;
  code: string;
  applied: boolean;
  originalCode?: string;
}

export const MODE_LABELS: Record<Mode, string> = {
  chat: 'Chat',
  review: 'Code Review',
  modify: 'Modify Code',
  explain: 'Explain',
};

export const MODE_ICONS: Record<Mode, string> = {
  chat: 'chat',
  review: 'rate_review',
  modify: 'edit',
  explain: 'help_outline',
};

export const MODE_PROMPTS: Record<Mode, string> = {
  chat: '',
  review:
    'Perform a thorough code review of the relevant code. Check for bugs, security issues, performance problems, and style violations. For each issue cite the file, explain the problem, and suggest a fix. Rate severity.',
  modify:
    'Modify the source code as requested. Output the complete modified file in a markdown code block with the file path as the language tag. Show a brief summary of what changed before the code.',
  explain:
    'Explain how the relevant code works. Describe the architecture, data flow, and key decisions. Be detailed but clear.',
};

export const SYSTEM_DEV_AGENT = `You are a Dev Agent — an expert software engineer working on the user's local repository.
You have access to the project files and can analyze, explain, and modify code.

═══════════════════════════════
CAPABILITIES
═══════════════════════════════
- Read and analyze code from the provided project context
- Perform thorough code reviews (bugs, security, performance, style)
- Explain architecture, patterns, and logic
- Modify source code and output complete revised files
- Suggest improvements, refactors, and bug fixes
- Answer questions about dependencies, config, and tooling

═══════════════════════════════
PROJECT CONTEXT
═══════════════════════════════
{CONTEXT}

═══════════════════════════════
MODE: {MODE}
═══════════════════════════════
{MODE_INSTRUCTIONS}

═══════════════════════════════
RULES
═══════════════════════════════
- Base answers on the project context above when relevant
- Quote file paths and code verbatim from the context
- When context is missing, say so and suggest what to add
- Output code in markdown code blocks with file name as the language tag
- Match the project's existing code style and conventions
- Be concise and actionable`;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/** Extracts fenced code blocks from an LLM response into CodePatch objects. */
export function extractCodeBlocks(text: string): CodePatch[] {
  const patches: CodePatch[] = [];
  // Allow word chars plus `.`, `/`, `\`, `-` so a language tag can be a file path.
  const regex = /```([\w./\\-]+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const lang = match[1] || 'text';
    const code = match[2].trim();
    if (code.length > 0) {
      const isFilePath = lang.includes('/') || lang.includes('.') || lang.includes('\\');
      patches.push({
        fileName: isFilePath ? lang : '',
        language: isFilePath ? lang.split('.').pop() || 'text' : lang,
        code,
        applied: false,
      });
    }
  }
  return patches;
}

export type DiffLine = { type: 'same' | 'add' | 'del'; text: string };

/** Minimal line-based diff (LCS) used to preview applied patches. */
export function diffLines(original: string | undefined, updated: string): DiffLine[] {
  const a = (original ?? '').split('\n');
  const b = updated.split('\n');
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] });
      i++;
    } else {
      out.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < m) out.push({ type: 'del', text: a[i++] });
  while (j < n) out.push({ type: 'add', text: b[j++] });
  return out;
}

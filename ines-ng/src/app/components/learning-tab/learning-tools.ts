/**
 * Pure helpers + prompt builders extracted from LearningTabComponent.
 * Keeping the LLM prompt strings and output parsers here makes them reusable
 * and unit-testable without Angular DI.
 */

/** Normalizes an LLM Mermaid response into clean `mindmap` syntax. */
export function cleanMermaidCode(raw: string): string {
  const m = raw.match(/```(?:mermaid)?([\s\S]*?)```/i);
  let c = m ? m[1] : raw;
  const idx = c.toLowerCase().indexOf('mindmap');
  c = idx !== -1 ? c.substring(idx) : 'mindmap\n' + c;
  const lines = c.split('\n');
  const res: string[] = ['mindmap'];
  let found = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.toLowerCase() === 'mindmap') {
      found = true;
      continue;
    }
    if (!found) continue;
    const ind = (line.match(/^(\s*)/)?.[1] || '').replace(/\t/g, '  ');
    let txt = t
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .trim();
    txt = txt
      .replace(/[()[\]{}"]/g, '')
      .replace(/\\/g, '')
      .trim();
    if (!txt) continue;
    res.push(' '.repeat(Math.min(ind.length, 8)) + `(${txt})`);
  }
  if (res.length === 1) res.push('  ((No concepts extracted))');
  return res.join('\n');
}

/** Parses an LLM flashcard response that may be JSON, CSV, markdown table or Q/A lines. */
export function parseFlashcards(raw: string): { front: string; back: string }[] {
  const text = raw.replace(/```(?:csv)?/gi, '').trim();
  const pairs: { front: string; back: string }[] = [];
  const isHeader = (a: string, b: string) => /^front$/i.test(a.trim()) && /^back$/i.test(b.trim());

  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;

    // Markdown table separator like |---|---|
    if (/^\|?\s*:?-{2,}/.test(t)) continue;

    // Markdown table row: | front | back |
    const table = t.match(/^\|?\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|?$/);
    if (table && !isHeader(table[1], table[2])) {
      pairs.push({ front: table[1].trim(), back: table[2].trim() });
      continue;
    }

    // Inline Q/A: "Q: … A: …" or "Question: … Answer: …"
    const qa = t.match(
      /^(?:q|question|front|f)\s*[:.\-]\s*(.+?)\s+(?:a|answer|back|b)\s*[:.\-]\s*(.+)$/i,
    );
    if (qa) {
      pairs.push({ front: qa[1].trim(), back: qa[2].trim() });
      continue;
    }

    // CSV: front,back
    const cells = parseCsvCells(t);
    if (cells.length >= 2 && cells[0] && cells[1] && !isHeader(cells[0], cells[1])) {
      pairs.push({ front: cells[0], back: cells.slice(1).join(', ') });
    }
  }
  return pairs;
}

/** Minimal CSV cell parser (handles quoted fields and escaped quotes). */
export function parseCsvCells(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

export function buildMindmapPrompt(context: string): string {
  return `Generate a Mermaid.js mindmap. Start with "mindmap" line 1. 2 spaces per indent. Put text with spaces in parentheses. Output ONLY valid mindmap syntax — no markdown. 5-8 main branches with sub-branches.

Example:
mindmap
  root((Overview))
    (Topic A)
      (Subtopic)
        (Detail)

Context:
${context}`;
}

export function buildQuizPrompt(nq: number, no: number, context: string): string {
  return `Generate ${nq} multiple-choice questions with ${no} options each, one correct. Output ONLY a JSON array. Example:
[{"question":"What is X?","options":["A","B","C","D"],"answer":0,"explanation":"Because..."}]

Context:
${context}`;
}

export function buildFlashcardsPrompt(context: string): string {
  return `Generate 15-20 flashcards (question/answer pairs). Output ONLY a JSON array. Example:
[{"front":"What is Angular?","back":"A TypeScript-based web framework by Google"}]

Context:
${context}`;
}

export function buildStudyPlanPrompt(context: string): string {
  return `Create a detailed study plan from the context. Include: ## Estimated Duration, ## Schedule, ## Key Topics, ## Learning Objectives, ## Practice Exercises, ## Review Milestones. Use Markdown.

Context:
${context}`;
}

export function buildSummaryPrompt(context: string): string {
  return `Create a comprehensive summary. Include: ## TL;DR, ## Key Points (5-8 bullets), ## Main Concepts, ## Important Facts, ## Conclusion. Use Markdown.

Context:
${context}`;
}

export function buildFillBlanksPrompt(context: string): string {
  return `Generate 6 fill-in-the-blank exercises. Output ONLY JSON array. Each: text (with ___), answer, hint. Example:
[{"text":"Angular uses ___ as its language.","answer":"TypeScript","hint":"Superset of JavaScript"}]

Context:
${context}`;
}

export function buildMatchingPrompt(context: string): string {
  return `Generate 6 matching pairs (term -> definition). Output ONLY JSON array. Example:
[{"term":"Angular","definition":"A TypeScript-based web framework by Google"}]

Context:
${context}`;
}

export function buildOpenQuestionPrompt(context: string): string {
  return `Generate 1 thought-provoking open-ended question. Output ONLY JSON object. Example:
{"question":"What are the trade-offs between...?","expected":"Key points: performance vs maintainability, etc."}

Context:
${context}`;
}

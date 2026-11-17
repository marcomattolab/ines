import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class JsonParserService {
  parse(text: string): unknown {
    const cleaned = this.extractJsonSnippet(text);
    if (!cleaned) return null;

    const parsed = this.tryParse(cleaned);
    if (parsed !== undefined) return parsed;

    const repaired = this.repairJson(cleaned);
    if (repaired) return repaired;

    return null;
  }

  parseArray<T = unknown>(text: string): T[] {
    const result = this.parse(text);
    if (Array.isArray(result)) return result as T[];
    return [];
  }

  parseObject<T = Record<string, unknown>>(text: string): T | null {
    const result = this.parse(text);
    if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
      return result as T;
    }
    return null;
  }

  private extractJsonSnippet(text: string): string {
    let cleaned = text.trim();

    const codeBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlock) {
      cleaned = codeBlock[1].trim();
    }

    // Prefer the bracket type matching the leading character: an array of
    // objects contains braces, so the object regex would otherwise truncate it
    // to an invalid "{...},{...}" snippet.
    if (cleaned.startsWith('[')) {
      const arrMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrMatch) return arrMatch[0];
    }
    if (cleaned.startsWith('{')) {
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objMatch) return objMatch[0];
    }

    // Embedded fallback (surrounding prose): try array before object for the
    // same reason.
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) return arrMatch[0];

    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) return objMatch[0];

    return '';
  }

  private tryParse(json: string): unknown | undefined {
    try {
      return JSON.parse(json);
    } catch {
      return undefined;
    }
  }

  private repairJson(json: string): unknown {
    let repaired = json.replace(/,(\s*[}\]])/g, '$1').replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

    const parsed = this.tryParse(repaired);
    if (parsed !== undefined) return parsed;

    return null;
  }
}

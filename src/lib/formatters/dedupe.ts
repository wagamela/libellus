import type { Formatter } from "./types";

export class JSONDeduplicator implements Formatter {
  canFormat(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  isFormatted(content: string): boolean {
    try {
      const parsed = JSON.parse(content);
      const deduped = this.deduplicate(parsed);
      const dedupedStr = JSON.stringify(deduped, null, 2);
      return content === dedupedStr;
    } catch {
      return false;
    }
  }

  format(content: string): string {
    try {
      const parsed = JSON.parse(content);
      const deduped = this.deduplicate(parsed);
      return JSON.stringify(deduped, null, 2);
    } catch {
      return content;
    }
  }

  private deduplicate(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      const seen = new Set<string>();
      return obj.filter((item) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map((item) => this.deduplicate(item));
    }
    if (obj !== null && typeof obj === "object") {
      const deduped: Record<string, unknown> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          deduped[key] = this.deduplicate((obj as Record<string, unknown>)[key]);
        }
      }
      return deduped;
    }
    return obj;
  }
}

export const jsonDeduplicator = new JSONDeduplicator();

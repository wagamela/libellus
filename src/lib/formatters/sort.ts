import type { Formatter } from "./types";

export class JSONSorter implements Formatter {
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
      const sorted = this.sortKeys(parsed);
      const sortedStr = JSON.stringify(sorted, null, 2);
      return content === sortedStr;
    } catch {
      return false;
    }
  }

  format(content: string): string {
    try {
      const parsed = JSON.parse(content);
      const sorted = this.sortKeys(parsed);
      return JSON.stringify(sorted, null, 2);
    } catch {
      return content;
    }
  }

  private sortKeys(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortKeys(item));
    }
    if (obj !== null && typeof obj === "object") {
      const sorted: Record<string, unknown> = {};
      const keys = Object.keys(obj).sort();
      for (const key of keys) {
        sorted[key] = this.sortKeys((obj as Record<string, unknown>)[key]);
      }
      return sorted;
    }
    return obj;
  }
}

export const jsonSorter = new JSONSorter();

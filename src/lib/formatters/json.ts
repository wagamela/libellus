import type { Formatter } from "./types";

export class JSONFormatter implements Formatter {
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
      const formatted = JSON.stringify(parsed, null, 2);
      return content === formatted;
    } catch {
      return false;
    }
  }

  format(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Should not happen if canFormat returned true, but be safe.
      return content;
    }
  }
}

export const jsonFormatter = new JSONFormatter();

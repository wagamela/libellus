import type { Formatter } from "./types";

export class JSONMinifier implements Formatter {
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
      const minified = JSON.stringify(parsed);
      return content === minified;
    } catch {
      return false;
    }
  }

  format(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed);
    } catch {
      return content;
    }
  }
}

export const jsonMinifier = new JSONMinifier();

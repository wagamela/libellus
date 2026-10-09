import type { Formatter } from "./types";

export class JSONValidator implements Formatter {
  canFormat(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  isFormatted(_content: string): boolean {
    // Validator always considers content as "formatted" since validation doesn't modify
    return true;
  }

  format(content: string): string {
    // Validator doesn't modify content, just validates it
    try {
      JSON.parse(content);
      return content;
    } catch {
      return content;
    }
  }

  /** Get validation error message if JSON is invalid, null if valid. */
  getError(content: string): string | null {
    try {
      JSON.parse(content);
      return null;
    } catch (error) {
      if (error instanceof SyntaxError) {
        return error.message;
      }
      return "Invalid JSON";
    }
  }
}

export const jsonValidator = new JSONValidator();

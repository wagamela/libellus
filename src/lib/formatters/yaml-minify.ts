import type { Formatter } from "./types";

export class YAMLMinifier implements Formatter {
  canFormat(content: string): boolean {
    try {
      this.minify(content);
      return true;
    } catch {
      return false;
    }
  }

  isFormatted(content: string): boolean {
    try {
      const minified = this.format(content);
      return content === minified;
    } catch {
      return false;
    }
  }

  format(content: string): string {
    return this.minify(content);
  }

  private minify(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) continue;

      // Keep the line but remove trailing comments (but keep # in strings)
      let processed = this.removeTrailingComment(trimmed);
      result.push(processed);
    }

    return result.join("\n");
  }

  private removeTrailingComment(line: string): string {
    // Simple approach: only remove comments that come after a space and #
    // This is safe because strings with # inside should not have space before #
    let inString = false;
    let stringChar = "";
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      // Handle string boundaries
      if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== "\\")) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      // Check for comment start outside of strings
      if (!inString && char === "#" && i > 0 && line[i - 1] === " ") {
        return line.substring(0, i).trimEnd();
      }

      i++;
    }

    return line;
  }
}

export const yamlMinifier = new YAMLMinifier();

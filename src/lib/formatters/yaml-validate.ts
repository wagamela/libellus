import type { Formatter } from "./types";

export class YAMLValidator implements Formatter {
  canFormat(content: string): boolean {
    return this.isValidYAML(content);
  }

  isFormatted(): boolean {
    return true;
  }

  format(content: string): string {
    return content;
  }

  getError(content: string): string | null {
    try {
      this.parseYAML(content);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid YAML";
    }
  }

  private isValidYAML(content: string): boolean {
    try {
      this.parseYAML(content);
      return true;
    } catch {
      return false;
    }
  }

  private parseYAML(content: string): Record<string, unknown> {
    const trimmed = content.trim();
    if (!trimmed) return {};

    const lines = trimmed.split("\n");
    const result: Record<string, unknown> = {};
    let currentKey: string | null = null;
    let currentValue = "";
    let inBlockLiteral = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.search(/\S/);

      // Comment line
      if (line.trim().startsWith("#")) continue;

      // Skip empty lines unless in a block literal
      if (!line.trim()) {
        if (inBlockLiteral && currentKey) {
          currentValue += "\n";
        }
        continue;
      }

      // Block literal indicator
      if (line.includes("|") || line.includes(">")) {
        inBlockLiteral = true;
        const [key] = line.split("|")[0].split(">")[0].split(":").map((s) => s.trim());
        if (key) currentKey = key;
        continue;
      }

      // End of block literal
      if (inBlockLiteral && indent === 0) {
        inBlockLiteral = false;
        if (currentKey) {
          result[currentKey] = currentValue.trim();
          currentKey = null;
          currentValue = "";
        }
      }

      // Regular key-value pair
      if (!inBlockLiteral && line.includes(":")) {
        const colonIndex = line.indexOf(":");
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        // Validate key format
        if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key)) {
          if (key.length > 0) throw new Error(`Invalid key format: ${key}`);
        }

        if (currentKey && currentValue) {
          result[currentKey] = this.parseValue(currentValue);
        }

        currentKey = key;
        currentValue = value;
      }
    }

    // Add last key-value pair
    if (currentKey) {
      result[currentKey] = this.parseValue(currentValue);
    }

    return result;
  }

  private parseValue(value: string): unknown {
    const trimmed = value.trim();

    if (trimmed === "null" || trimmed === "~" || trimmed === "") return null;
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^\d*\.\d+$/.test(trimmed)) return parseFloat(trimmed);
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
}

export const yamlValidator = new YAMLValidator();

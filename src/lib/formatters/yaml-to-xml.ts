export class YAMLToXML {
  convert(content: string): string {
    try {
      const obj = this.parseYAML(content);
      const rootKey = this.findRootKey(obj);
      const xml = this.toXML(rootKey, obj[rootKey as keyof typeof obj], 0);
      return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
    } catch {
      return content;
    }
  }

  private parseYAML(content: string): unknown {
    const trimmed = content.trim();
    if (!trimmed) return {};

    const lines = trimmed.split("\n");
    return this.parseLines(lines, 0).value;
  }

  private parseLines(
    lines: string[],
    startIndex: number,
    baseIndent: number = -1
  ): { value: unknown; endIndex: number } {
    const result: Record<string, unknown> = {};
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        i++;
        continue;
      }

      const indent = line.search(/\S/);

      if (baseIndent >= 0 && indent < baseIndent) {
        break;
      }

      if (!line.includes(":")) {
        i++;
        continue;
      }

      const colonIndex = line.indexOf(":");
      const key = line.substring(0, colonIndex).trim();
      const rest = line.substring(colonIndex + 1).trim();

      if (rest.startsWith("-")) {
        const arr: unknown[] = [];
        const listValue = rest.substring(1).trim();
        if (listValue) arr.push(this.parseValue(listValue));

        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          const nextTrimmed = nextLine.trim();
          const nextIndent = nextLine.search(/\S/);

          if (!nextTrimmed || nextTrimmed.startsWith("#")) {
            i++;
            continue;
          }

          if (nextIndent <= indent && nextTrimmed.startsWith("-")) {
            arr.push(this.parseValue(nextTrimmed.substring(1).trim()));
            i++;
          } else if (nextIndent > indent) {
            i++;
          } else {
            break;
          }
        }

        result[key] = arr;
      } else if (rest === "" || rest === "|" || rest === ">") {
        i++;
        const { value, endIndex } = this.parseLines(lines, i, indent + 2);
        result[key] = value;
        i = endIndex;
      } else {
        result[key] = this.parseValue(rest);
        i++;
      }
    }

    return { value: result, endIndex: i };
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

  private findRootKey(obj: unknown): string {
    if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
      const keys = Object.keys(obj as Record<string, unknown>);
      return keys[0] || "root";
    }
    return "root";
  }

  private toXML(key: string, value: unknown, indent: number): string {
    const spaces = "  ".repeat(indent);
    const nextSpaces = "  ".repeat(indent + 1);

    const safeKey = this.sanitizeTag(key);

    if (value === null || value === undefined) {
      return `${spaces}<${safeKey} />`;
    }

    if (typeof value === "object") {
      if (Array.isArray(value)) {
        const items = (value as unknown[])
          .map((item) => this.toXML("item", item, indent + 1))
          .join("\n");
        return `${spaces}<${safeKey}>\n${items}\n${spaces}</${safeKey}>`;
      }

      const obj = value as Record<string, unknown>;
      const children = Object.entries(obj)
        .map(([k, v]) => this.toXML(k, v, indent + 1))
        .join("\n");

      if (children) {
        return `${spaces}<${safeKey}>\n${children}\n${spaces}</${safeKey}>`;
      }
      return `${spaces}<${safeKey} />`;
    }

    const escaped = this.escapeXML(String(value));
    return `${spaces}<${safeKey}>${escaped}</${safeKey}>`;
  }

  private sanitizeTag(tag: string): string {
    return tag
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/^([0-9])/, "_$1");
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

export const yamlToXML = new YAMLToXML();

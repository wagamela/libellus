export class YAMLToCSV {
  convert(content: string): string {
    try {
      const obj = this.parseYAML(content);

      // Handle different structures
      if (Array.isArray(obj)) {
        return this.arrayToCSV(obj as Record<string, unknown>[]);
      }

      if (typeof obj === "object" && obj !== null) {
        // Single object or object with array value
        const record = obj as Record<string, unknown>;
        const arrayValue = Object.values(record).find((v) => Array.isArray(v));
        if (arrayValue) {
          return this.arrayToCSV(arrayValue as Record<string, unknown>[]);
        }
        // Convert single object to single row
        return this.objectToCSV([record]);
      }

      return content;
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

  private arrayToCSV(arr: Record<string, unknown>[]): string {
    if (arr.length === 0) return "";

    const keys = this.collectKeys(arr);
    const header = keys.map((k) => this.escapeCSV(k)).join(",");
    const rows = arr.map((obj) => keys.map((k) => this.escapeCSV(String(obj[k] ?? ""))).join(","));

    return [header, ...rows].join("\n");
  }

  private objectToCSV(arr: Record<string, unknown>[]): string {
    return this.arrayToCSV(arr);
  }

  private collectKeys(arr: Record<string, unknown>[]): string[] {
    const keyset = new Set<string>();
    for (const obj of arr) {
      Object.keys(obj).forEach((k) => keyset.add(k));
    }
    return Array.from(keyset);
  }

  private escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

export const yamlToCSV = new YAMLToCSV();

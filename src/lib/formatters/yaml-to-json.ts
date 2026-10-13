export class YAMLToJSON {
  convert(content: string): string {
    try {
      const obj = this.parseYAML(content);
      return JSON.stringify(obj, null, 2);
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

      // Check if we should stop at this indent level
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

      // Handle list value (- indicators)
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
        // Block scalar or nested object
        i++;
        const { value, endIndex } = this.parseLines(lines, i, indent + 2);
        result[key] = value;
        i = endIndex;
      } else {
        // Simple value
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
}

export const yamlToJSON = new YAMLToJSON();

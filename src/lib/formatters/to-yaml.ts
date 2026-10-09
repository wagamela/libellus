export class JSONToYAML {
  convert(content: string): string {
    try {
      const obj = JSON.parse(content);
      return this.toYAML(obj, 0);
    } catch {
      return content;
    }
  }

  private toYAML(obj: unknown, indent: number): string {
    const nextSpaces = "  ".repeat(indent + 1);

    if (obj === null) return "null";
    if (typeof obj === "boolean") return obj ? "true" : "false";
    if (typeof obj === "string") {
      if (this.needsQuotes(obj)) return `"${obj.replace(/"/g, '\\"')}"`;
      return obj;
    }
    if (typeof obj === "number") return String(obj);

    if (Array.isArray(obj)) {
      if (obj.length === 0) return "[]";
      const lines = obj.map((item) => {
        const value = this.toYAML(item, indent + 1);
        if (value.includes("\n")) {
          return `${nextSpaces}- ${value.split("\n")[0]}\n${value.split("\n").slice(1).join("\n")}`;
        }
        return `${nextSpaces}- ${value}`;
      });
      return lines.join("\n");
    }

    if (typeof obj === "object") {
      const entries = Object.entries(obj as Record<string, unknown>);
      if (entries.length === 0) return "{}";

      const lines = entries.map(([key, value]) => {
        const yaml = this.toYAML(value, indent + 1);
        const safeKey = this.isSafeKey(key) ? key : `"${key}"`;

        if (yaml.includes("\n")) {
          const yamlLines = yaml.split("\n");
          return `${nextSpaces}${safeKey}:\n${yamlLines.map((line) => (line ? `${nextSpaces}${line}` : "")).join("\n")}`;
        }
        return `${nextSpaces}${safeKey}: ${yaml}`;
      });

      return lines.join("\n");
    }

    return String(obj);
  }

  private needsQuotes(str: string): boolean {
    if (!str) return true;
    if (str === "true" || str === "false" || str === "null") return true;
    if (/^\d+$/.test(str) || /^\d*\.\d+$/.test(str)) return true;
    if (str.includes(":") || str.includes("#") || str.includes("|") || str.includes(">")) return true;
    if (str.startsWith(" ") || str.endsWith(" ")) return true;
    return false;
  }

  private isSafeKey(key: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key);
  }
}

export const jsonToYAML = new JSONToYAML();

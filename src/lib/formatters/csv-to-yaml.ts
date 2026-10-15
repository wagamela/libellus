export class CSVToYAML {
  convert(content: string): string {
    try {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length === 0) return "";

      const headers = this.parseCSVLine(lines[0]);
      if (headers.length === 0) return "";

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        for (let j = 0; j < headers.length; j++) {
          row[headers[j]] = values[j] ?? "";
        }
        rows.push(row);
      }

      return this.toYAML(rows);
    } catch {
      return content;
    }
  }

  private toYAML(obj: unknown, indent = 0): string {
    const spaces = "  ".repeat(indent);

    if (Array.isArray(obj)) {
      if (obj.length === 0) return "[]";
      return obj
        .map((item) => {
          const itemYAML = this.toYAML(item, indent + 1);
          return `${spaces}- ${itemYAML.trimStart()}`;
        })
        .join("\n");
    }

    if (obj !== null && typeof obj === "object") {
      const record = obj as Record<string, unknown>;
      const keys = Object.keys(record);
      if (keys.length === 0) return "{}";

      return keys
        .map((key) => {
          const value = record[key];
          const escapedKey = this.escapeYAMLKey(key);
          const valueYAML = this.toYAML(value, indent + 1);
          if (valueYAML.includes("\n")) {
            return `${spaces}${escapedKey}:\n${valueYAML}`;
          }
          return `${spaces}${escapedKey}: ${valueYAML}`;
        })
        .join("\n");
    }

    const str = String(obj ?? "");
    if (this.needsQuotes(str)) {
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  private escapeYAMLKey(key: string): string {
    if (/[:\[\]{},&*#!|>'"%@`]/.test(key) || /^[-?]/.test(key)) {
      return `"${key.replace(/"/g, '\\"')}"`;
    }
    return key;
  }

  private needsQuotes(str: string): boolean {
    if (str === "") return true;
    if (/^[0-9]+$/.test(str)) return false;
    if (/^(true|false|null|~|yes|no|on|off)$/i.test(str)) return true;
    if (/[:\[\]{},&*#!|>'"%@`]/.test(str) || /^[-?]/.test(str)) return true;
    return false;
  }
}

export const csvToYAML = new CSVToYAML();

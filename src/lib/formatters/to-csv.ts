export class JSONToCSV {
  convert(content: string): string {
    try {
      const obj = JSON.parse(content);
      return this.toCSV(obj);
    } catch {
      return content;
    }
  }

  private toCSV(obj: unknown): string {
    if (Array.isArray(obj)) {
      return this.arrayToCSV(obj);
    }
    if (obj !== null && typeof obj === "object") {
      return this.objectToCSV(obj as Record<string, unknown>);
    }
    return String(obj);
  }

  private arrayToCSV(arr: unknown[]): string {
    if (arr.length === 0) return "";

    if (arr.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))) {
      const items = arr as Record<string, unknown>[];
      const allKeys = new Set<string>();
      items.forEach((item) => {
        Object.keys(item).forEach((key) => allKeys.add(key));
      });

      const headers = Array.from(allKeys);
      const rows = items.map((item) =>
        headers.map((header) => this.escapeCSV(String(item[header] ?? "")))
      );

      return [headers.map((h) => this.escapeCSV(h)), ...rows].map((row) => row.join(",")).join("\n");
    }

    return arr.map((item) => this.escapeCSV(String(item))).join("\n");
  }

  private objectToCSV(obj: Record<string, unknown>): string {
    const keys = Object.keys(obj);
    const values = keys.map((key) => {
      const val = obj[key];
      if (Array.isArray(val) || (typeof val === "object" && val !== null)) {
        return this.escapeCSV(JSON.stringify(val));
      }
      return this.escapeCSV(String(val ?? ""));
    });

    return [keys.map((k) => this.escapeCSV(k)), values].map((row) => row.join(",")).join("\n");
  }

  private escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

export const jsonToCSV = new JSONToCSV();

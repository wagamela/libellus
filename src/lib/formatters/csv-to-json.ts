export class CSVToJSON {
  convert(content: string): string {
    try {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length === 0) return "[]";

      const headers = this.parseCSVLine(lines[0]);
      if (headers.length === 0) return "[]";

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        for (let j = 0; j < headers.length; j++) {
          row[headers[j]] = values[j] ?? "";
        }
        rows.push(row);
      }

      return JSON.stringify(rows, null, 2);
    } catch {
      return content;
    }
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
}

export const csvToJSON = new CSVToJSON();

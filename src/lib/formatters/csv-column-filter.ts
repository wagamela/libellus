export class CSVColumnFilter {
  selectColumns(content: string, columnIndices: number[]): string {
    try {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length === 0) return "";

      const parsed = lines.map((line) => this.parseCSVLine(line));
      const filtered = parsed.map((row) =>
        columnIndices
          .map((idx) => (idx >= 0 && idx < row.length ? row[idx] : ""))
          .join(",")
      );

      return filtered.join("\n");
    } catch {
      return content;
    }
  }

  selectColumnsByName(content: string, columnNames: string[]): string {
    try {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length === 0) return "";

      const headerLine = lines[0];
      const headers = this.parseCSVLine(headerLine);
      const columnIndices = columnNames
        .map((name) =>
          headers.findIndex((h) => h.toLowerCase() === name.toLowerCase())
        )
        .filter((idx) => idx !== -1);

      if (columnIndices.length === 0) return "";
      return this.selectColumns(content, columnIndices);
    } catch {
      return content;
    }
  }

  dropColumns(content: string, columnIndices: number[]): string {
    try {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length === 0) return "";

      const parsed = lines.map((line) => this.parseCSVLine(line));
      const maxIndex = parsed.reduce((max, row) => Math.max(max, row.length), 0);

      const keptIndices = Array.from({ length: maxIndex }, (_, i) => i).filter(
        (i) => !columnIndices.includes(i)
      );

      return this.selectColumns(content, keptIndices);
    } catch {
      return content;
    }
  }

  dropColumnsByName(content: string, columnNames: string[]): string {
    try {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length === 0) return "";

      const headerLine = lines[0];
      const headers = this.parseCSVLine(headerLine);
      const columnIndices = columnNames
        .map((name) =>
          headers.findIndex((h) => h.toLowerCase() === name.toLowerCase())
        )
        .filter((idx) => idx !== -1);

      return this.dropColumns(content, columnIndices);
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

export const csvColumnFilter = new CSVColumnFilter();

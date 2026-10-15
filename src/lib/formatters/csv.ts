import type { Formatter } from "./types";

export class CSVFormatter implements Formatter {
  canFormat(content: string): boolean {
    const lines = content.trim().split(/\r?\n/);
    if (lines.length < 1) return false;
    // At least one comma in the first line (header) or multiple lines
    return lines[0].includes(",") || lines.length > 1;
  }

  isFormatted(content: string): boolean {
    try {
      const formatted = this.format(content);
      return content === formatted;
    } catch {
      return false;
    }
  }

  format(content: string): string {
    try {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length === 0) return "";

      const parsed = lines.map((line) => this.parseCSVLine(line));
      if (parsed.length === 0) return "";

      // Calculate max width for each column
      const columnWidths: number[] = [];
      for (const row of parsed) {
        for (let i = 0; i < row.length; i++) {
          columnWidths[i] = Math.max(columnWidths[i] ?? 0, row[i].length);
        }
      }

      // Format rows with consistent spacing
      const formatted = parsed
        .map((row) => row.map((cell, i) => this.padCell(cell, columnWidths[i] ?? 0)).join(" , "))
        .join("\n");

      return formatted;
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
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  private padCell(cell: string, width: number): string {
    return cell.padEnd(width);
  }
}

export const csvFormatter = new CSVFormatter();

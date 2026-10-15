import type { Formatter } from "./types";

export class CSVValidator implements Formatter {
  canFormat(content: string): boolean {
    return this.validate(content) === null;
  }

  isFormatted(_content: string): boolean {
    return true;
  }

  format(content: string): string {
    return content;
  }

  validate(content: string): string | null {
    const lines = content.trim().split(/\r?\n/);
    if (lines.length === 0) return "Empty CSV";

    // Check for balanced quotes
    for (let i = 0; i < lines.length; i++) {
      const error = this.validateLine(lines[i]);
      if (error) return `Line ${i + 1}: ${error}`;
    }

    // Check column consistency
    const firstLineCols = this.parseCSVLine(lines[0]).length;
    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCSVLine(lines[i]).length;
      if (cols !== firstLineCols) {
        return `Line ${i + 1}: Expected ${firstLineCols} columns, got ${cols}`;
      }
    }

    return null;
  }

  private validateLine(line: string): string | null {
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      }
    }

    if (inQuotes) return "Unbalanced quotes";
    return null;
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

export const csvValidator = new CSVValidator();

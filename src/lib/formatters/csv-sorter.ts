export class CSVSorter {
  sortByColumn(content: string, columnIndex: number, ascending = true): string {
    try {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length < 2) return content;

      const header = lines[0];
      const rows = lines.slice(1).map((line) => ({
        original: line,
        parsed: this.parseCSVLine(line),
      }));

      // Validate column index
      const headerParsed = this.parseCSVLine(header);
      if (columnIndex < 0 || columnIndex >= headerParsed.length) {
        return content;
      }

      // Sort rows
      rows.sort((a, b) => {
        const aValue = a.parsed[columnIndex] ?? "";
        const bValue = b.parsed[columnIndex] ?? "";

        // Try numeric comparison
        const aNum = parseFloat(aValue);
        const bNum = parseFloat(bValue);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return ascending ? aNum - bNum : bNum - aNum;
        }

        // Fallback to string comparison
        const comparison = aValue.localeCompare(bValue);
        return ascending ? comparison : -comparison;
      });

      return [header, ...rows.map((r) => r.original)].join("\n");
    } catch {
      return content;
    }
  }

  sortByColumnName(content: string, columnName: string, ascending = true): string {
    try {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length < 2) return content;

      const headerLine = lines[0];
      const headers = this.parseCSVLine(headerLine);
      const columnIndex = headers.findIndex(
        (h) => h.toLowerCase() === columnName.toLowerCase()
      );

      if (columnIndex === -1) return content;
      return this.sortByColumn(content, columnIndex, ascending);
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

export const csvSorter = new CSVSorter();

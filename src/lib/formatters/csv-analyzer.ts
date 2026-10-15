export interface ColumnAnalysis {
  name: string;
  index: number;
  count: number;
  uniqueCount: number;
  emptyCount: number;
  dataType: "string" | "number" | "boolean" | "mixed";
  samples: string[];
}

export interface CSVAnalysisResult {
  totalRows: number;
  totalColumns: number;
  columns: ColumnAnalysis[];
}

export class CSVAnalyzer {
  analyze(content: string): CSVAnalysisResult {
    try {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length === 0) {
        return {
          totalRows: 0,
          totalColumns: 0,
          columns: [],
        };
      }

      const headers = this.parseCSVLine(lines[0]);
      const dataRows = lines.slice(1);

      const result: CSVAnalysisResult = {
        totalRows: dataRows.length,
        totalColumns: headers.length,
        columns: headers.map((_, index) => this.analyzeColumn(dataRows, headers, index)),
      };

      return result;
    } catch {
      return {
        totalRows: 0,
        totalColumns: 0,
        columns: [],
      };
    }
  }

  private analyzeColumn(rows: string[], headers: string[], columnIndex: number): ColumnAnalysis {
    const values: string[] = [];
    const uniqueValues = new Set<string>();
    let emptyCount = 0;

    for (const row of rows) {
      const parsed = this.parseCSVLine(row);
      const value = parsed[columnIndex] ?? "";

      values.push(value);
      if (value.trim() === "") {
        emptyCount++;
      } else {
        uniqueValues.add(value);
      }
    }

    const dataType = this.detectDataType(values.filter((v) => v.trim() !== ""));

    // Get up to 5 samples
    const samples = Array.from(uniqueValues)
      .slice(0, 5)
      .sort();

    return {
      name: headers[columnIndex],
      index: columnIndex,
      count: rows.length,
      uniqueCount: uniqueValues.size,
      emptyCount,
      dataType,
      samples,
    };
  }

  private detectDataType(values: string[]): "string" | "number" | "boolean" | "mixed" {
    if (values.length === 0) return "string";

    let numberCount = 0;
    let booleanCount = 0;
    let stringCount = 0;

    for (const value of values) {
      const trimmed = value.trim();
      if (/^true|false$/i.test(trimmed)) {
        booleanCount++;
      } else if (/^-?\d+\.?\d*$/.test(trimmed)) {
        numberCount++;
      } else {
        stringCount++;
      }
    }

    const total = numberCount + booleanCount + stringCount;
    if (total === 0) return "string";

    // If 80%+ are one type, classify as that type
    if (numberCount / total >= 0.8) return "number";
    if (booleanCount / total >= 0.8) return "boolean";
    if (stringCount / total >= 0.8) return "string";

    return "mixed";
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

  formatAnalysis(analysis: CSVAnalysisResult): string {
    let output = `CSV Analysis\n`;
    output += `${"-".repeat(50)}\n`;
    output += `Total Rows: ${analysis.totalRows}\n`;
    output += `Total Columns: ${analysis.totalColumns}\n\n`;

    for (const col of analysis.columns) {
      output += `Column: ${col.name} (${col.index})\n`;
      output += `  Type: ${col.dataType}\n`;
      output += `  Values: ${col.count}\n`;
      output += `  Unique: ${col.uniqueCount}\n`;
      output += `  Empty: ${col.emptyCount}\n`;
      if (col.samples.length > 0) {
        output += `  Samples: ${col.samples.join(", ")}\n`;
      }
      output += "\n";
    }

    return output;
  }
}

export const csvAnalyzer = new CSVAnalyzer();

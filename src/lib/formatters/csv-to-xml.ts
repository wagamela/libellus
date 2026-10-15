export class CSVToXML {
  convert(content: string): string {
    try {
      const lines = content.trim().split(/\r?\n/);
      if (lines.length === 0) return "";

      const headers = this.parseCSVLine(lines[0]);
      if (headers.length === 0) return "";

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<records>\n';

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        xml += "  <record>\n";

        for (let j = 0; j < headers.length; j++) {
          const value = values[j] ?? "";
          const tagName = this.sanitizeTagName(headers[j]);
          const escapedValue = this.escapeXML(value);
          xml += `    <${tagName}>${escapedValue}</${tagName}>\n`;
        }

        xml += "  </record>\n";
      }

      xml += "</records>";
      return xml;
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

  private sanitizeTagName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "")
      .replace(/^[0-9]/, "n$&")
      .replace(/^-/, "")
      || "field";
  }

  private escapeXML(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

export const csvToXML = new CSVToXML();

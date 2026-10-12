export class XMLToCSV {
  convert(content: string): string {
    try {
      const doc = new DOMParser().parseFromString(content, "application/xml");
      if (doc.documentElement.nodeName.includes("parsererror")) {
        return content;
      }

      const rows: Array<Record<string, string>> = [];
      const allKeys = new Set<string>();

      // Find all direct child elements to use as rows
      const children = Array.from(doc.documentElement.children);

      if (children.length === 0) {
        // If no children, extract attributes from root
        const attrs = doc.documentElement.attributes;
        if (attrs.length === 0) return "value\n" + (doc.documentElement.textContent?.trim() || "");

        const headers = Array.from(attrs).map((a) => a.name);
        const values = Array.from(attrs).map((a) => this.escapeCSV(a.value));
        return headers.join(",") + "\n" + values.join(",");
      }

      // Process each child as a row
      for (const child of children) {
        const rowData: Record<string, string> = {};
        this.extractRowData(child as Element, rowData);

        for (const key of Object.keys(rowData)) {
          allKeys.add(key);
        }

        rows.push(rowData);
      }

      // Convert to CSV
      const headers = Array.from(allKeys);
      let csv = headers.map((h) => this.escapeCSV(h)).join(",") + "\n";

      for (const row of rows) {
        const values = headers.map((h) => this.escapeCSV(row[h] || ""));
        csv += values.join(",") + "\n";
      }

      return csv.trim();
    } catch {
      return content;
    }
  }

  private extractRowData(element: Element, result: Record<string, string>, prefix = ""): void {
    // Add attributes
    for (const attr of Array.from(element.attributes)) {
      const key = prefix ? `${prefix}_${attr.name}` : attr.name;
      result[key] = attr.value;
    }

    // Add direct text content
    let textContent = "";
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim() || "";
        if (text) {
          textContent += text;
        }
      }
    }

    if (textContent) {
      const key = prefix ? `${prefix}_text` : element.tagName;
      result[key] = textContent;
    }

    // Add nested elements (if they're simple)
    for (const child of Array.from(element.children)) {
      const childKey = prefix ? `${prefix}_${child.tagName}` : child.tagName;

      // Only add if child has no children (leaf node)
      if (child.children.length === 0) {
        const text = child.textContent?.trim() || "";
        if (text) {
          result[childKey] = text;
        }
      }
    }
  }

  private escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

export const xmlToCSV = new XMLToCSV();

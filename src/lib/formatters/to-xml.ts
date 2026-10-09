export class JSONToXML {
  convert(content: string): string {
    try {
      const obj = JSON.parse(content);
      const xml = this.toXML(obj, "root", 0);
      return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
    } catch {
      return content;
    }
  }

  private toXML(obj: unknown, name: string, indent: number): string {
    const spaces = "  ".repeat(indent);

    if (obj === null) {
      return `${spaces}<${name}/>`;
    }

    if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
      const value = this.escapeXML(String(obj));
      return `${spaces}<${name}>${value}</${name}>`;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return `${spaces}<${name}/>`;
      }

      const items = obj
        .map((item) => this.toXML(item, this.singularize(name), indent + 1))
        .join("\n");
      return `${spaces}<${name}>\n${items}\n${spaces}</${name}>`;
    }

    if (typeof obj === "object") {
      const entries = Object.entries(obj as Record<string, unknown>);
      if (entries.length === 0) {
        return `${spaces}<${name}/>`;
      }

      const items = entries
        .map(([key, value]) => this.toXML(value, this.sanitizeTagName(key), indent + 1))
        .join("\n");
      return `${spaces}<${name}>\n${items}\n${spaces}</${name}>`;
    }

    return `${spaces}<${name}/>`;
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private sanitizeTagName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_:-]/g, "_")
      .replace(/^[0-9-]/g, "_")
      .slice(0, 200);
  }

  private singularize(name: string): string {
    if (name.endsWith("ies")) return name.slice(0, -3) + "y";
    if (name.endsWith("es")) return name.slice(0, -2);
    if (name.endsWith("s")) return name.slice(0, -1);
    return name;
  }
}

export const jsonToXML = new JSONToXML();

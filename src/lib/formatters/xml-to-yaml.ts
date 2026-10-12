export class XMLToYAML {
  convert(content: string): string {
    try {
      const doc = new DOMParser().parseFromString(content, "application/xml");
      if (doc.documentElement.nodeName.includes("parsererror")) {
        return content;
      }
      const json = this.elementToJSON(doc.documentElement);
      return this.toYAML(json, 0);
    } catch {
      return content;
    }
  }

  private elementToJSON(element: Element): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Add attributes with @ prefix
    if (element.attributes.length > 0) {
      const attrs: Record<string, string> = {};
      for (const attr of Array.from(element.attributes)) {
        attrs[attr.name] = attr.value;
      }
      result["@attributes"] = attrs;
    }

    // Process child nodes
    const children: Record<string, unknown> = {};
    let textContent = "";

    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childElement = child as Element;
        const childName = childElement.tagName;
        const childJSON = this.elementToJSON(childElement);

        if (children[childName]) {
          if (Array.isArray(children[childName])) {
            (children[childName] as unknown[]).push(childJSON);
          } else {
            children[childName] = [children[childName], childJSON];
          }
        } else {
          children[childName] = childJSON;
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim() || "";
        if (text) {
          textContent += text;
        }
      }
    }

    // Merge children and text content
    if (Object.keys(children).length > 0) {
      Object.assign(result, children);
      if (textContent) {
        result["#text"] = textContent;
      }
    } else if (textContent) {
      result["#text"] = textContent;
    }

    const resultWrapper: Record<string, unknown> = {};
    resultWrapper[element.tagName] = Object.keys(result).length > 0 ? result : null;
    return resultWrapper;
  }

  private toYAML(obj: unknown, indent: number): string {
    const nextSpaces = "  ".repeat(indent + 1);

    if (obj === null) return "null";
    if (typeof obj === "boolean") return obj ? "true" : "false";
    if (typeof obj === "string") {
      if (this.needsQuotes(obj)) return `"${obj.replace(/"/g, '\\"')}"`;
      return obj;
    }
    if (typeof obj === "number") return String(obj);

    if (Array.isArray(obj)) {
      if (obj.length === 0) return "[]";
      const lines = obj.map((item) => {
        const value = this.toYAML(item, indent + 1);
        if (value.includes("\n")) {
          return `${nextSpaces}- ${value.split("\n")[0]}\n${value.split("\n").slice(1).join("\n")}`;
        }
        return `${nextSpaces}- ${value}`;
      });
      return lines.join("\n");
    }

    if (typeof obj === "object") {
      const entries = Object.entries(obj as Record<string, unknown>);
      if (entries.length === 0) return "{}";

      const lines = entries.map(([key, value]) => {
        const yaml = this.toYAML(value, indent + 1);
        const safeKey = this.isSafeKey(key) ? key : `"${key}"`;

        if (yaml.includes("\n")) {
          const yamlLines = yaml.split("\n");
          return `${nextSpaces}${safeKey}:\n${yamlLines.map((line) => (line ? `${nextSpaces}${line}` : "")).join("\n")}`;
        }
        return `${nextSpaces}${safeKey}: ${yaml}`;
      });

      return lines.join("\n");
    }

    return String(obj);
  }

  private needsQuotes(str: string): boolean {
    if (!str) return true;
    if (str === "true" || str === "false" || str === "null") return true;
    if (/^\d+$/.test(str) || /^\d*\.\d+$/.test(str)) return true;
    if (str.includes(":") || str.includes("#") || str.includes("|") || str.includes(">")) return true;
    if (str.startsWith(" ") || str.endsWith(" ")) return true;
    return false;
  }

  private isSafeKey(key: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key);
  }
}

export const xmlToYAML = new XMLToYAML();

import type { Formatter } from "./types";

export class XMLFormatter implements Formatter {
  canFormat(content: string): boolean {
    try {
      const doc = new DOMParser().parseFromString(content, "application/xml");
      return !doc.documentElement.nodeName.includes("parsererror");
    } catch {
      return false;
    }
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
      const doc = new DOMParser().parseFromString(content, "application/xml");
      if (doc.documentElement.nodeName.includes("parsererror")) {
        return content;
      }
      return this.prettyPrint(doc.documentElement, 0);
    } catch {
      return content;
    }
  }

  private prettyPrint(node: Element, indent: number): string {
    const spaces = "  ".repeat(indent);
    const nextSpaces = "  ".repeat(indent + 1);
    let result = `${spaces}<${node.tagName}`;

    for (const attr of Array.from(node.attributes)) {
      result += ` ${attr.name}="${this.escapeAttr(attr.value)}"`;
    }

    if (node.childNodes.length === 0) {
      result += " />";
    } else {
      const hasElementChild = Array.from(node.childNodes).some(
        (n) => n.nodeType === Node.ELEMENT_NODE
      );

      if (hasElementChild) {
        result += ">\n";
        for (const child of Array.from(node.childNodes)) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            result += this.prettyPrint(child as Element, indent + 1) + "\n";
          } else if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent?.trim() || "";
            if (text) {
              result += `${nextSpaces}${this.escapeText(text)}\n`;
            }
          }
        }
        result += `${spaces}</${node.tagName}>`;
      } else {
        const text = node.textContent || "";
        result += `>${this.escapeText(text)}</${node.tagName}>`;
      }
    }

    return result;
  }

  private escapeAttr(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private escapeText(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

export const xmlFormatter = new XMLFormatter();

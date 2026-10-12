import type { Formatter } from "./types";

export class XMLMinifier implements Formatter {
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
      const minified = this.format(content);
      return content === minified;
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
      return this.minify(doc.documentElement);
    } catch {
      return content;
    }
  }

  private minify(node: Element): string {
    let result = `<${node.tagName}`;

    for (const attr of Array.from(node.attributes)) {
      result += ` ${attr.name}="${this.escapeAttr(attr.value)}"`;
    }

    if (node.childNodes.length === 0) {
      result += " />";
    } else {
      result += ">";
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          result += this.minify(child as Element);
        } else if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent?.trim() || "";
          if (text) {
            result += this.escapeText(text);
          }
        }
      }
      result += `</${node.tagName}>`;
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

export const xmlMinifier = new XMLMinifier();

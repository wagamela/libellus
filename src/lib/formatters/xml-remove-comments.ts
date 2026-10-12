import type { Formatter } from "./types";

export class XMLRemoveComments implements Formatter {
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
      return content.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+\n/g, "\n");
    } catch {
      return content;
    }
  }
}

export const xmlRemoveComments = new XMLRemoveComments();

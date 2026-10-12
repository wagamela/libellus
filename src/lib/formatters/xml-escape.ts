import type { Formatter } from "./types";

export class XMLEscape implements Formatter {
  canFormat(content: string): boolean {
    return content.length > 0;
  }

  isFormatted(_content: string): boolean {
    return false;
  }

  format(content: string): string {
    return this.escapeXML(content);
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

export const xmlEscape = new XMLEscape();

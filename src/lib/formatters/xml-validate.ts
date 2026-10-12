import type { Formatter } from "./types";

export class XMLValidator implements Formatter {
  canFormat(content: string): boolean {
    try {
      const doc = new DOMParser().parseFromString(content, "application/xml");
      return !doc.documentElement.nodeName.includes("parsererror");
    } catch {
      return false;
    }
  }

  isFormatted(_content: string): boolean {
    return true;
  }

  format(content: string): string {
    try {
      new DOMParser().parseFromString(content, "application/xml");
      return content;
    } catch {
      return content;
    }
  }

  getError(content: string): string | null {
    try {
      const doc = new DOMParser().parseFromString(content, "application/xml");
      if (doc.documentElement.nodeName.includes("parsererror")) {
        const errorNode = doc.getElementsByTagName("parsererror")[0];
        return errorNode?.textContent || "Invalid XML";
      }
      return null;
    } catch (error) {
      if (error instanceof Error) {
        return error.message;
      }
      return "Invalid XML";
    }
  }
}

export const xmlValidator = new XMLValidator();

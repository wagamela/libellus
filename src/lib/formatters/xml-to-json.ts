export class XMLToJSON {
  convert(content: string): string {
    try {
      const doc = new DOMParser().parseFromString(content, "application/xml");
      if (doc.documentElement.nodeName.includes("parsererror")) {
        return content;
      }
      const json = this.elementToJSON(doc.documentElement);
      return JSON.stringify(json, null, 2);
    } catch {
      return content;
    }
  }

  private elementToJSON(element: Element): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const tagName = element.tagName;

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
    resultWrapper[tagName] = Object.keys(result).length > 0 ? result : null;
    return resultWrapper;
  }
}

export const xmlToJSON = new XMLToJSON();

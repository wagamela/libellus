export class JSONToTypeScript {
  convert(content: string): string {
    try {
      const obj = JSON.parse(content);
      return this.generateType(obj, "Data");
    } catch {
      return content;
    }
  }

  private generateType(obj: unknown, name: string, indent = ""): string {
    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return `export type ${name} = unknown[];`;
      }
      const itemType = this.getType(obj[0], `${name}Item`);
      return `export type ${name} = ${itemType}[];`;
    }

    if (obj !== null && typeof obj === "object") {
      const lines: string[] = [];
      lines.push(`export interface ${name} {`);

      const entries = Object.entries(obj as Record<string, unknown>);
      for (const [key, value] of entries) {
        const type = this.getType(value, this.capitalize(key));
        const safeName = this.isSafeKey(key) ? key : `"${key}"`;
        lines.push(`${indent}  ${safeName}: ${type};`);
      }

      lines.push(`}`);
      return lines.join("\n");
    }

    return "unknown";
  }

  private getType(value: unknown, name: string): string {
    if (value === null) return "null";
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value)) {
      if (value.length === 0) return "unknown[]";
      return `${this.getType(value[0], `${name}Item`)}[]`;
    }
    if (typeof value === "object") return name;
    return "unknown";
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private isSafeKey(key: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
  }
}

export const jsonToTypeScript = new JSONToTypeScript();

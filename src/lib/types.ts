export type DocKind = "note" | "snippet";

export type Language =
  | "markdown"
  | "typescript"
  | "javascript"
  | "json"
  | "html"
  | "python"
  | "rust"
  | "cpp"
  | "csharp"
  | "sql"
  | "yaml"
  | "csv"
  | "xml"
  | "text";

export interface Doc {
  id: string;
  kind: DocKind;
  title: string;
  language: Language;
  body: string;
  /** While true the title follows the first line of the body. */
  autoTitle: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * What the workspace knows about a secret. The value itself is in the OS
 * credential store under `id` and is never part of this shape, so nothing that
 * reads, searches or exports the store can reach it.
 */
export interface SecretMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** Everything libellus persists. Versioned so early stores can be migrated. */
export interface Store {
  version: 2;
  docs: Doc[];
  secrets: SecretMeta[];
  openTabs: string[];
  activeTab: string | null;
}

export const emptyStore: Store = {
  version: 2,
  docs: [],
  secrets: [],
  openTabs: [],
  activeTab: null,
};

export const LANGUAGES: Language[] = [
  "markdown",
  "typescript",
  "javascript",
  "json",
  "html",
  "python",
  "rust",
  "cpp",
  "csharp",
  "sql",
  "yaml",
  "csv",
  "xml",
  "text",
];

export function newId(): string {
  return crypto.randomUUID();
}

/** The file extension a document is offered under when it is saved out. */
export const LANGUAGE_EXTENSION: Record<Language, string> = {
  markdown: "md",
  typescript: "ts",
  javascript: "js",
  json: "json",
  html: "html",
  python: "py",
  rust: "rs",
  cpp: "cpp",
  csharp: "cs",
  sql: "sql",
  yaml: "yaml",
  csv: "csv",
  xml: "xml",
  text: "txt",
};

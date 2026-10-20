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
  /** The project the document belongs to; null when it belongs to none. */
  projectId: string | null;
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
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * A named group of notes, snippets and secrets. Deliberately nothing more: no
 * nesting, no status, no members — organisation, not project management.
 */
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** Everything libellus persists. Versioned so early stores can be migrated. */
export interface Store {
  version: 3;
  docs: Doc[];
  secrets: SecretMeta[];
  projects: Project[];
  /** The project new documents and secrets land in, and quick open leads with. */
  activeProject: string | null;
  openTabs: string[];
  activeTab: string | null;
}

export const emptyStore: Store = {
  version: 3,
  docs: [],
  secrets: [],
  projects: [],
  activeProject: null,
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

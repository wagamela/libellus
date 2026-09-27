export type DocKind = "note" | "snippet";

export type Language =
  | "markdown"
  | "typescript"
  | "javascript"
  | "json"
  | "python"
  | "rust"
  | "sql"
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

/** Everything libellus persists. Versioned so early stores can be migrated. */
export interface Store {
  version: 1;
  docs: Doc[];
  openTabs: string[];
  activeTab: string | null;
}

export const emptyStore: Store = {
  version: 1,
  docs: [],
  openTabs: [],
  activeTab: null,
};

export const LANGUAGES: Language[] = [
  "markdown",
  "typescript",
  "javascript",
  "json",
  "python",
  "rust",
  "sql",
  "text",
];

export function newId(): string {
  return crypto.randomUUID();
}

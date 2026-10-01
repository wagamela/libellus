import {
  HighlightStyle,
  LanguageDescription,
  syntaxHighlighting,
  indentUnit,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { Language } from "./types";

/**
 * A single-hue syntax palette: every token is a dark blue-grey or white, and
 * token classes are separated by brightness alone. No colour competes for
 * attention because there is only one.
 */
const libellusHighlight = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#5d6878", fontStyle: "italic" },
  { tag: [t.keyword, t.modifier, t.controlKeyword], color: "#9fb0c6" },
  { tag: [t.string, t.special(t.string)], color: "#b8c4d4" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "#ced9e7" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#dde6f1" },
  { tag: [t.typeName, t.className, t.namespace], color: "#c3cfdd" },
  { tag: [t.propertyName, t.attributeName], color: "#a4b1c1" },
  { tag: [t.variableName, t.definition(t.variableName)], color: "#eef3f9" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "#7b8797" },
  { tag: [t.heading], color: "#ffffff", fontWeight: "600" },
  { tag: [t.heading1, t.heading2], color: "#ffffff", fontWeight: "700" },
  { tag: [t.link, t.url], color: "#ced9e7", textDecoration: "underline" },
  { tag: [t.emphasis], fontStyle: "italic" },
  { tag: [t.strong], fontWeight: "600" },
  { tag: [t.quote], color: "#8b97a8" },
  { tag: [t.monospace], color: "#c3cfdd" },
  { tag: [t.invalid], color: "#c8d2df", textDecoration: "underline wavy" },
]);

export const libellusTheme: Extension = [
  EditorView.theme(
    {
      "&": { color: "#eef3f9", backgroundColor: "transparent" },
      ".cm-foldPlaceholder": {
        backgroundColor: "#252c37",
        border: "1px solid #313a47",
        color: "#8b97a8",
      },
      ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor: "#33404f",
        outline: "none",
      },
    },
    { dark: true },
  ),
  syntaxHighlighting(libellusHighlight),
  indentUnit.of("  "),
];

/**
 * The grammars a fenced code block inside a note can ask for. They are
 * descriptions rather than extensions, so a block only pulls its grammar in
 * when the document actually contains one — the same laziness as `loadLanguage`,
 * one level down.
 */
const CODE_LANGUAGES: LanguageDescription[] = [
  LanguageDescription.of({
    name: "typescript",
    alias: ["ts", "tsx"],
    load: async () => (await import("@codemirror/lang-javascript")).javascript({ typescript: true }),
  }),
  LanguageDescription.of({
    name: "javascript",
    alias: ["js", "jsx"],
    load: async () => (await import("@codemirror/lang-javascript")).javascript(),
  }),
  LanguageDescription.of({
    name: "json",
    alias: ["jsonc"],
    load: async () => (await import("@codemirror/lang-json")).json(),
  }),
  LanguageDescription.of({
    name: "python",
    alias: ["py"],
    load: async () => (await import("@codemirror/lang-python")).python(),
  }),
  LanguageDescription.of({
    name: "rust",
    alias: ["rs"],
    load: async () => (await import("@codemirror/lang-rust")).rust(),
  }),
  LanguageDescription.of({
    name: "sql",
    load: async () => (await import("@codemirror/lang-sql")).sql(),
  }),
];

/**
 * Language support is loaded on demand: the startup bundle carries the editor
 * and nothing else, and a grammar only arrives when a document asks for it.
 */
export async function loadLanguage(language: Language): Promise<Extension> {
  switch (language) {
    case "markdown":
      return (await import("@codemirror/lang-markdown")).markdown({
        codeLanguages: CODE_LANGUAGES,
      });
    case "typescript":
      return (await import("@codemirror/lang-javascript")).javascript({ typescript: true });
    case "javascript":
      return (await import("@codemirror/lang-javascript")).javascript();
    case "json":
      return (await import("@codemirror/lang-json")).json();
    case "python":
      return (await import("@codemirror/lang-python")).python();
    case "rust":
      return (await import("@codemirror/lang-rust")).rust();
    case "sql":
      return (await import("@codemirror/lang-sql")).sql();
    case "text":
    default:
      return [];
  }
}

/**
 * The mounted editor. The chrome around it reaches the view this way rather
 * than threading a ref through App, which is the same route the find command
 * already takes to the editor's own search panel.
 */
export function activeEditor(): EditorView | null {
  const dom = document.querySelector<HTMLElement>(".cm-editor");
  return dom ? EditorView.findFromDOM(dom) : null;
}

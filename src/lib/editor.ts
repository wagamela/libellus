import { HighlightStyle, syntaxHighlighting, indentUnit } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { Language } from "./types";

/**
 * A quiet syntax palette: neutral text carries the code, and only a handful of
 * hues separate the token classes. Nothing here competes with the accent.
 */
const libellusHighlight = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#666873", fontStyle: "italic" },
  { tag: [t.keyword, t.modifier, t.controlKeyword], color: "#c98fb4" },
  { tag: [t.string, t.special(t.string)], color: "#9db88f" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "#d8a657" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#87a9c4" },
  { tag: [t.typeName, t.className, t.namespace], color: "#d3b58d" },
  { tag: [t.propertyName, t.attributeName], color: "#a8a8b4" },
  { tag: [t.variableName, t.definition(t.variableName)], color: "#e6e6ea" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "#92929b" },
  { tag: [t.heading], color: "#e6e6ea", fontWeight: "600" },
  { tag: [t.heading1, t.heading2], color: "#d8a657", fontWeight: "600" },
  { tag: [t.link, t.url], color: "#87a9c4", textDecoration: "underline" },
  { tag: [t.emphasis], fontStyle: "italic" },
  { tag: [t.strong], fontWeight: "600" },
  { tag: [t.quote], color: "#92929b" },
  { tag: [t.monospace], color: "#d3b58d" },
  { tag: [t.invalid], color: "#d16b6b" },
]);

export const libellusTheme: Extension = [
  EditorView.theme(
    {
      "&": { color: "#e6e6ea", backgroundColor: "transparent" },
      ".cm-foldPlaceholder": {
        backgroundColor: "#2a2a34",
        border: "1px solid #35353f",
        color: "#92929b",
      },
      ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor: "#3a3a46",
        outline: "none",
      },
    },
    { dark: true },
  ),
  syntaxHighlighting(libellusHighlight),
  indentUnit.of("  "),
];

/**
 * Language support is loaded on demand: the startup bundle carries the editor
 * and nothing else, and a grammar only arrives when a document asks for it.
 */
export async function loadLanguage(language: Language): Promise<Extension> {
  switch (language) {
    case "markdown":
      return (await import("@codemirror/lang-markdown")).markdown({ codeLanguages: [] });
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

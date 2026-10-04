import {
  HighlightStyle,
  LanguageSupport,
  syntaxHighlighting,
  indentUnit,
  type StreamLanguage,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { Tag } from "@lezer/highlight";
import type { Parser } from "@lezer/common";
import type { Language } from "./types";

/**
 * The one syntax palette.
 *
 * Code is the single place in libellus that carries hue. Everywhere else —
 * chrome, tabs, menus, the status bar, markdown prose, error and delete
 * affordances — stays achromatic and takes its emphasis from brightness, and
 * these colours must not leak out there. Inside code they earn their place:
 * with every token in one hue the steps between a keyword, a name, a string
 * and a number are not perceptible as different, which is the whole job of
 * highlighting them.
 *
 * The hues are kept few and desaturated so a snippet still sits quietly on the
 * dark surface: violet for the grammar's own words, green for text the program
 * carries, amber for numbers, cyan for types, blue for the things that are
 * called. Names and scaffolding stay grey — they are the bulk of any snippet,
 * and colouring them would leave nothing for the hues to stand out from.
 *
 * There is one `HighlightStyle` built from it and everything paints with that:
 * the editor's own highlighting of the document, and the snippet highlighter in
 * `codeHighlight.ts`, which parses a recognised block itself and hands the
 * tokens to the same style. One palette and one set of classes, so the two
 * routes to a highlighted block cannot disagree and nothing depends on which
 * of two stylesheets happens to win.
 */
interface TokenStyle {
  tag: Tag[];
  color?: string;
  fontStyle?: string;
  fontWeight?: string;
  textDecoration?: string;
}

const TOKEN_STYLES: TokenStyle[] = [
  // Scaffolding: grey, so it reads as the frame the code hangs on rather than
  // as another kind of token.
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "#5d6878", fontStyle: "italic" },
  { tag: [t.punctuation, t.bracket, t.separator, t.angleBracket], color: "#78859a" },
  { tag: [t.operator, t.typeOperator, t.derefOperator, t.compareOperator, t.logicOperator, t.arithmeticOperator], color: "#95a2b5" },
  // The grammar's own words, and the things that mark up the code about them.
  { tag: [t.keyword, t.controlKeyword, t.modifier, t.operatorKeyword, t.self], color: "#b08ad6" },
  { tag: [t.definitionKeyword, t.moduleKeyword], color: "#bb97de", fontWeight: "500" },
  { tag: [t.meta, t.annotation, t.processingInstruction], color: "#9a86b8" },
  // What the program carries: text, numbers, the names of things.
  { tag: [t.string, t.special(t.string), t.character, t.attributeValue], color: "#94c48c" },
  { tag: [t.regexp], color: "#8fc4a8" },
  { tag: [t.escape, t.special(t.brace)], color: "#c9d49a" },
  { tag: [t.number, t.integer, t.float, t.bool, t.null, t.atom, t.unit, t.constant(t.variableName)], color: "#d8a86a" },
  { tag: [t.typeName, t.className, t.namespace, t.tagName], color: "#82c3d6" },
  { tag: [t.propertyName, t.attributeName, t.labelName], color: "#9fc0cc" },
  // The things that get called, and the things that get named.
  { tag: [t.standard(t.variableName), t.macroName, t.special(t.variableName)], color: "#7fb0e4" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#8cb8ef" },
  { tag: [t.definition(t.function(t.variableName)), t.definition(t.className)], color: "#a8ccfa", fontWeight: "600" },
  { tag: [t.variableName, t.definition(t.propertyName)], color: "#e4ebf4" },
  { tag: [t.definition(t.variableName)], color: "#f4f8fc", fontWeight: "500" },
  { tag: [t.invalid], color: "#d98f8f", textDecoration: "underline wavy" },
  // Prose, which is not code: the achromatic rule still holds here. A detected
  // snippet is never markdown, so these only ever come from a note's own
  // grammar, outside any block.
  { tag: [t.heading], color: "#ffffff", fontWeight: "600" },
  { tag: [t.heading1, t.heading2], color: "#ffffff", fontWeight: "700" },
  { tag: [t.link, t.url], color: "#ced9e7", textDecoration: "underline" },
  { tag: [t.emphasis], fontStyle: "italic" },
  { tag: [t.strong], fontWeight: "600" },
  { tag: [t.quote], color: "#8b97a8" },
  { tag: [t.monospace], color: "#c3cfdd" },
];

/** The palette as the editor and the snippet highlighter both use it. */
export const libellusHighlight = HighlightStyle.define(TOKEN_STYLES);

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
 * Language support is loaded on demand: the startup bundle carries the editor
 * and nothing else, and a grammar only arrives when a document asks for it.
 */
export async function loadLanguage(language: Language): Promise<Extension> {
  switch (language) {
    case "markdown":
      // No `codeLanguages`: a fence's info string is a title here, not a
      // language, so markdown must not read one out of it and nest a grammar.
      // Everything inside a block is coloured by `codeHighlight.ts`, from what
      // the code itself turned out to be.
      return (await import("@codemirror/lang-markdown")).markdown();
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
    case "cpp":
      return (await import("@codemirror/lang-cpp")).cpp();
    case "csharp":
      return new LanguageSupport(await csharpLanguage());
    case "sql":
      return (await import("@codemirror/lang-sql")).sql();
    case "text":
    default:
      return [];
  }
}

/**
 * C# has no Lezer grammar of its own in the CodeMirror packages; it comes from
 * the legacy stream mode instead, wrapped so it presents the same `Language`
 * the rest of this module deals in. A stream mode tags its tokens with the
 * same standard tags a Lezer grammar does, so the palette applies to it
 * unchanged — it simply looks at one line at a time rather than at a tree.
 */
async function csharpLanguage(): Promise<StreamLanguage<unknown>> {
  const [{ StreamLanguage }, { csharp }] = await Promise.all([
    import("@codemirror/language"),
    import("@codemirror/legacy-modes/mode/clike"),
  ]);
  return StreamLanguage.define(csharp);
}

/**
 * The bare grammar behind a language, with no editor behaviour attached.
 *
 * `loadLanguage` hands back a whole `LanguageSupport` because it configures the
 * document the user is typing in. A snippet inside a note is not that: the
 * detected language only has to be parsed so it can be coloured, and giving a
 * block's grammar its own indentation, completions and bracket rules would let
 * the code inside a note fight the note. Same dynamic imports, so a grammar
 * still only arrives when something actually needs it.
 */
export async function loadParser(language: Language): Promise<Parser | null> {
  switch (language) {
    case "typescript":
      return (await import("@codemirror/lang-javascript")).typescriptLanguage.parser;
    case "javascript":
      return (await import("@codemirror/lang-javascript")).javascriptLanguage.parser;
    case "json":
      return (await import("@codemirror/lang-json")).jsonLanguage.parser;
    case "python":
      return (await import("@codemirror/lang-python")).pythonLanguage.parser;
    case "rust":
      return (await import("@codemirror/lang-rust")).rustLanguage.parser;
    case "cpp":
      return (await import("@codemirror/lang-cpp")).cppLanguage.parser;
    case "csharp":
      return (await csharpLanguage()).parser;
    case "sql":
      return (await import("@codemirror/lang-sql")).StandardSQL.language.parser;
    default:
      return null;
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

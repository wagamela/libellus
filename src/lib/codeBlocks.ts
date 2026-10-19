import {
  Decoration,
  EditorView,
  WidgetType,
  type Command,
  type DecorationSet,
} from "@codemirror/view";
import {
  Annotation,
  EditorSelection,
  EditorState,
  StateField,
  type Extension,
  type Range,
  type Text,
} from "@codemirror/state";
import type { Language } from "./types";
import { detectCodeLanguage } from "./detect";
import { jsonFormatter } from "./formatters/json";
import { jsonMinifier } from "./formatters/minify";
import { jsonValidator } from "./formatters/validate";
import { jsonSorter } from "./formatters/sort";
import { jsonDeduplicator } from "./formatters/dedupe";
import { jsonToTypeScript } from "./formatters/to-ts";
import { jsonToYAML } from "./formatters/to-yaml";
import { jsonToCSV } from "./formatters/to-csv";
import { jsonToXML } from "./formatters/to-xml";
import { xmlFormatter } from "./formatters/xml";
import { xmlMinifier } from "./formatters/xml-minify";
import { xmlValidator } from "./formatters/xml-validate";
import { xmlToJSON } from "./formatters/xml-to-json";
import { xmlToYAML } from "./formatters/xml-to-yaml";
import { xmlToCSV } from "./formatters/xml-to-csv";
import { xmlRemoveComments } from "./formatters/xml-remove-comments";
import { xmlEscape } from "./formatters/xml-escape";
import { yamlValidator } from "./formatters/yaml-validate";
import { yamlMinifier } from "./formatters/yaml-minify";
import { yamlToJSON } from "./formatters/yaml-to-json";
import { yamlToCSV } from "./formatters/yaml-to-csv";
import { yamlToXML } from "./formatters/yaml-to-xml";
import { csvFormatter } from "./formatters/csv";
import { csvValidator } from "./formatters/csv-validate";
import { csvToJSON } from "./formatters/csv-to-json";
import { csvToYAML } from "./formatters/csv-to-yaml";
import { csvToXML } from "./formatters/csv-to-xml";
import { csvAnalyzer } from "./formatters/csv-analyzer";
import { formatCode } from "./format";

/**
 * Code snippet areas inside a document. A block is ordinary fenced text —
 * three backticks, a language, the code, three backticks — so nothing about
 * the document model changes: the body is still plain text, it still saves out
 * as markdown, and search still reads the code. The editor only draws the
 * fenced region as its own surface, dims the fences and hangs a copy control
 * off the opening line, which is what turns a run of lines into an area you
 * paste code into rather than prose you have to indent by hand.
 *
 * A fence's info string is a title for the snippet and nothing else. The
 * language is never written there and never typed: it is recognised from the
 * code by `codeHighlight.ts`, which also colours the block and says what it
 * found on the right of the header. So a block names itself, and what the user
 * writes about it stays what they wrote.
 */

/** An opening fence: three backticks and an optional info string. The info
 *  string is free text — a language, or a title for the snippet — so the only
 *  character it may not contain is another backtick. */
const OPEN = /^```([^`]*)$/;
/** A closing fence carries nothing but the backticks. */
const CLOSE = /^```[ \t]*$/;

export interface CodeBlock {
  /** Line numbers of the fences, or of the document end in an unclosed block. */
  startLine: number;
  endLine: number;
  /** The opening fence line. */
  openFrom: number;
  openTo: number;
  /** The code between the fences, which may be empty. */
  bodyFrom: number;
  bodyTo: number;
  /** The fence's info string: the snippet's title, or "" when it has none. */
  info: string;
  /** False while a fence is still being typed and has no partner yet. */
  closed: boolean;
}

/** True for a line that is nothing but a fence, so a title never comes from one. */
export function isFenceLine(line: string): boolean {
  return OPEN.test(line.trim());
}

/** An info string is written into a fence line, so it carries no backticks and
 *  no line breaks. */
export function cleanFenceInfo(info: string): string {
  return info.replace(/[`\r\n]/g, "").replace(/^\s+/, "");
}

/** Every fenced region in the document, in document order. */
export function blocksIn(doc: Text): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let open: { line: number; from: number; to: number; info: string } | null = null;
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (open) {
      if (!CLOSE.test(line.text)) continue;
      blocks.push({
        startLine: open.line,
        endLine: n,
        openFrom: open.from,
        openTo: open.to,
        // Fences on consecutive lines have no body at all, and the two ends
        // have to meet rather than cross.
        bodyFrom: Math.min(open.to + 1, line.from),
        bodyTo: Math.max(line.from - 1, Math.min(open.to + 1, line.from)),
        info: open.info,
        closed: true,
      });
      open = null;
    } else {
      const match = OPEN.exec(line.text);
      if (match) open = { line: n, from: line.from, to: line.to, info: match[1] };
    }
  }
  // A fence that has not been closed yet still reads as a block: the surface
  // appears the moment the opening line is typed, not once it is finished.
  if (open) {
    const last = doc.line(doc.lines);
    blocks.push({
      startLine: open.line,
      endLine: doc.lines,
      openFrom: open.from,
      openTo: open.to,
      bodyFrom: Math.min(open.to + 1, last.to),
      bodyTo: last.to,
      info: open.info,
      closed: false,
    });
  }
  return blocks;
}

/** The block containing `pos`, fences included, or null. */
export function blockAt(state: EditorState, pos: number): CodeBlock | null {
  for (const block of blocksIn(state.doc)) {
    const end = block.closed ? state.doc.line(block.endLine).to : block.bodyTo;
    if (pos >= block.openFrom && pos <= end) return block;
  }
  return null;
}

/** True when a block lies anywhere in `[from, to]`, fences included. */
export function blockTouches(state: EditorState, from: number, to: number): boolean {
  for (const block of blocksIn(state.doc)) {
    const end = block.closed ? state.doc.line(block.endLine).to : block.bodyTo;
    if (from <= end && to >= block.openFrom) return true;
  }
  return false;
}

/** The block the caret currently sits in. */
export function blockAtCursor(view: EditorView): CodeBlock | null {
  return blockAt(view.state, view.state.selection.main.head);
}

// --- commands --------------------------------------------------------------

/**
 * Opens a snippet area at the caret. A selection is wrapped — whole lines, so
 * the fences never cut a line in half — and an empty selection opens an empty
 * block with the caret already inside it.
 *
 * A block never nests: inside one, or across one, the command does nothing.
 * Fences inside fences are not markdown the document could round-trip, and a
 * snippet area is already the place code goes.
 */
export function insertCodeBlock(language: () => Language | null): Command {
  return (view) => {
    const { state } = view;
    const { from, to } = state.selection.main;
    if (blockTouches(state, from, to)) return false;
    const startLine = state.doc.lineAt(from);
    const endLine = state.doc.lineAt(to);
    const empty = from === to;
    const content = empty ? "" : state.doc.sliceString(startLine.from, endLine.to);
    // A block always owns its lines, so a line of prose the caret happens to
    // be in is kept above the fence rather than swallowed by it.
    const lead = empty && startLine.text.trim() !== "" ? `${startLine.text}\n` : "";
    // A block is allowed to open unnamed: in a note it usually should, because
    // whatever is pasted into it is recognised from the code itself (see
    // `codeHighlight.ts`), and a language guessed by the editor is better than
    // one stamped on the fence before there is any code to stamp it for.
    const open = "```" + (language() ?? "");
    // Spacing: blank line after block is uneditable (two newlines: one for fence, one for blank)
    const tail = "\n\n";
    const insert = `${lead}${open}\n${content}\n\`\`\`${tail}`;
    view.dispatch({
      changes: { from: startLine.from, to: endLine.to, insert },
      // Inside the block: on the empty line of a new one, at the end of
      // whatever was just wrapped.
      selection: { anchor: startLine.from + lead.length + open.length + 1 + content.length },
      scrollIntoView: true,
      userEvent: "input",
    });
    view.focus();
    return true;
  };
}

/** The one write that touches a fence: the title on its opening line, as the
 *  header's field commits it. Everything else about a fence is read-only, so
 *  this transaction says who it is and the guard below lets it through. */
function writeFenceInfo(view: EditorView, block: CodeBlock, info: string): void {
  view.dispatch({
    changes: { from: block.openFrom + 3, to: block.openTo, insert: cleanFenceInfo(info) },
    annotations: fenceEdit.of(true),
    userEvent: "input",
  });
}

/**
 * Formats a block's code in place, reporting the outcome on `button` when there
 * is one. The formatter may be loading for a moment, so the result is dropped
 * if the code changed underneath it.
 */
export async function formatBlock(
  view: EditorView,
  block: CodeBlock,
  language: Language,
  button?: HTMLElement,
): Promise<void> {
  const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
  let label = "formatted";
  try {
    const formatted = await formatCode(language, code);
    const now = blockAt(view.state, block.bodyFrom);
    if (now && view.state.doc.sliceString(now.bodyFrom, now.bodyTo) === code && formatted !== code) {
      view.dispatch({
        changes: { from: now.bodyFrom, to: now.bodyTo, insert: formatted },
        userEvent: "input",
      });
    }
  } catch {
    label = "invalid";
  }
  if (!button) return;
  button.textContent = label;
  const revert = setTimeout(() => {
    button.textContent = "format";
  }, 1100);
  button.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
}

/** The code inside the block the caret is in. */
export function codeBlockBody(view: EditorView): string | null {
  const block = blockAtCursor(view);
  if (!block) return null;
  return view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
}

// --- decorations -----------------------------------------------------------

/**
 * The opening fence, drawn as a header. The backticks and the info string are
 * replaced by one small field: the only writable part of a block outside its
 * code, and the only way the info string changes by hand. What goes in it is a
 * title for the snippet — a name, or a note on what it is for. It does not
 * decide the language; the language is recognised from the code and reported on
 * the other side of the header.
 *
 * The field is one DOM element for the life of the block. What it should show
 * is worked out where the decoration is built, because that is the one place
 * the block is actually known — inside `toDOM` the element is not in the
 * document yet, so there is no position to look a block up from. Two widgets
 * showing the same thing are equal, so a keystroke in the code never rebuilds
 * the field (which would take the focus with it); when they differ, `updateDOM`
 * syncs the element in place rather than replacing it, and leaves the value
 * alone while the field is the thing being typed into.
 */
/** What the title field offers while it is empty. */
const PLACEHOLDER = "title";

class HeaderWidget extends WidgetType {
  /** @param text  The fence's info string, which is what the field holds. */
  constructor(readonly text: string) {
    super();
  }

  eq(other: HeaderWidget): boolean {
    return other.text === this.text;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-code-head";
    // The header is chrome: the editor must not treat it as part of the text.
    wrap.contentEditable = "false";
    const field = document.createElement("input");
    field.className = "cm-code-lang";
    // Picks up the shared hover/press fade; only colours ever transition.
    field.setAttribute("data-interactive", "");
    field.spellcheck = false;
    field.autocomplete = "off";
    field.placeholder = PLACEHOLDER;
    field.setAttribute("aria-label", "code block title");
    field.value = this.text;
    const block = () => blockAt(view.state, view.posAtDOM(wrap));
    // The fence is written when the field is done, not per keystroke: the
    // replaced range is the fence text itself, so changing it while typing
    // would let the editor rebuild this element and take the focus with it.
    // One commit is also one undo step rather than one per letter.
    const commit = () => {
      const current = block();
      if (!current) return;
      const clean = cleanFenceInfo(field.value);
      if (clean !== field.value) field.value = clean;
      if (clean !== current.info) writeFenceInfo(view, current, clean);
    };
    // Backticks and line breaks would end the fence; they never get as far as
    // the document, so the field refuses them as they are typed.
    field.addEventListener("input", () => {
      const clean = cleanFenceInfo(field.value);
      if (clean === field.value) return;
      const caret = Math.max((field.selectionStart ?? clean.length) - 1, 0);
      field.value = clean;
      field.setSelectionRange(caret, caret);
    });
    field.addEventListener("blur", commit);
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        // Done naming the block: the caret belongs in the code.
        event.preventDefault();
        commit();
        const current = block();
        if (current) view.dispatch({ selection: { anchor: current.bodyFrom } });
        view.focus();
        return;
      }
      if (event.key === "Escape") {
        // Back to what the document holds, and out of the field.
        event.preventDefault();
        field.value = block()?.info ?? "";
        view.focus();
        return;
      }
      // Plain typing is the field's own; shortcuts still belong to the app, so
      // they are left to carry on up to the window.
      if (!event.ctrlKey && !event.metaKey && !event.altKey) event.stopPropagation();
    });
    // A click in the field is not a click in the document, and a click on the
    // header beside the field is not a click at all: the caret must not end up
    // next to a widget the editor never heard being clicked.
    field.addEventListener("mousedown", (event) => event.stopPropagation());
    wrap.addEventListener("mousedown", (event) => {
      if (event.target !== field) event.preventDefault();
    });
    wrap.appendChild(field);
    return wrap;
  }

  updateDOM(dom: HTMLElement): boolean {
    const field = dom.firstElementChild as HTMLInputElement | null;
    if (!field) return false;
    if (document.activeElement !== field) field.value = this.text;
    return true;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/**
 * The right end of a block's header: what the code was recognised as, and the
 * control that copies it.
 *
 * The language sits here rather than in the title field because it is not
 * something the user wrote — it is what the editor made of the code, reported
 * back. It is chrome, so it stays achromatic even though the code below it is
 * not, and it says nothing at all when nothing was recognised rather than
 * guessing out loud.
 */
class ToolsWidget extends WidgetType {
  /** @param language  The language recognised in the block, or "" for none. */
  /** @param content   The code content of the block. */
  constructor(readonly language: string, readonly content: string) {
    super();
  }

  /** Two headers reporting the same language are the same header, so typing in
   *  the code rebuilds this only when the answer actually changes — which keeps
   *  the copy control's own "copied" state from being swept away mid-flash. */
  eq(other: ToolsWidget): boolean {
    return other.language === this.language && other.content === this.content;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-code-tools";
    // Chrome must not treat any of this as part of the editable text.
    wrap.contentEditable = "false";

    const tag = document.createElement("span");
    tag.className = "cm-code-tag";
    tag.textContent = this.language;
    wrap.appendChild(tag);

    // Add separator between tag and utilities
    const separator = document.createElement("span");
    separator.className = "cm-code-separator";
    separator.textContent = "|";
    wrap.appendChild(separator);

    // JSON utilities container — show tools when language is detected as JSON.
    if (this.language === "json") {
      const utilsContainer = document.createElement("span");
      utilsContainer.className = "cm-code-utils";

      // Format button — always available
      const formatButton = document.createElement("button");
      formatButton.className = "cm-code-util";
      formatButton.textContent = "format";
      formatButton.tabIndex = -1;
      formatButton.contentEditable = "false";
      formatButton.setAttribute("aria-label", "format json");
      formatButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(formatButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const formatted = jsonFormatter.format(code);
        view.dispatch({
          changes: { from: block.bodyFrom, to: block.bodyTo, insert: formatted },
          userEvent: "input",
        });
        formatButton.textContent = "formatted";
        const revert = setTimeout(() => {
          formatButton.textContent = "format";
        }, 1100);
        formatButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(formatButton);

      // Minify button — always available
      const minifyButton = document.createElement("button");
      minifyButton.className = "cm-code-util";
      minifyButton.textContent = "minify";
      minifyButton.tabIndex = -1;
      minifyButton.contentEditable = "false";
      minifyButton.setAttribute("aria-label", "minify json");
      minifyButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(minifyButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const minified = jsonMinifier.format(code);
        view.dispatch({
          changes: { from: block.bodyFrom, to: block.bodyTo, insert: minified },
          userEvent: "input",
        });
        minifyButton.textContent = "minified";
        const revert = setTimeout(() => {
          minifyButton.textContent = "minify";
        }, 1100);
        minifyButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(minifyButton);

      // Validate button
      const validateButton = document.createElement("button");
      validateButton.className = "cm-code-util";
      validateButton.textContent = "validate";
      validateButton.tabIndex = -1;
      validateButton.contentEditable = "false";
      validateButton.setAttribute("aria-label", "validate json");
      validateButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(validateButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const error = jsonValidator.getError(code);
        const isValid = error === null;
        validateButton.textContent = isValid ? "valid" : "invalid";
        validateButton.setAttribute("data-valid", isValid ? "true" : "false");
        const revert = setTimeout(() => {
          validateButton.textContent = "validate";
          validateButton.removeAttribute("data-valid");
        }, 1100);
        validateButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(validateButton);

      // Sort keys button
      const sortButton = document.createElement("button");
      sortButton.className = "cm-code-util";
      sortButton.textContent = "sort";
      sortButton.tabIndex = -1;
      sortButton.contentEditable = "false";
      sortButton.setAttribute("aria-label", "sort json keys");
      sortButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(sortButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const sorted = jsonSorter.format(code);
        view.dispatch({
          changes: { from: block.bodyFrom, to: block.bodyTo, insert: sorted },
          userEvent: "input",
        });
        sortButton.textContent = "sorted";
        const revert = setTimeout(() => {
          sortButton.textContent = "sort";
        }, 1100);
        sortButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(sortButton);

      // Remove duplicates button
      const dedupeButton = document.createElement("button");
      dedupeButton.className = "cm-code-util";
      dedupeButton.textContent = "dedupe";
      dedupeButton.tabIndex = -1;
      dedupeButton.contentEditable = "false";
      dedupeButton.setAttribute("aria-label", "remove json duplicates");
      dedupeButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(dedupeButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const deduped = jsonDeduplicator.format(code);
        view.dispatch({
          changes: { from: block.bodyFrom, to: block.bodyTo, insert: deduped },
          userEvent: "input",
        });
        dedupeButton.textContent = "deduped";
        const revert = setTimeout(() => {
          dedupeButton.textContent = "dedupe";
        }, 1100);
        dedupeButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(dedupeButton);

      // JSON → TypeScript button
      const toTsButton = document.createElement("button");
      toTsButton.className = "cm-code-util";
      toTsButton.textContent = "→ts";
      toTsButton.tabIndex = -1;
      toTsButton.contentEditable = "false";
      toTsButton.setAttribute("aria-label", "convert json to typescript");
      toTsButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toTsButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const ts = jsonToTypeScript.convert(code);
        navigator.clipboard.writeText(ts);
        toTsButton.textContent = "copied";
        const revert = setTimeout(() => {
          toTsButton.textContent = "→ts";
        }, 1100);
        toTsButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toTsButton);

      // JSON → YAML button
      const toYamlButton = document.createElement("button");
      toYamlButton.className = "cm-code-util";
      toYamlButton.textContent = "→yaml";
      toYamlButton.tabIndex = -1;
      toYamlButton.contentEditable = "false";
      toYamlButton.setAttribute("aria-label", "convert json to yaml");
      toYamlButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toYamlButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const yaml = jsonToYAML.convert(code);
        navigator.clipboard.writeText(yaml);
        toYamlButton.textContent = "copied";
        const revert = setTimeout(() => {
          toYamlButton.textContent = "→yaml";
        }, 1100);
        toYamlButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toYamlButton);

      // JSON → XML button
      const toXmlButton = document.createElement("button");
      toXmlButton.className = "cm-code-util";
      toXmlButton.textContent = "→xml";
      toXmlButton.tabIndex = -1;
      toXmlButton.contentEditable = "false";
      toXmlButton.setAttribute("aria-label", "convert json to xml");
      toXmlButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toXmlButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const xml = jsonToXML.convert(code);
        navigator.clipboard.writeText(xml);
        toXmlButton.textContent = "copied";
        const revert = setTimeout(() => {
          toXmlButton.textContent = "→xml";
        }, 1100);
        toXmlButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toXmlButton);

      // JSON → CSV button
      const toCsvButton = document.createElement("button");
      toCsvButton.className = "cm-code-util";
      toCsvButton.textContent = "→csv";
      toCsvButton.tabIndex = -1;
      toCsvButton.contentEditable = "false";
      toCsvButton.setAttribute("aria-label", "convert json to csv");
      toCsvButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toCsvButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const csv = jsonToCSV.convert(code);
        navigator.clipboard.writeText(csv);
        toCsvButton.textContent = "copied";
        const revert = setTimeout(() => {
          toCsvButton.textContent = "→csv";
        }, 1100);
        toCsvButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toCsvButton);

      wrap.appendChild(utilsContainer);
    }

    // XML utilities container — show tools when language is detected as XML.
    if (this.language === "xml") {
      const utilsContainer = document.createElement("span");
      utilsContainer.className = "cm-code-utils";

      // Format button
      const formatButton = document.createElement("button");
      formatButton.className = "cm-code-util";
      formatButton.textContent = "format";
      formatButton.tabIndex = -1;
      formatButton.contentEditable = "false";
      formatButton.setAttribute("aria-label", "format xml");
      formatButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(formatButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const formatted = xmlFormatter.format(code);
        view.dispatch({
          changes: { from: block.bodyFrom, to: block.bodyTo, insert: formatted },
          userEvent: "input",
        });
        formatButton.textContent = "formatted";
        const revert = setTimeout(() => {
          formatButton.textContent = "format";
        }, 1100);
        formatButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(formatButton);

      // Minify button
      const minifyButton = document.createElement("button");
      minifyButton.className = "cm-code-util";
      minifyButton.textContent = "minify";
      minifyButton.tabIndex = -1;
      minifyButton.contentEditable = "false";
      minifyButton.setAttribute("aria-label", "minify xml");
      minifyButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(minifyButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const minified = xmlMinifier.format(code);
        view.dispatch({
          changes: { from: block.bodyFrom, to: block.bodyTo, insert: minified },
          userEvent: "input",
        });
        minifyButton.textContent = "minified";
        const revert = setTimeout(() => {
          minifyButton.textContent = "minify";
        }, 1100);
        minifyButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(minifyButton);

      // Validate button
      const validateButton = document.createElement("button");
      validateButton.className = "cm-code-util";
      validateButton.textContent = "validate";
      validateButton.tabIndex = -1;
      validateButton.contentEditable = "false";
      validateButton.setAttribute("aria-label", "validate xml");
      validateButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(validateButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const error = xmlValidator.getError(code);
        const isValid = error === null;
        validateButton.textContent = isValid ? "valid" : "invalid";
        validateButton.setAttribute("data-valid", isValid ? "true" : "false");
        const revert = setTimeout(() => {
          validateButton.textContent = "validate";
          validateButton.removeAttribute("data-valid");
        }, 1100);
        validateButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(validateButton);

      // XML → JSON button
      const toJsonButton = document.createElement("button");
      toJsonButton.className = "cm-code-util";
      toJsonButton.textContent = "→json";
      toJsonButton.tabIndex = -1;
      toJsonButton.contentEditable = "false";
      toJsonButton.setAttribute("aria-label", "convert xml to json");
      toJsonButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toJsonButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const json = xmlToJSON.convert(code);
        navigator.clipboard.writeText(json);
        toJsonButton.textContent = "copied";
        const revert = setTimeout(() => {
          toJsonButton.textContent = "→json";
        }, 1100);
        toJsonButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toJsonButton);

      // XML → YAML button
      const toYamlButton = document.createElement("button");
      toYamlButton.className = "cm-code-util";
      toYamlButton.textContent = "→yaml";
      toYamlButton.tabIndex = -1;
      toYamlButton.contentEditable = "false";
      toYamlButton.setAttribute("aria-label", "convert xml to yaml");
      toYamlButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toYamlButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const yaml = xmlToYAML.convert(code);
        navigator.clipboard.writeText(yaml);
        toYamlButton.textContent = "copied";
        const revert = setTimeout(() => {
          toYamlButton.textContent = "→yaml";
        }, 1100);
        toYamlButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toYamlButton);

      // XML → CSV button
      const toCsvButton = document.createElement("button");
      toCsvButton.className = "cm-code-util";
      toCsvButton.textContent = "→csv";
      toCsvButton.tabIndex = -1;
      toCsvButton.contentEditable = "false";
      toCsvButton.setAttribute("aria-label", "convert xml to csv");
      toCsvButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toCsvButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const csv = xmlToCSV.convert(code);
        navigator.clipboard.writeText(csv);
        toCsvButton.textContent = "copied";
        const revert = setTimeout(() => {
          toCsvButton.textContent = "→csv";
        }, 1100);
        toCsvButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toCsvButton);

      // Remove comments button
      const removeCommentsButton = document.createElement("button");
      removeCommentsButton.className = "cm-code-util";
      removeCommentsButton.textContent = "no-comments";
      removeCommentsButton.tabIndex = -1;
      removeCommentsButton.contentEditable = "false";
      removeCommentsButton.setAttribute("aria-label", "remove xml comments");
      removeCommentsButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(removeCommentsButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const noComments = xmlRemoveComments.format(code);
        view.dispatch({
          changes: { from: block.bodyFrom, to: block.bodyTo, insert: noComments },
          userEvent: "input",
        });
        removeCommentsButton.textContent = "removed";
        const revert = setTimeout(() => {
          removeCommentsButton.textContent = "no-comments";
        }, 1100);
        removeCommentsButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(removeCommentsButton);

      // Escape button
      const escapeButton = document.createElement("button");
      escapeButton.className = "cm-code-util";
      escapeButton.textContent = "escape";
      escapeButton.tabIndex = -1;
      escapeButton.contentEditable = "false";
      escapeButton.setAttribute("aria-label", "escape xml entities");
      escapeButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(escapeButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const escaped = xmlEscape.format(code);
        navigator.clipboard.writeText(escaped);
        escapeButton.textContent = "copied";
        const revert = setTimeout(() => {
          escapeButton.textContent = "escape";
        }, 1100);
        escapeButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(escapeButton);

      wrap.appendChild(utilsContainer);
    }

    // YAML utilities container — show tools when language is detected as YAML.
    if (this.language === "yaml") {
      const utilsContainer = document.createElement("span");
      utilsContainer.className = "cm-code-utils";

      // Format button
      const formatButton = document.createElement("button");
      formatButton.className = "cm-code-util";
      formatButton.textContent = "format";
      formatButton.tabIndex = -1;
      formatButton.contentEditable = "false";
      formatButton.setAttribute("aria-label", "format yaml");
      formatButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(formatButton));
        if (!block) return;
        void formatBlock(view, block, "yaml", formatButton);
      });
      utilsContainer.appendChild(formatButton);

      // Minify button
      const minifyButton = document.createElement("button");
      minifyButton.className = "cm-code-util";
      minifyButton.textContent = "minify";
      minifyButton.tabIndex = -1;
      minifyButton.contentEditable = "false";
      minifyButton.setAttribute("aria-label", "minify yaml");
      minifyButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(minifyButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const minified = yamlMinifier.format(code);
        view.dispatch({
          changes: { from: block.bodyFrom, to: block.bodyTo, insert: minified },
          userEvent: "input",
        });
        minifyButton.textContent = "minified";
        const revert = setTimeout(() => {
          minifyButton.textContent = "minify";
        }, 1100);
        minifyButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(minifyButton);

      // Validate button
      const validateButton = document.createElement("button");
      validateButton.className = "cm-code-util";
      validateButton.textContent = "validate";
      validateButton.tabIndex = -1;
      validateButton.contentEditable = "false";
      validateButton.setAttribute("aria-label", "validate yaml");
      validateButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(validateButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const error = yamlValidator.getError(code);
        const isValid = error === null;
        validateButton.textContent = isValid ? "valid" : "invalid";
        validateButton.setAttribute("data-valid", isValid ? "true" : "false");
        const revert = setTimeout(() => {
          validateButton.textContent = "validate";
          validateButton.removeAttribute("data-valid");
        }, 1100);
        validateButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(validateButton);

      // YAML → JSON button
      const toJsonButton = document.createElement("button");
      toJsonButton.className = "cm-code-util";
      toJsonButton.textContent = "→json";
      toJsonButton.tabIndex = -1;
      toJsonButton.contentEditable = "false";
      toJsonButton.setAttribute("aria-label", "convert yaml to json");
      toJsonButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toJsonButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const json = yamlToJSON.convert(code);
        navigator.clipboard.writeText(json);
        toJsonButton.textContent = "copied";
        const revert = setTimeout(() => {
          toJsonButton.textContent = "→json";
        }, 1100);
        toJsonButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toJsonButton);

      // YAML → CSV button
      const toCsvButton = document.createElement("button");
      toCsvButton.className = "cm-code-util";
      toCsvButton.textContent = "→csv";
      toCsvButton.tabIndex = -1;
      toCsvButton.contentEditable = "false";
      toCsvButton.setAttribute("aria-label", "convert yaml to csv");
      toCsvButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toCsvButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const csv = yamlToCSV.convert(code);
        navigator.clipboard.writeText(csv);
        toCsvButton.textContent = "copied";
        const revert = setTimeout(() => {
          toCsvButton.textContent = "→csv";
        }, 1100);
        toCsvButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toCsvButton);

      // YAML → XML button
      const toXmlButton = document.createElement("button");
      toXmlButton.className = "cm-code-util";
      toXmlButton.textContent = "→xml";
      toXmlButton.tabIndex = -1;
      toXmlButton.contentEditable = "false";
      toXmlButton.setAttribute("aria-label", "convert yaml to xml");
      toXmlButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toXmlButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const xml = yamlToXML.convert(code);
        navigator.clipboard.writeText(xml);
        toXmlButton.textContent = "copied";
        const revert = setTimeout(() => {
          toXmlButton.textContent = "→xml";
        }, 1100);
        toXmlButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toXmlButton);

      wrap.appendChild(utilsContainer);
    }

    // CSV utilities container — show tools when language is detected as CSV.
    if (this.language === "csv") {
      const utilsContainer = document.createElement("span");
      utilsContainer.className = "cm-code-utils";

      // Format button
      const formatButton = document.createElement("button");
      formatButton.className = "cm-code-util";
      formatButton.textContent = "format";
      formatButton.tabIndex = -1;
      formatButton.contentEditable = "false";
      formatButton.setAttribute("aria-label", "format csv");
      formatButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(formatButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const formatted = csvFormatter.format(code);
        view.dispatch({
          changes: { from: block.bodyFrom, to: block.bodyTo, insert: formatted },
          userEvent: "input",
        });
        formatButton.textContent = "formatted";
        const revert = setTimeout(() => {
          formatButton.textContent = "format";
        }, 1100);
        formatButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(formatButton);

      // Validate button
      const validateButton = document.createElement("button");
      validateButton.className = "cm-code-util";
      validateButton.textContent = "validate";
      validateButton.tabIndex = -1;
      validateButton.contentEditable = "false";
      validateButton.setAttribute("aria-label", "validate csv");
      validateButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(validateButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const error = csvValidator.validate(code);
        const isValid = error === null;
        validateButton.textContent = isValid ? "valid" : "invalid";
        validateButton.setAttribute("data-valid", isValid ? "true" : "false");
        const revert = setTimeout(() => {
          validateButton.textContent = "validate";
          validateButton.removeAttribute("data-valid");
        }, 1100);
        validateButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(validateButton);

      // CSV → JSON button
      const toJsonButton = document.createElement("button");
      toJsonButton.className = "cm-code-util";
      toJsonButton.textContent = "→json";
      toJsonButton.tabIndex = -1;
      toJsonButton.contentEditable = "false";
      toJsonButton.setAttribute("aria-label", "convert csv to json");
      toJsonButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toJsonButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const json = csvToJSON.convert(code);
        navigator.clipboard.writeText(json);
        toJsonButton.textContent = "copied";
        const revert = setTimeout(() => {
          toJsonButton.textContent = "→json";
        }, 1100);
        toJsonButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toJsonButton);

      // CSV → YAML button
      const toYamlButton = document.createElement("button");
      toYamlButton.className = "cm-code-util";
      toYamlButton.textContent = "→yaml";
      toYamlButton.tabIndex = -1;
      toYamlButton.contentEditable = "false";
      toYamlButton.setAttribute("aria-label", "convert csv to yaml");
      toYamlButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toYamlButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const yaml = csvToYAML.convert(code);
        navigator.clipboard.writeText(yaml);
        toYamlButton.textContent = "copied";
        const revert = setTimeout(() => {
          toYamlButton.textContent = "→yaml";
        }, 1100);
        toYamlButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toYamlButton);

      // CSV → XML button
      const toXmlButton = document.createElement("button");
      toXmlButton.className = "cm-code-util";
      toXmlButton.textContent = "→xml";
      toXmlButton.tabIndex = -1;
      toXmlButton.contentEditable = "false";
      toXmlButton.setAttribute("aria-label", "convert csv to xml");
      toXmlButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(toXmlButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const xml = csvToXML.convert(code);
        navigator.clipboard.writeText(xml);
        toXmlButton.textContent = "copied";
        const revert = setTimeout(() => {
          toXmlButton.textContent = "→xml";
        }, 1100);
        toXmlButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(toXmlButton);

      // Analyze button
      const analyzeButton = document.createElement("button");
      analyzeButton.className = "cm-code-util";
      analyzeButton.textContent = "analyze";
      analyzeButton.tabIndex = -1;
      analyzeButton.contentEditable = "false";
      analyzeButton.setAttribute("aria-label", "analyze csv structure");
      analyzeButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(analyzeButton));
        if (!block) return;
        const code = view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
        const analysis = csvAnalyzer.analyze(code);
        const report = csvAnalyzer.formatAnalysis(analysis);
        navigator.clipboard.writeText(report);
        analyzeButton.textContent = "copied";
        const revert = setTimeout(() => {
          analyzeButton.textContent = "analyze";
        }, 1100);
        analyzeButton.addEventListener("mousedown", () => clearTimeout(revert), { once: true });
      });
      utilsContainer.appendChild(analyzeButton);

      wrap.appendChild(utilsContainer);
    }

    // Every other recognised language gets just the one tool.
    if (this.language && !["json", "xml", "yaml", "csv"].includes(this.language)) {
      const language = this.language as Language;
      const utilsContainer = document.createElement("span");
      utilsContainer.className = "cm-code-utils";
      const formatButton = document.createElement("button");
      formatButton.className = "cm-code-util";
      formatButton.textContent = "format";
      formatButton.tabIndex = -1;
      formatButton.contentEditable = "false";
      formatButton.setAttribute("aria-label", `format ${language}`);
      formatButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const block = blockAt(view.state, view.posAtDOM(formatButton));
        if (block) void formatBlock(view, block, language, formatButton);
      });
      utilsContainer.appendChild(formatButton);
      wrap.appendChild(utilsContainer);
    }

    const button = document.createElement("button");
    button.className = "cm-code-copy";
    button.textContent = "copy";
    button.tabIndex = -1;
    button.contentEditable = "false";
    button.setAttribute("aria-label", "copy code block");
    let revert: ReturnType<typeof setTimeout> | undefined;
    button.addEventListener("mousedown", (event) => {
      // The caret must not jump to the fence: this is chrome, not text.
      event.preventDefault();
      const block = blockAt(view.state, view.posAtDOM(button));
      if (!block) return;
      void navigator.clipboard.writeText(
        view.state.doc.sliceString(block.bodyFrom, block.bodyTo),
      );
      button.textContent = "copied";
      clearTimeout(revert);
      revert = setTimeout(() => {
        button.textContent = "copy";
      }, 1100);
    });
    wrap.appendChild(button);

    const removeButton = document.createElement("button");
    removeButton.className = "cm-code-remove";
    removeButton.tabIndex = -1;
    removeButton.contentEditable = "false";
    removeButton.setAttribute("aria-label", "remove code block");

    // Create trash icon SVG
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.3");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    const paths = [
      { d: "M2.5 4h11" },
      { d: "M6.5 2.4h3" },
      { d: "M4.1 4l.5 9a1 1 0 0 0 1 .95h4.8a1 1 0 0 0 1-.95l.5-9" },
      { d: "M6.6 6.6v4.7M9.4 6.6v4.7" },
    ];

    for (const pathData of paths) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData.d);
      svg.appendChild(path);
    }

    removeButton.appendChild(svg);
    removeButton.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const block = blockAt(view.state, view.posAtDOM(removeButton));
      if (!block) return;
      const startLine = view.state.doc.line(block.startLine);
      const endLine = view.state.doc.line(block.endLine);
      const start = startLine.from;
      const end = block.closed ? endLine.to : endLine.to;
      // Remove entire block including surrounding newline if present
      let deleteEnd = end;
      if (deleteEnd < view.state.doc.length && view.state.doc.sliceString(deleteEnd, deleteEnd + 1) === "\n") {
        deleteEnd += 1;
      }
      view.dispatch({
        changes: { from: start, to: deleteEnd },
        userEvent: "input",
      });
    });
    wrap.appendChild(removeButton);
    return wrap;
  }

  updateDOM(dom: HTMLElement): boolean {
    const tag = dom.firstElementChild;
    if (!tag) return false;
    // If language changed, rebuild entirely (utilities may need to appear/disappear)
    const oldLanguage = tag.textContent;
    if (oldLanguage !== this.language) return false;
    tag.textContent = this.language;
    return true;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function build(state: EditorState): DecorationSet {
  // The common document has no fences at all, and this keeps a keystroke there
  // out of the line scan entirely.
  if (!state.doc.toString().includes("```")) return Decoration.none;

  const ranges: Range<Decoration>[] = [];
  for (const block of blocksIn(state.doc)) {
    for (let n = block.startLine; n <= block.endLine; n++) {
      const line = state.doc.line(n);
      let className = "cm-code-block";
      if (n === block.startLine) className += " cm-code-open";
      if (n === block.endLine && block.closed) className += " cm-code-close";
      ranges.push(Decoration.line({ class: className }).range(line.from));
    }
    const openLine = state.doc.line(block.startLine);
    // The fence text is still what the document holds; the header is what the
    // document looks like.
    ranges.push(
      Decoration.replace({ widget: new HeaderWidget(block.info) }).range(
        openLine.from,
        openLine.to,
      ),
    );
    // What the code was recognised as — the same answer `codeHighlight.ts`
    // colours the block with, so the label can never disagree with what is on
    // screen beneath it.
    const content = state.doc.sliceString(block.bodyFrom, block.bodyTo);
    const language = detectCodeLanguage(content) ?? "";
    ranges.push(
      Decoration.widget({ widget: new ToolsWidget(language, content), side: 1 }).range(openLine.to),
    );
    if (block.closed) {
      const closeLine = state.doc.line(block.endLine);
      ranges.push(
        Decoration.mark({ class: "cm-code-fence" }).range(closeLine.from, closeLine.to),
      );
    }
  }
  return Decoration.set(ranges, true);
}

// Line decorations have to come from a state field: a view plugin may not
// restyle content outside the viewport.
const codeBlockField = StateField.define<DecorationSet>({
  create: build,
  update: (value, tr) => (tr.docChanged ? build(tr.state) : value),
  provide: (field) => EditorView.decorations.from(field),
});



// --- the fences are not text ----------------------------------------------

/**
 * A block's opening and closing lines are chrome, not content. They are drawn
 * from text the user could have typed, but they behave like the frame around
 * the code: typing on them, deleting them, joining a body line into them or
 * dropping text onto them all do nothing. Only the body between them is
 * editable, and only the header's own field rewrites a fence — it says so with
 * an annotation.
 *
 * Replacing a block whole is still allowed: a change that covers all of it,
 * such as select-all-and-delete, removes the block rather than editing a
 * fence, which is what the user means in that case.
 */
const fenceEdit = Annotation.define<boolean>();

/** `[from, to)` of each block, and of the fence lines that cannot be touched.
 *  A fence range takes in the newline that joins it to the body, so the
 *  backspace that would pull the first body line up into the opening fence is
 *  a change inside the range rather than one that merely abuts it. */
function fenceGuards(doc: Text): { outer: [number, number]; fences: [number, number][] }[] {
  return blocksIn(doc).map((block) => {
    const open = doc.line(block.startLine);
    const fences: [number, number][] = [[open.from, Math.min(open.to + 1, doc.length)]];
    let end = block.bodyTo;
    if (block.closed) {
      const close = doc.line(block.endLine);
      fences.push([Math.max(close.from - 1, 0), close.to]);
      // Protect the blank line after closing fence: it's from close.to to close.to+2
      // (one newline to end the fence line, one newline for the blank line)
      fences.push([close.to, Math.min(close.to + 2, doc.length)]);
      end = close.to + 2;
    }
    return { outer: [block.openFrom, end], fences };
  });
}

/** The nearest position outside `line` in the direction the caret is going. */
function pastLine(doc: Text, lineNumber: number, forward: boolean): number {
  const line = doc.line(lineNumber);
  return forward ? Math.min(line.to + 1, doc.length) : Math.max(line.from - 1, 0);
}

/** True when `pos` sits on either fence line of a block. */
function onFenceLine(state: EditorState, pos: number): boolean {
  for (const block of blocksIn(state.doc)) {
    const open = state.doc.line(block.startLine);
    if (pos >= open.from && pos <= open.to) return true;
    if (block.closed) {
      const close = state.doc.line(block.endLine);
      if (pos >= close.from && pos <= close.to) return true;
    }
  }
  return false;
}

/** True when the browser has put the caret on a fence line on its own. It can:
 *  a click on a widget that is not editable leaves the selection beside it,
 *  and no transaction is dispatched for the editor to filter. */
function domCaretOnFence(view: EditorView): boolean {
  const selection = view.dom.ownerDocument.getSelection();
  const node = selection?.focusNode ?? null;
  if (!node) return false;
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return !!element?.closest(".cm-code-open, .cm-code-close");
}

/** The header's own field and copy control; events there are theirs. */
function inFenceChrome(event: Event): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return !!target.closest(".cm-code-head, .cm-code-tools");
}

/**
 * The fences are not text, so the pointer and the keyboard never reach them.
 * Cancelling the transaction is not enough on its own: text typed into a
 * contenteditable is in the DOM before the editor hears about it, so a change
 * the guard below rejects would stay on screen with the document disagreeing —
 * which is what takes a block apart. Nothing is allowed that far.
 */
const fenceEvents = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (inFenceChrome(event)) return false;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null || !onFenceLine(view.state, pos)) return false;
    // No caret, no selection, no focus: the line does not answer the pointer
    // anywhere but on its field and its copy control.
    event.preventDefault();
    return true;
  },
  beforeinput(event, view) {
    if (inFenceChrome(event)) return false;
    const { from, to } = view.state.selection.main;
    if (!onFenceLine(view.state, from) && !onFenceLine(view.state, to) && !domCaretOnFence(view)) {
      return false;
    }
    event.preventDefault();
    return true;
  },
  drop(event, view) {
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null || !onFenceLine(view.state, pos)) return false;
    event.preventDefault();
    return true;
  },
});

const fenceGuard = EditorState.transactionFilter.of((tr) => {
  if (tr.annotation(fenceEdit)) return tr;

  if (tr.docChanged) {
    const guards = fenceGuards(tr.startState.doc);
    let blocked = false;
    tr.changes.iterChangedRanges((fromA, toA) => {
      if (blocked) return;
      for (const { outer, fences } of guards) {
        // A change that swallows the whole block is removing it, not editing
        // its frame.
        if (fromA <= outer[0] && toA >= outer[1]) continue;
        for (const [from, to] of fences) {
          if (fromA < to && toA > from) blocked = true;
        }
      }
    });
    if (blocked) return [];
  }

  // The caret may cross a fence line but never rest on one: it is pushed out
  // the side it arrived from, so walking down out of a block lands below it
  // and walking up into one lands at the end of the code.
  const head = tr.newSelection.main.head;
  if (!tr.newSelection.main.empty) return tr;
  const doc = tr.newDoc;
  for (const block of blocksIn(doc)) {
    const open = doc.line(block.startLine);
    const close = block.closed ? doc.line(block.endLine) : null;
    const on =
      head >= open.from && head <= open.to
        ? block.startLine
        : close && head >= close.from && head <= close.to
          ? block.endLine
          : null;
    if (on === null) continue;
    const forward = head >= tr.changes.mapPos(tr.startState.selection.main.head);
    // `sequential` because this position was worked out in `tr.newDoc`. Without
    // it the appended spec is read against the document the transaction started
    // from and mapped forward, so any edit that grows the document past that
    // length — pasting a block into an empty note, say — asks for a position
    // the old document never had and the whole edit throws.
    return [
      tr,
      { selection: EditorSelection.cursor(pastLine(doc, on, forward)), sequential: true },
    ];
  }
  return tr;
});

/** Decorations and the read-only fences; the Ctrl Alt C binding lives in
 *  App.tsx with every other shortcut, so a second keymap here would insert the
 *  block twice. */
export const libellusCodeBlocks: Extension = [codeBlockField, fenceEvents, fenceGuard];

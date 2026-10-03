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
import { LANGUAGES, type Language } from "./types";

/**
 * Code snippet areas inside a document. A block is ordinary fenced text —
 * three backticks, a language, the code, three backticks — so nothing about
 * the document model changes: the body is still plain text, it still saves out
 * as markdown, and search still reads the code. The editor only draws the
 * fenced region as its own surface, dims the fences and hangs a copy control
 * off the opening line, which is what turns a run of lines into an area you
 * paste code into rather than prose you have to indent by hand.
 *
 * Highlighting inside the fence comes from the markdown grammar's nested
 * languages (see `loadLanguage` in `editor.ts`), so a block carries its own
 * language without the document changing its own.
 */

/** An opening fence: three backticks and an optional language. */
const OPEN = /^```([A-Za-z0-9+#._-]*)[ \t]*$/;
/** A closing fence carries nothing but the backticks. */
const CLOSE = /^```[ \t]*$/;

/** The fence languages people actually type, mapped onto ours. */
const ALIASES: Record<string, Language> = {
  ts: "typescript",
  tsx: "typescript",
  typescript: "typescript",
  js: "javascript",
  jsx: "javascript",
  javascript: "javascript",
  json: "json",
  jsonc: "json",
  py: "python",
  python: "python",
  rs: "rust",
  rust: "rust",
  sql: "sql",
  md: "markdown",
  markdown: "markdown",
  txt: "text",
  text: "text",
  plain: "text",
};

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
  /** The fence's language as written; "" when it carries none. */
  info: string;
  language: Language | null;
  /** False while a fence is still being typed and has no partner yet. */
  closed: boolean;
}

/** True for a line that is nothing but a fence, so a title never comes from one. */
export function isFenceLine(line: string): boolean {
  return OPEN.test(line.trim());
}

export function fenceLanguage(info: string): Language | null {
  return ALIASES[info.toLowerCase()] ?? null;
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
        language: fenceLanguage(open.info),
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
      language: fenceLanguage(open.info),
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
export function insertCodeBlock(language: () => Language): Command {
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
    const open = "```" + language();
    // Without this there is no line below a block at the end of the document,
    // and so no way to type past it.
    const tail = endLine.to >= state.doc.length ? "\n" : "";
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

/** Rewrites the language on the fence of the block the caret is in. */
export function setCodeBlockLanguage(view: EditorView, language: Language): boolean {
  const block = blockAtCursor(view);
  if (!block) return false;
  view.dispatch({
    changes: { from: block.openFrom + 3, to: block.openTo, insert: language },
    // The fences are read-only to the user; this is the one way the language
    // on one changes, so the guard below has to let it through.
    annotations: fenceEdit.of(true),
    userEvent: "input",
  });
  return true;
}

/** The code inside the block the caret is in. */
export function codeBlockBody(view: EditorView): string | null {
  const block = blockAtCursor(view);
  if (!block) return null;
  return view.state.doc.sliceString(block.bodyFrom, block.bodyTo);
}

// --- decorations -----------------------------------------------------------

/** The copy control that hangs off the right of an opening fence. */
class CopyWidget extends WidgetType {
  /** Every copy control is the same control: the block it belongs to is found
   *  from the DOM when it is clicked, so typing in a block never rebuilds it. */
  eq(): boolean {
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const button = document.createElement("button");
    button.className = "cm-code-copy";
    button.textContent = "copy";
    button.tabIndex = -1;
    // Chrome must not treat the control as part of the editable text.
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
    return button;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const copyWidget = new CopyWidget();

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
    ranges.push(Decoration.mark({ class: "cm-code-fence" }).range(openLine.from, openLine.to));
    ranges.push(Decoration.widget({ widget: copyWidget, side: 1 }).range(openLine.to));
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

/** The language a new block opens with when the document has no better one. */
export const DEFAULT_BLOCK_LANGUAGE: Language = "typescript";

/** Languages a block can be set to; markdown would only nest into itself. */
export const BLOCK_LANGUAGES: Language[] = LANGUAGES.filter((l) => l !== "markdown");


// --- the fences are not text ----------------------------------------------

/**
 * A block's opening and closing lines are chrome, not content. They are drawn
 * from text the user could have typed, but they behave like the frame around
 * the code: typing on them, deleting them, joining a body line into them or
 * dropping text onto them all do nothing. Only the body between them is
 * editable, and only `setCodeBlockLanguage` rewrites a fence — it says so with
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
      end = close.to;
    }
    return { outer: [block.openFrom, end], fences };
  });
}

/** The nearest position outside `line` in the direction the caret is going. */
function pastLine(doc: Text, lineNumber: number, forward: boolean): number {
  const line = doc.line(lineNumber);
  return forward ? Math.min(line.to + 1, doc.length) : Math.max(line.from - 1, 0);
}

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
    return [tr, { selection: EditorSelection.cursor(pastLine(doc, on, forward)) }];
  }
  return tr;
});

/** Decorations and the read-only fences; the Ctrl Alt C binding lives in
 *  App.tsx with every other shortcut, so a second keymap here would insert the
 *  block twice. */
export const libellusCodeBlocks: Extension = [codeBlockField, fenceGuard];

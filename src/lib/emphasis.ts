import {
  Decoration,
  EditorView,
  ViewPlugin,
  type Command,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import {
  EditorSelection,
  EditorState,
  RangeSetBuilder,
  StateField,
  type Extension,
  type Range,
} from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { blockTouches, blocksIn } from "./codeBlocks";

/**
 * Bold, italic and underlined prose. Like images and snippet areas, this adds
 * nothing to the document model: emphasis is the markdown the user could have
 * typed by hand — `**bold**`, `*italic*`, `<u>underlined</u>` — so the body
 * still saves out as markdown, still searches as written, and no store
 * migration is involved.
 *
 * Markdown has no underline of its own, which is why that one is the HTML tag:
 * it is the portable way to say it in a markdown file.
 *
 * The markers are in the text but not on the screen. The editor undraws them —
 * and brings them back the moment the selection touches the span, so there is
 * never hidden text the caret can walk into blind. That is the same bargain an
 * image reference makes: the document is still exactly what the user could have
 * typed, and the editor is only choosing what to draw of it. See "drawing it"
 * below.
 *
 * Every command here toggles: it wraps what is selected, and unwraps again
 * when the caret or selection is already inside a span of that kind.
 */

export type Emphasis = "bold" | "italic" | "underline";

const MARKERS: Record<Emphasis, { open: string; close: string }> = {
  bold: { open: "**", close: "**" },
  italic: { open: "*", close: "*" },
  underline: { open: "<u>", close: "</u>" },
};

/** A pair of markers and the text between them, in line-relative offsets. */
interface Span {
  openFrom: number;
  openTo: number;
  closeFrom: number;
  closeTo: number;
}

/**
 * The spans of one kind on a line, paired in the order they open.
 *
 * Asterisks are read as runs rather than as single characters: a run of one is
 * italic, a run of two or more is bold. That is what keeps the two apart — the
 * inner asterisks of `**bold**` are never mistaken for a pair of italic
 * markers, and pairing left to right means the caret between two separate
 * spans (`**a** | **b**`) is not read as sitting inside one.
 *
 * `***both***` is the acknowledged limit: it is seen as bold, not as bold and
 * italic at once, so toggling italic off there does not find a span to undo.
 */
function spansIn(text: string, kind: Emphasis): Span[] {
  const spans: Span[] = [];
  if (kind === "underline") {
    const tags = /<u>|<\/u>/g;
    let open: number | null = null;
    for (let m = tags.exec(text); m; m = tags.exec(text)) {
      if (m[0] === "<u>") open = m.index;
      else if (open !== null) {
        spans.push({
          openFrom: open,
          openTo: open + 3,
          closeFrom: m.index,
          closeTo: m.index + 4,
        });
        open = null;
      }
    }
    return spans;
  }

  const length = kind === "bold" ? 2 : 1;
  let open = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "*") continue;
    let run = 1;
    while (text[i + run] === "*") run++;
    const marker = kind === "bold" ? run >= 2 : run === 1;
    if (marker) {
      if (open < 0) open = i;
      else {
        spans.push({
          openFrom: open,
          openTo: open + length,
          closeFrom: i,
          closeTo: i + length,
        });
        open = -1;
      }
    }
    i += run - 1;
  }
  return spans;
}

/** The span `[from, to]` sits inside, or the one it covers markers and all. */
function spanAround(text: string, kind: Emphasis, from: number, to: number): Span | null {
  for (const span of spansIn(text, kind)) {
    const inside = from >= span.openTo && to <= span.closeFrom;
    const covers = from <= span.openFrom && to >= span.closeTo;
    if (inside || covers) return span;
  }
  return null;
}

/**
 * Toggles one kind of emphasis over every selection range.
 *
 * It declines inside a snippet area: there the same characters are code, and
 * marking up code with prose markers would be writing into the snippet.
 */
export function toggleEmphasis(kind: Emphasis): Command {
  return (view) => {
    const { state } = view;
    for (const range of state.selection.ranges) {
      if (blockTouches(state, range.from, range.to)) return false;
    }
    const { open, close } = MARKERS[kind];

    const spec = state.changeByRange((range) => {
      const line = state.doc.lineAt(range.from);
      // Unwrapping looks at one line only: a span is paired within the line it
      // opens on, so emphasis carried across a line break is wrapped again
      // rather than half-undone.
      const span =
        range.to <= line.to
          ? spanAround(line.text, kind, range.from - line.from, range.to - line.from)
          : null;

      if (span) {
        const openFrom = line.from + span.openFrom;
        const openTo = line.from + span.openTo;
        const closeFrom = line.from + span.closeFrom;
        const closeTo = line.from + span.closeTo;
        const width = openTo - openFrom;
        // A caret keeps its place in the text. A selection comes back over the
        // span's content, which is what the command just changed — there is no
        // way to unemphasise part of a span without splitting it in two.
        const anchor = range.empty ? range.from - width : openFrom;
        const head = range.empty ? anchor : closeFrom - width;
        return {
          changes: [
            { from: openFrom, to: openTo },
            { from: closeFrom, to: closeTo },
          ],
          range: EditorSelection.range(anchor, head),
        };
      }

      // Wrapping takes the selection without the whitespace at its edges:
      // `** text **` is not emphasis in markdown and `**text**` is, so a word
      // selected with the space after it still comes out emphasised.
      let from = range.from;
      let to = range.to;
      while (from < to && /\s/.test(state.doc.sliceString(from, from + 1))) from++;
      while (to > from && /\s/.test(state.doc.sliceString(to - 1, to))) to--;

      if (from === to) {
        // Nothing to emphasise yet: open an empty pair and leave the caret
        // between the markers, ready to be typed into.
        return {
          changes: { from: range.from, insert: open + close },
          range: EditorSelection.cursor(range.from + open.length),
        };
      }
      return {
        changes: [
          { from, insert: open },
          { from: to, insert: close },
        ],
        range: EditorSelection.range(from + open.length, to + open.length),
      };
    });

    view.dispatch({ ...spec, scrollIntoView: true, userEvent: "input" });
    view.focus();
    return true;
  };
}

// --- drawing it ------------------------------------------------------------

/**
 * The markers are not shown. `**bold**` reads as bold, `*italic*` as italic and
 * `<u>underlined</u>` as underlined, with the characters that say so hidden —
 * until the selection touches the span, when they come back dimmed so the
 * markup can be edited, moved or deleted like any other text.
 *
 * Nothing is rewritten to do this: the markers are still in the body, still
 * saved, still searched, still what a "save as" writes out. They are only
 * undrawn, the way an image reference is undrawn in favour of its picture.
 *
 * Revealing on contact is what keeps the document honest. Hidden text the caret
 * could land inside with no way to see it would be a trap, so the rule is
 * simply: if any selection range touches the span at all, its markers show.
 */

/** True when a selection range touches `[from, to]`, its edges included. */
function touched(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

/** A marker that is standing back. Replacing it draws nothing at all. */
const HIDDEN = Decoration.replace({});
/** The same marker while the caret is in its span: visible, and the quietest
 *  thing on the line — the treatment a code fence gets. */
const SHOWN = Decoration.mark({ class: "cm-emphasis-mark" });
const UNDERLINED = Decoration.mark({ class: "cm-underline" });

const UNDERLINE = /<u>([\s\S]*?)<\/u>/g;

/**
 * Underline: the tags, and the line under what they hold.
 *
 * This one is a state field over the whole document rather than a view plugin
 * over what is on screen, because it has nothing to do with the syntax tree —
 * it is a regex over the text — and because a `<u>…</u>` may span lines, where
 * a span that opens above the viewport would otherwise lose its underline.
 */
function buildUnderline(state: EditorState): DecorationSet {
  const text = state.doc.toString();
  // The common document has no underline at all, and this keeps a keystroke
  // there away from the regex engine.
  if (!text.includes("<u>")) return Decoration.none;

  // A tag inside a snippet area is code the block claims to contain, so it is
  // left alone. The blocks are gathered once rather than per match.
  const blocks = blocksIn(state.doc).map<[number, number]>((block) => [
    block.openFrom,
    block.closed ? state.doc.line(block.endLine).to : block.bodyTo,
  ]);

  const builder = new RangeSetBuilder<Decoration>();
  for (const match of text.matchAll(UNDERLINE)) {
    const from = match.index;
    const to = from + match[0].length;
    if (blocks.some(([start, end]) => from <= end && to >= start)) continue;
    const contentFrom = from + 3;
    const contentTo = to - 4;
    const tag = touched(state, from, to) ? SHOWN : HIDDEN;
    builder.add(from, contentFrom, tag);
    // `<u></u>` has nothing between its tags, and a mark decoration may not be
    // empty.
    if (contentTo > contentFrom) builder.add(contentFrom, contentTo, UNDERLINED);
    builder.add(contentTo, to, tag);
  }
  return builder.finish();
}

const underlineField = StateField.define<DecorationSet>({
  create: buildUnderline,
  // The selection decides whether a tag is drawn, so it rebuilds for a plain
  // caret move as well as for an edit.
  update: (value, tr) =>
    tr.docChanged || tr.selection ? buildUnderline(tr.state) : value,
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * Bold and italic: the asterisks, hidden.
 *
 * Which asterisks are markup is the markdown parser's question, not ours, so
 * this asks the tree rather than the text. That is what keeps `2 * 3 * 4` and a
 * `* bullet` list intact, leaves anything inside a code fence or a code span
 * alone — emphasis is not parsed there at all — and still covers `_italic_`
 * typed by hand, which the commands never write but markdown means all the
 * same. `spansIn` above answers a different question — where a marker the
 * command itself has to remove is — and the two are deliberately separate.
 *
 * A view plugin, because the tree is what it reads: a tree arrives
 * asynchronously, and a grammar that loads after the document (`loadLanguage`)
 * changes nothing about the text or the selection, so a state field keyed on
 * those would not notice either.
 */
function emphasisMarks(view: EditorView): DecorationSet {
  const visible = view.visibleRanges;
  if (visible.length === 0) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  // One sweep from the first rendered range to the last, rather than one per
  // range. The list is split wherever content is hidden — an image standing in
  // for its reference, say — and a span either side of such a gap would be
  // entered once per range and decorated twice.
  syntaxTree(view.state).iterate({
    from: visible[0].from,
    to: visible[visible.length - 1].to,
    enter: (node) => {
      if (node.name !== "Emphasis" && node.name !== "StrongEmphasis") return;
      const deco = touched(view.state, node.from, node.to) ? SHOWN : HIDDEN;
      // The delimiters are the span's own children; everything between them is
      // already styled by the grammar and is left as it is.
      for (let child = node.node.firstChild; child; child = child.nextSibling) {
        if (child.name === "EmphasisMark") ranges.push(deco.range(child.from, child.to));
      }
    },
  });
  // Spans nest — italic inside bold — so the markers do not come out in
  // document order. `Decoration.set` sorts them.
  return Decoration.set(ranges, true);
}

const emphasisPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = emphasisMarks(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = emphasisMarks(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/**
 * Emphasis as the editor draws it. Notes only: this is prose markup, and in a
 * snippet an asterisk is an operator.
 */
export const libellusEmphasis: Extension = [underlineField, emphasisPlugin];

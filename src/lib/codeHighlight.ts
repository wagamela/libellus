import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { Annotation, Prec, type Extension, type Range } from "@codemirror/state";
import { highlightTree } from "@lezer/highlight";
import type { Parser, Tree } from "@lezer/common";
import { blocksIn } from "./codeBlocks";
import { detectCodeLanguage } from "./detect";
import { libellusHighlight, loadParser } from "./editor";
import type { Language } from "./types";

/**
 * Syntax colours inside a snippet area.
 *
 * A block never says what it holds — its fence carries a title, if anything —
 * so the language is read out of the code itself by `detect.ts`, the matching
 * grammar is parsed on its own, and the tokens are painted from the editor's
 * palette. Keywords, strings, numbers, types, the things that are called and
 * the names being defined each take their own colour, which is the whole point:
 * a block you can read the shape of at a glance instead of a wall of one
 * colour. The header reports the same answer on its right, so the label and the
 * colours can never disagree.
 *
 * The document is untouched. Nothing is written into the fence, no field is
 * added to `Doc`, and a block whose language cannot be guessed confidently
 * simply stays plain rather than being coloured as a guess.
 */

// --- grammars --------------------------------------------------------------

/** Grammars that have arrived, and the loads still in flight. A parser is
 *  module-wide rather than per view: it is immutable, and a document reopened
 *  in a new tab should not fetch it again. */
const parsers = new Map<Language, Parser | null>();
const loading = new Set<Language>();
/** Views that asked for a grammar before it was there, and so owe themselves a
 *  rebuild once it is. */
const waiting = new Set<EditorView>();

/** Says that a transaction exists only to re-run the highlighter: no document
 *  change, no selection change, nothing for anything else to react to. */
const grammarArrived = Annotation.define<boolean>();

/** Bumped whenever a grammar is stored. A view that drew a block plain
 *  because the grammar had not arrived remembers the count it drew at, so any
 *  later update at all repairs the block — the notification below is how it
 *  usually happens, and this is what makes it happen even if that is missed. */
let generation = 0;

let scheduled = false;

/**
 * Tells the views that were waiting that a grammar has arrived, so they draw
 * the block they had to leave plain.
 *
 * On a task of its own, never straight out of the promise. A grammar can
 * settle in the middle of an editor update — the load is started from inside a
 * decoration build — and dispatching into a view that is already updating
 * throws, which would lose the one notification the block was waiting for and
 * leave it plain until the next keystroke. Here a view that cannot be told yet
 * simply keeps its place in the queue and is told on the next pass.
 */
function announceGrammar(): void {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    // Taken and emptied before any of them is told, because each dispatch
    // rebuilds that view there and then — and a view still waiting on a second
    // grammar puts itself straight back in. Clearing afterwards would throw
    // those away, and the view would never hear about the later grammars.
    const pending = [...waiting];
    waiting.clear();
    let missed = false;
    for (const view of pending) {
      try {
        view.dispatch({ annotations: grammarArrived.of(true) });
      } catch {
        waiting.add(view);
        missed = true;
      }
    }
    if (missed) announceGrammar();
  }, 0);
}

function parserFor(lang: Language, view: EditorView): Parser | null {
  const known = parsers.get(lang);
  if (known !== undefined) return known;
  if (!loading.has(lang)) {
    loading.add(lang);
    void loadParser(lang)
      .then((parser) => {
        parsers.set(lang, parser);
        generation++;
      })
      .catch((error: unknown) => {
        // A grammar that cannot be fetched leaves every block in that language
        // plain for the rest of the session, which looks from the outside like
        // highlighting that simply does not work. Say so rather than failing
        // quietly — this is the one place that failure is visible at all.
        parsers.set(lang, null);
        generation++;
        console.error(`libellus: the ${lang} grammar could not be loaded`, error);
      })
      .finally(() => {
        loading.delete(lang);
        announceGrammar();
      });
  }
  // Plain text until the grammar lands, then a rebuild.
  waiting.add(view);
  return null;
}

// --- parsing ---------------------------------------------------------------

/**
 * Parsed snippet bodies. A block is reparsed as it is typed in, and every
 * other block in the document would otherwise be reparsed with it, so the last
 * few trees are kept against their exact text. The table is dropped whole when
 * it fills: keys are a block's body mid-edit and are never asked for twice.
 */
const trees = new Map<string, Tree>();
const TREE_LIMIT = 24;

/** Past this a snippet is a file someone pasted, not a snippet, and parsing it
 *  on every keystroke is not worth the colour. */
const MAX_BODY = 20_000;

function treeFor(parser: Parser, lang: Language, code: string): Tree {
  const key = `${lang}\u0000${code}`;
  const hit = trees.get(key);
  if (hit) return hit;
  const tree = parser.parse(code);
  if (trees.size >= TREE_LIMIT) trees.clear();
  trees.set(key, tree);
  return tree;
}

// --- decorations -----------------------------------------------------------

function build(view: EditorView): DecorationSet {
  const { state } = view;
  // The common document has no fences at all, and this keeps a keystroke there
  // out of the work entirely.
  if (!state.doc.toString().includes("```")) return Decoration.none;

  const ranges: Range<Decoration>[] = [];
  for (const block of blocksIn(state.doc)) {
    if (block.bodyTo <= block.bodyFrom) continue;
    // Only what is on screen: a mark decoration may not reach outside the
    // rendered range, and a long note of snippets should not be parsed whole
    // to draw the one block the user is looking at.
    if (block.bodyTo < view.viewport.from || block.bodyFrom > view.viewport.to) continue;
    const code = state.doc.sliceString(block.bodyFrom, block.bodyTo);
    if (code.length > MAX_BODY) continue;
    const lang = detectCodeLanguage(code);
    if (!lang) continue;
    const parser = parserFor(lang, view);
    if (!parser) continue;
    // Tokens are emitted for the visible slice only — a decoration a plugin
    // provides has to stay inside the rendered range — while the tree is still
    // parsed from the whole body, so scrolling into the middle of a long block
    // does not change how the code is read.
    highlightTree(
      treeFor(parser, lang, code),
      libellusHighlight,
      (from, to, classes) => {
        ranges.push(
          Decoration.mark({ class: classes }).range(block.bodyFrom + from, block.bodyFrom + to),
        );
      },
      Math.max(0, view.viewport.from - block.bodyFrom),
      Math.min(code.length, view.viewport.to - block.bodyFrom),
    );
  }
  return Decoration.set(ranges, true);
}

const snippetHighlighting = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    /** The grammar count this view's decorations were drawn against. */
    private builtAt = generation;

    constructor(private view: EditorView) {
      this.decorations = build(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        this.builtAt !== generation ||
        update.transactions.some((tr) => tr.annotation(grammarArrived))
      ) {
        this.builtAt = generation;
        this.decorations = build(update.view);
      }
    }

    destroy() {
      // A closed tab must not be dispatched into when a grammar lands.
      waiting.delete(this.view);
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

/**
 * Detected-language colouring for snippet areas. Separate from
 * `libellusCodeBlocks` so the two can be reasoned about on their own: that one
 * draws the block, this one reads what is inside it. The colours come with
 * `libellusTheme`, which mounts the one highlight style these tokens are
 * classed from — there is no stylesheet of its own to go missing.
 *
 * The precedence is not decoration. Markdown styles the text inside a fence as
 * monospace, so every token here ends up with two spans around it: this one,
 * and markdown's. Only the inner span's colour is painted — an outer colour is
 * merely inherited, and inheritance loses to any rule of the element's own, so
 * no amount of CSS weight on the outer span can win. Nesting is the whole
 * question, and it follows precedence: highest goes innermost. At any lower
 * precedence these spans wrap markdown's instead of sitting inside them, and
 * every block comes out the one flat grey that monospace paints.
 */
export const libellusCodeHighlight: Extension = Prec.highest(snippetHighlighting);

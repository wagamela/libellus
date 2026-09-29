import { StateField, type EditorState, type Extension } from "@codemirror/state";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { IMAGE_REF, getImage, imagesFrom, peekImage, putImage } from "./images";

/**
 * Images in the editor. A pasted image is written to the image store and the
 * document gets a plain-text reference — `![image](libellus:name.png)` — which
 * stays editable, selectable and deletable like any other line. The picture
 * itself is a block widget drawn under that line, so nothing about the
 * document model changes: delete the line and the image goes with it.
 */

class ImageWidget extends WidgetType {
  constructor(readonly name: string) {
    super();
  }

  /** Same file, same widget: the DOM node survives edits without flicker. */
  eq(other: ImageWidget): boolean {
    return other.name === this.name;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-image";

    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    // The widget's height is only known once the bitmap is in: tell the
    // editor to re-measure rather than leaving the viewport guessing.
    img.addEventListener("load", () => view.requestMeasure());

    const cached = peekImage(this.name);
    if (cached) {
      img.src = cached;
    } else {
      void getImage(this.name).then((url) => {
        if (url) img.src = url;
        else wrap.classList.add("cm-image-missing");
      });
    }

    wrap.appendChild(img);
    return wrap;
  }

  /** Clicks and selections inside the picture behave like the rest of the doc. */
  ignoreEvent(): boolean {
    return false;
  }
}

function build(state: EditorState): DecorationSet {
  const text = state.doc.toString();
  // The overwhelmingly common case is a document with no images at all, and
  // this keeps a keystroke there from touching the regex engine.
  if (!text.includes("libellus:")) return Decoration.none;

  const builder = new RangeSetBuilder<Decoration>();
  for (const match of text.matchAll(IMAGE_REF)) {
    const line = state.doc.lineAt(match.index);
    builder.add(
      line.to,
      line.to,
      Decoration.widget({ widget: new ImageWidget(match[1]), block: true, side: 1 }),
    );
  }
  return builder.finish();
}

// Block widgets have to come from a state field — a view plugin may not change
// the vertical layout of content outside the viewport.
const imageField = StateField.define<DecorationSet>({
  create: build,
  update: (value, tr) => (tr.docChanged ? build(tr.state) : value),
  provide: (field) => EditorView.decorations.from(field),
});

/** Stores the files and writes one reference line per image at the cursor. */
function insertImages(view: EditorView, files: File[]): boolean {
  if (files.length === 0) return false;
  void (async () => {
    for (const file of files) {
      const name = await putImage(new Uint8Array(await file.arrayBuffer()), file.type);
      // The selection is read again per image: earlier insertions moved it.
      const { from, to } = view.state.selection.main;
      const line = view.state.doc.lineAt(from);
      const lead = line.text.slice(0, from - line.from).trim() === "" ? "" : "\n";
      const insert = `${lead}![image](libellus:${name})\n`;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length },
        scrollIntoView: true,
      });
    }
  })();
  return true;
}

export const libellusImages: Extension = [
  imageField,
  EditorView.domEventHandlers({
    paste(event, view) {
      return insertImages(view, imagesFrom(event.clipboardData));
    },
    drop(event, view) {
      const files = imagesFrom(event.dataTransfer);
      if (files.length === 0) return false;
      // Dropping moves the cursor to the drop point first, so the reference
      // lands where the pointer is rather than where the caret was.
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos !== null) view.dispatch({ selection: { anchor: pos } });
      return insertImages(view, files);
    },
  }),
];

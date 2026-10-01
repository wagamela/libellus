import { useEffect, useRef } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
  highlightSpecialChars,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, autocompletion } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { loadLanguage, libellusTheme } from "../lib/editor";
import { libellusImages } from "../lib/imageView";
import { DEFAULT_BLOCK_LANGUAGE, libellusCodeBlocks } from "../lib/codeBlocks";
import type { Doc } from "../lib/types";

interface EditorProps {
  doc: Doc;
  onChange: (body: string) => void;
  onSave: () => void;
  /** False while the tab is being named, so the editor does not pull the
   *  caret out of the rename field as a new document mounts. */
  autoFocus?: boolean;
}

const languageConf = new Compartment();
const gutterConf = new Compartment();

/** Notes read like prose; snippets read like code. */
function gutterFor(doc: Doc) {
  return doc.kind === "snippet"
    ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()]
    : [];
}

export function Editor({ doc, onChange, onSave, autoFocus = true }: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>();
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const autoFocusRef = useRef(autoFocus);
  const docRef = useRef(doc);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  autoFocusRef.current = autoFocus;
  // Read through a ref: the language a new code block opens with follows the
  // document without the editor state being rebuilt when it changes.
  docRef.current = doc;

  useEffect(() => {
    if (!host.current) return;
    const instance = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: "" }),
    });
    view.current = instance;
    return () => {
      instance.destroy();
      view.current = undefined;
    };
  }, []);

  // A new document gets a fresh state, so undo history never crosses documents.
  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    instance.setState(
      EditorState.create({
        doc: doc.body,
        extensions: [
          gutterConf.of(gutterFor(doc)),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          rectangularSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          EditorView.lineWrapping,
          libellusImages,
          // A note writes prose and opens code areas inside it; a snippet is
          // already code, so its own language is what a block starts as.
          libellusCodeBlocks(() =>
            docRef.current.language === "markdown"
              ? DEFAULT_BLOCK_LANGUAGE
              : docRef.current.language,
          ),
          keymap.of([
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                onSaveRef.current();
                return true;
              },
            },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            indentWithTab,
          ]),
          languageConf.of([]),
          libellusTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    );
    if (autoFocusRef.current) instance.focus();
    // Only the document identity should rebuild the state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  useEffect(() => {
    let cancelled = false;
    void loadLanguage(doc.language).then((support) => {
      if (cancelled) return;
      view.current?.dispatch({
        effects: [
          languageConf.reconfigure(support),
          gutterConf.reconfigure(gutterFor(doc)),
        ],
      });
    });
    return () => {
      cancelled = true;
    };
    // `doc.id` re-runs the load after a state swap resets the compartment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.language, doc.kind]);

  return <div ref={host} className={`editor-host h-full overflow-hidden doc-${doc.kind}`} />;
}

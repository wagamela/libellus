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
import type { Doc } from "../lib/types";

interface EditorProps {
  doc: Doc;
  onChange: (body: string) => void;
  onSave: () => void;
}

const languageConf = new Compartment();
const gutterConf = new Compartment();

/** Notes read like prose; snippets read like code. */
function gutterFor(doc: Doc) {
  return doc.kind === "snippet"
    ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()]
    : [];
}

export function Editor({ doc, onChange, onSave }: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>();
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

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
    instance.focus();
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

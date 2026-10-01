import { useCallback, useEffect, useMemo, useState } from "react";
import { MenuBar, type Menu } from "./components/MenuBar";
import { TabBar } from "./components/TabBar";
import { Editor } from "./components/Editor";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette, type PaletteItem } from "./components/CommandPalette";
import { searchDocs } from "./lib/search";
import { activeEditor } from "./lib/editor";
import {
  BLOCK_LANGUAGES,
  DEFAULT_BLOCK_LANGUAGE,
  blockAtCursor,
  codeBlockBody,
  insertCodeBlock,
  setCodeBlockLanguage,
} from "./lib/codeBlocks";
import { LANGUAGES } from "./lib/types";
import { docLabel, useWorkspace } from "./store/workspace";

type PaletteMode = "commands" | "open" | null;

export default function App() {
  const store = useWorkspace();
  const [palette, setPalette] = useState<PaletteMode>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  useEffect(() => {
    void store.init();
    // Startup runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeDoc = store.activeTab ? store.docs[store.activeTab] ?? null : null;
  const armed = confirmDelete !== null && confirmDelete === store.activeTab;
  const tabs = store.openTabs.map((id) => store.docs[id]).filter(Boolean);

  const focusEditor = useCallback(() => {
    document.querySelector<HTMLElement>(".cm-content")?.focus();
  }, []);
  // A new document is named before it is written: its tab opens straight into
  // the rename field, so nothing has to sit under a placeholder title.
  const newNote = useCallback(() => setRenaming(store.createDoc("note")), [store]);
  const newSnippet = useCallback(() => setRenaming(store.createDoc("snippet")), [store]);
  const renameActive = useCallback(() => {
    if (store.activeTab) setRenaming(store.activeTab);
  }, [store]);
  const endRename = useCallback(
    (id: string, title: string | null) => {
      if (title !== null) store.rename(id, title);
      setRenaming(null);
      focusEditor();
    },
    [store, focusEditor],
  );
  const save = useCallback(() => void store.flush(), [store]);
  const saveAs = useCallback(() => {
    if (store.activeTab) void store.saveAs(store.activeTab);
  }, [store]);
  const closeActive = useCallback(() => {
    if (store.activeTab) store.closeTab(store.activeTab);
  }, [store]);
  const reopenTab = useCallback(() => store.reopenTab(), [store]);
  // Keyboard counterpart to dragging a tab: walks the active tab along the
  // strip one place at a time.
  const moveActiveTab = useCallback(
    (delta: number) => {
      const id = store.activeTab;
      if (!id) return;
      store.moveTab(id, store.openTabs.indexOf(id) + delta);
    },
    [store],
  );
  const deleteActive = useCallback(() => {
    const id = store.activeTab;
    if (!id) return;
    // Deleting is irreversible, so it always takes two deliberate steps.
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setConfirmDelete(null);
    store.deleteDoc(id);
  }, [store, confirmDelete]);
  // Code blocks live in the document text, so every one of these runs against
  // the mounted editor rather than the store.
  const insertCode = useCallback(() => {
    const view = activeEditor();
    if (!view) return;
    const language =
      activeDoc && activeDoc.language !== "markdown" ? activeDoc.language : DEFAULT_BLOCK_LANGUAGE;
    insertCodeBlock(() => language)(view);
  }, [activeDoc]);
  const copyCode = useCallback(() => {
    const view = activeEditor();
    const code = view ? codeBlockBody(view) : null;
    if (code !== null) void navigator.clipboard.writeText(code);
  }, []);
  const findInDoc = useCallback(() => {
    // CodeMirror owns in-document search; hand it the keystroke it expects.
    const content = document.querySelector<HTMLElement>(".cm-content");
    content?.focus();
    content?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true }),
    );
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // F2 is the desktop convention for rename and carries no modifier.
      if (event.key === "F2") {
        event.preventDefault();
        renameActive();
        return;
      }
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setPalette((p) => (p === "commands" ? null : "commands"));
      } else if (key === "p") {
        event.preventDefault();
        setPalette((p) => (p === "open" ? null : "open"));
      } else if (key === "n") {
        event.preventDefault();
        if (event.shiftKey) newSnippet();
        else newNote();
      } else if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) saveAs();
        else save();
      } else if (key === "w") {
        event.preventDefault();
        closeActive();
      } else if (key === "c" && event.altKey) {
        // Ctrl Alt C rather than Ctrl Shift C: the browser claims that one for
        // its inspector, and `npm run dev` runs in a browser.
        event.preventDefault();
        insertCode();
      } else if (key === "t" && event.shiftKey) {
        event.preventDefault();
        reopenTab();
      } else if (key === "tab") {
        event.preventDefault();
        store.cycleTab(event.shiftKey ? -1 : 1);
      } else if (event.shiftKey && (key === "pageup" || key === "pagedown")) {
        // Shift distinguishes moving the tab from merely walking to it.
        event.preventDefault();
        moveActiveTab(key === "pageup" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newNote, newSnippet, save, saveAs, closeActive, reopenTab, renameActive, moveActiveTab, insertCode, store]);

  // Persist on the way out so an autosave in flight is never lost.
  useEffect(() => {
    const onLeave = () => void store.flush();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [store]);

  const commands = useMemo(
    () => [
      { id: "note", label: "new note", hint: "Ctrl N", run: newNote },
      { id: "snippet", label: "new snippet", hint: "Ctrl Shift N", run: newSnippet },
      { id: "open", label: "quick open document", hint: "Ctrl P", run: () => setPalette("open") },
      { id: "save", label: "save", hint: "Ctrl S", run: save },
      { id: "save-as", label: "save as…", hint: "Ctrl Shift S", run: saveAs },
      { id: "code", label: "insert code block", hint: "Ctrl Alt C", run: insertCode },
      { id: "find", label: "find in document", hint: "Ctrl F", run: findInDoc },
      { id: "rename", label: "rename tab", hint: "F2", run: renameActive },
      { id: "close", label: "close tab", hint: "Ctrl W", run: closeActive },
      {
        id: "reopen",
        label: "reopen closed tab",
        hint: store.closedTabs.length > 0 ? "Ctrl Shift T" : "nothing to reopen",
        run: reopenTab,
      },
      {
        id: "delete",
        label: armed ? "delete document — press again to confirm" : "delete document",
        hint: activeDoc ? "" : "no document",
        run: deleteActive,
      },
      { id: "next", label: "next tab", hint: "Ctrl Tab", run: () => store.cycleTab(1) },
      { id: "prev", label: "previous tab", hint: "Ctrl Shift Tab", run: () => store.cycleTab(-1) },
      {
        id: "move-left",
        label: "move tab left",
        hint: "Ctrl Shift PageUp",
        run: () => moveActiveTab(-1),
      },
      {
        id: "move-right",
        label: "move tab right",
        hint: "Ctrl Shift PageDown",
        run: () => moveActiveTab(1),
      },
    ],
    [newNote, newSnippet, save, saveAs, findInDoc, insertCode, closeActive, reopenTab, renameActive, deleteActive, moveActiveTab, armed, activeDoc, store],
  );

  const buildCommands = useCallback(
    (query: string): PaletteItem[] => {
      const q = query.trim().toLowerCase();
      const matched = commands.filter((command) => command.label.includes(q));
      // Inside a code block the palette grows the actions that only make sense
      // there: the caret keeps its place while the palette is open, so the
      // block under it is still the one these run against.
      const view = activeEditor();
      const block = view ? blockAtCursor(view) : null;
      if (block && view) {
        for (const item of [
          { id: "copy-code", label: "copy code block", hint: block.info || "no language", run: copyCode },
          ...BLOCK_LANGUAGES.map((language) => ({
            id: `block-lang-${language}`,
            label: `set code block language: ${language}`,
            hint: block.language === language ? "current" : "",
            run: () => setCodeBlockLanguage(view, language),
          })),
        ]) {
          if (item.label.includes(q)) matched.push(item);
        }
      }
      // The language selector lived in the removed header; it is a command now.
      const active = store.activeTab ? store.docs[store.activeTab] : undefined;
      if (active?.kind === "snippet") {
        for (const language of LANGUAGES) {
          const label = `set language: ${language}`;
          if (label.includes(q)) {
            matched.push({
              id: `lang-${language}`,
              label,
              hint: active.language === language ? "current" : "",
              run: () => store.setLanguage(active.id, language),
            });
          }
        }
      }
      if (!q) return matched;
      const docs = searchDocs(Object.values(store.docs), query)
        .slice(0, 8)
        .map<PaletteItem>(({ doc, excerpt }) => ({
          id: doc.id,
          label: docLabel(doc),
          detail: excerpt,
          hint: doc.kind,
          run: () => store.openDoc(doc.id),
        }));
      return [...matched, ...docs];
    },
    [commands, copyCode, store],
  );

  const buildOpen = useCallback(
    (query: string): PaletteItem[] =>
      searchDocs(Object.values(store.docs), query)
        .sort((a, b) => b.score - a.score || b.doc.updatedAt - a.doc.updatedAt)
        .slice(0, 40)
        .map(({ doc, excerpt }) => ({
          id: doc.id,
          label: docLabel(doc),
          detail: excerpt,
          hint: doc.kind === "note" ? "note" : doc.language,
          run: () => store.openDoc(doc.id),
          // Quick open is the only list of every document, so it is also where
          // one can be thrown away. The palette asks before it goes through.
          remove: () => store.deleteDoc(doc.id),
        })),
    [store],
  );

  const menus: Menu[] = [
    {
      label: "File",
      items: [
        { label: "New Note", shortcut: "Ctrl N", action: newNote },
        { label: "New Snippet", shortcut: "Ctrl Shift N", action: newSnippet },
        {
          label: "Quick Open",
          shortcut: "Ctrl P",
          action: () => setPalette("open"),
          separatorBefore: true,
        },
        { label: "Save", shortcut: "Ctrl S", action: save, disabled: !activeDoc },
        {
          label: "Save As…",
          shortcut: "Ctrl Shift S",
          action: saveAs,
          disabled: !activeDoc,
        },
        {
          label: "Rename Tab",
          shortcut: "F2",
          action: renameActive,
          disabled: !activeDoc,
          separatorBefore: true,
        },
        {
          label: "Close Tab",
          shortcut: "Ctrl W",
          action: closeActive,
          disabled: !activeDoc,
        },
        {
          label: "Reopen Closed Tab",
          shortcut: "Ctrl Shift T",
          action: reopenTab,
          disabled: store.closedTabs.length === 0,
        },
        {
          label: armed ? "Delete Document — Confirm" : "Delete Document",
          separatorBefore: true,
          action: deleteActive,
          disabled: !activeDoc,
        },
      ],
    },
    {
      label: "Edit",
      items: [
        {
          label: "Insert Code Block",
          shortcut: "Ctrl Alt C",
          action: insertCode,
          disabled: !activeDoc,
        },
        {
          label: "Copy Code Block",
          action: copyCode,
          disabled: !activeDoc,
        },
        {
          label: "Find in Document",
          shortcut: "Ctrl F",
          action: findInDoc,
          disabled: !activeDoc,
          separatorBefore: true,
        },
        {
          label: "Copy Document",
          action: () => {
            if (activeDoc) void navigator.clipboard.writeText(activeDoc.body);
          },
          disabled: !activeDoc,
        },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Command Palette", shortcut: "Ctrl K", action: () => setPalette("commands") },
        {
          label: "Next Tab",
          shortcut: "Ctrl Tab",
          action: () => store.cycleTab(1),
          disabled: tabs.length < 2,
        },
        {
          label: "Previous Tab",
          shortcut: "Ctrl Shift Tab",
          action: () => store.cycleTab(-1),
          disabled: tabs.length < 2,
        },
        {
          label: "Move Tab Left",
          shortcut: "Ctrl Shift PageUp",
          action: () => moveActiveTab(-1),
          disabled: tabs.length < 2,
          separatorBefore: true,
        },
        {
          label: "Move Tab Right",
          shortcut: "Ctrl Shift PageDown",
          action: () => moveActiveTab(1),
          disabled: tabs.length < 2,
        },
      ],
    },
  ];

  return (
    <div className="flex h-full flex-col bg-workspace">
      <MenuBar menus={menus} />
      {tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activeId={store.activeTab}
          dirty={store.dirty}
          renamingId={renaming}
          onSelect={store.activate}
          onClose={store.closeTab}
          onNew={newNote}
          onRenameStart={setRenaming}
          onRenameEnd={endRename}
          onMove={store.moveTab}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        {activeDoc ? (
          // The editor fills the window: the tab is the only place a document
          // is named, and its actions live in the menus and the palette.
          <div className="min-h-0 flex-1">
            <Editor
              key={activeDoc.id}
              doc={activeDoc}
              onChange={(body) => store.updateBody(activeDoc.id, body)}
              onSave={save}
              autoFocus={renaming === null}
            />
          </div>
        ) : (
          // Only reachable by closing the last tab: startup always opens a
          // document. A quiet hint, not a landing page.
          <div className="flex h-full items-center justify-center text-[11px] text-muted">
            {store.ready && "Ctrl N new note · Ctrl P open"}
          </div>
        )}
      </div>
      <StatusBar
        doc={activeDoc}
        status={store.status}
        docCount={Object.keys(store.docs).length}
      />
      {palette && (
        <CommandPalette
          placeholder={palette === "commands" ? "run a command…" : "open a note or snippet…"}
          build={palette === "commands" ? buildCommands : buildOpen}
          onClose={() => setPalette(null)}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { MenuBar, type Menu } from "./components/MenuBar";
import { TabBar } from "./components/TabBar";
import { Editor } from "./components/Editor";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette, type PaletteItem } from "./components/CommandPalette";
import { ContextMenu, type ContextMenuState, type MenuAction } from "./components/ContextMenu";
import { searchDocs } from "./lib/search";
import { activeEditor } from "./lib/editor";
import { blockAtCursor, codeBlockBody, insertCodeBlock } from "./lib/codeBlocks";
import { toggleEmphasis, type Emphasis } from "./lib/emphasis";
import { LANGUAGES } from "./lib/types";
import { docLabel, useWorkspace } from "./store/workspace";

type PaletteMode = "commands" | "open" | null;

export default function App() {
  const store = useWorkspace();
  const [palette, setPalette] = useState<PaletteMode>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  /** The menu at the pointer, if one is open. There is one in the app: what a
   *  right-click means is decided here, from what it landed on. */
  const [context, setContext] = useState<ContextMenuState | null>(null);

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
  const closeOthers = useCallback(
    (keep: string) => {
      for (const id of [...store.openTabs]) if (id !== keep) store.closeTab(id);
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
    // A block opens untitled: its fence carries a title if the user writes one,
    // and the language is recognised from the code rather than declared.
    insertCodeBlock(() => null)(view);
  }, []);
  // Emphasis is markdown in the body, so it runs against the editor too. It
  // is prose markup: a snippet is code all the way through, and `**` there
  // would be code rather than emphasis, so only a note takes it.
  const emphasise = useCallback(
    (kind: Emphasis) => {
      const view = activeEditor();
      if (!view || activeDoc?.kind !== "note") return;
      toggleEmphasis(kind)(view);
    },
    [activeDoc],
  );
  const prose = activeDoc?.kind === "note";
  const copyCode = useCallback(() => {
    const view = activeEditor();
    const code = view ? codeBlockBody(view) : null;
    if (code !== null) void navigator.clipboard.writeText(code);
  }, []);
  // Cut, copy, paste and select-all are the webview's own menu items, and the
  // webview's menu is not shown any more — so they are run against the editor
  // state here rather than through `execCommand`, which Chromium declines for
  // paste anyway. Each leaves the caret in the editor: a menu took focus to be
  // clicked, and an edit the user cannot carry on typing after is half an edit.
  const copySelection = useCallback(() => {
    const view = activeEditor();
    if (!view) return;
    const { from, to } = view.state.selection.main;
    if (from === to) return;
    void navigator.clipboard.writeText(view.state.sliceDoc(from, to));
    focusEditor();
  }, [focusEditor]);
  const cutSelection = useCallback(() => {
    const view = activeEditor();
    if (!view) return;
    const { from, to } = view.state.selection.main;
    if (from === to) return;
    void navigator.clipboard.writeText(view.state.sliceDoc(from, to));
    view.dispatch({
      changes: { from, to, insert: "" },
      selection: { anchor: from },
      scrollIntoView: true,
      userEvent: "delete.cut",
    });
    focusEditor();
  }, [focusEditor]);
  const pasteIntoDoc = useCallback(() => {
    const view = activeEditor();
    if (!view) return;
    // Text only: an image in the clipboard arrives as a file, which the paste
    // keystroke the editor already handles is what stores it.
    void navigator.clipboard.readText().then((text) => {
      if (!text) return;
      view.dispatch(view.state.replaceSelection(text), { userEvent: "input.paste" });
      focusEditor();
    });
  }, [focusEditor]);
  const selectAllInDoc = useCallback(() => {
    const view = activeEditor();
    if (!view) return;
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    focusEditor();
  }, [focusEditor]);
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
      } else if ((key === "b" || key === "i" || key === "u") && !event.shiftKey && !event.altKey) {
        // Plain Ctrl, never with Shift: Ctrl Shift I is the browser's inspector
        // and `npm run dev` runs in a browser. Prevented either way, so the
        // content-editable the editor is built on never applies its own bold.
        event.preventDefault();
        emphasise(key === "b" ? "bold" : key === "i" ? "italic" : "underline");
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
  }, [newNote, newSnippet, save, saveAs, closeActive, reopenTab, renameActive, moveActiveTab, insertCode, emphasise, store]);

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
      // Emphasis reads as one group in the list, in the order the keys sit on
      // the keyboard. Each says what it writes: the body is markdown, and the
      // markers stay in it.
      { id: "bold", label: "bold", hint: prose ? "Ctrl B" : "notes only", run: () => emphasise("bold") },
      { id: "italic", label: "italic", hint: prose ? "Ctrl I" : "notes only", run: () => emphasise("italic") },
      {
        id: "underline",
        label: "underline",
        hint: prose ? "Ctrl U" : "notes only",
        run: () => emphasise("underline"),
      },
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
    [newNote, newSnippet, save, saveAs, findInDoc, insertCode, emphasise, prose, closeActive, reopenTab, renameActive, deleteActive, moveActiveTab, armed, activeDoc, store],
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
        // The language is not among these: it is recognised from the code and
        // reported in the block's own header, never set by hand.
        for (const item of [
          { id: "copy-code", label: "copy code block", hint: block.info || "untitled", run: copyCode },
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
        { label: "Bold", shortcut: "Ctrl B", action: () => emphasise("bold"), disabled: !prose },
        { label: "Italic", shortcut: "Ctrl I", action: () => emphasise("italic"), disabled: !prose },
        {
          label: "Underline",
          shortcut: "Ctrl U",
          action: () => emphasise("underline"),
          disabled: !prose,
        },
        {
          label: "Insert Code Block",
          separatorBefore: true,
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

  // What a right-click means, decided from what it landed on. The items come
  // from the same callbacks the menu bar and the palette are built from, so a
  // command never has one behaviour in a menu and another at the pointer; a
  // context menu is only ever a short, local selection of them.
  const contextFor = useCallback(
    (event: React.MouseEvent): ContextMenuState | null => {
      const target = event.target as HTMLElement;
      // A text field keeps the platform's own menu. It is the one place where
      // the OS knows things this app does not — spelling, input methods, the
      // clipboard it will not hand a web page unprompted.
      if (target.closest("input, textarea")) return null;
      const at = { x: event.clientX, y: event.clientY };

      const tab = target.closest<HTMLElement>("[data-tab-id]");
      if (tab) {
        const id = tab.dataset.tabId!;
        // Right-clicking a tab selects it first: the menu that opens is about
        // the document it names, so that document should be the one in view.
        store.activate(id);
        const items: MenuAction[] = [
          { label: "rename", shortcut: "F2", action: () => setRenaming(id) },
          { label: "close tab", shortcut: "Ctrl W", action: () => store.closeTab(id) },
          {
            label: "close other tabs",
            action: () => closeOthers(id),
            disabled: store.openTabs.length < 2,
          },
          {
            label: "reopen closed tab",
            shortcut: "Ctrl Shift T",
            action: reopenTab,
            disabled: store.closedTabs.length === 0,
          },
          // Deleting is irreversible, so the row arms on the first press and
          // goes through on the second.
          {
            label: "delete document",
            action: () => store.deleteDoc(id),
            confirm: true,
            separatorBefore: true,
          },
        ];
        return { ...at, items };
      }

      if (target.closest(".editor-host")) {
        const view = activeEditor();
        // A right-click outside the selection puts the caret where it landed,
        // the way a left-click would: the menu then acts on what the user is
        // pointing at rather than on wherever the caret happened to be. A
        // right-click inside a selection leaves that selection alone.
        if (view) {
          const pos = view.posAtCoords(at);
          const { from, to } = view.state.selection.main;
          if (pos !== null && (pos < from || pos > to)) {
            view.dispatch({ selection: { anchor: pos } });
          }
        }
        const selected = view ? !view.state.selection.main.empty : false;
        const block = view ? blockAtCursor(view) : null;
        const items: MenuAction[] = [
          { label: "cut", shortcut: "Ctrl X", action: cutSelection, disabled: !selected },
          { label: "copy", shortcut: "Ctrl C", action: copySelection, disabled: !selected },
          { label: "paste", shortcut: "Ctrl V", action: pasteIntoDoc },
          {
            label: "select all",
            shortcut: "Ctrl A",
            action: selectAllInDoc,
            separatorBefore: true,
          },
          {
            label: "bold",
            shortcut: "Ctrl B",
            action: () => emphasise("bold"),
            disabled: !prose,
            separatorBefore: true,
          },
          { label: "italic", shortcut: "Ctrl I", action: () => emphasise("italic"), disabled: !prose },
          {
            label: "underline",
            shortcut: "Ctrl U",
            action: () => emphasise("underline"),
            disabled: !prose,
          },
          {
            label: "insert code block",
            shortcut: "Ctrl Alt C",
            action: insertCode,
            separatorBefore: true,
          },
        ];
        // Only inside a block, where there is something to copy: a menu at the
        // pointer says what can be done here, not what exists.
        if (block) items.push({ label: "copy code block", action: copyCode });
        items.push(
          { label: "find in document", shortcut: "Ctrl F", action: findInDoc, separatorBefore: true },
          { label: "save", shortcut: "Ctrl S", action: save },
        );
        return { ...at, items };
      }

      if (target.closest("[data-context='tabstrip']")) {
        return {
          ...at,
          items: [
            { label: "new note", shortcut: "Ctrl N", action: newNote },
            { label: "new snippet", shortcut: "Ctrl Shift N", action: newSnippet },
            {
              label: "reopen closed tab",
              shortcut: "Ctrl Shift T",
              action: reopenTab,
              disabled: store.closedTabs.length === 0,
              separatorBefore: true,
            },
          ],
        };
      }

      // Anywhere else in the chrome. Nothing local to offer, so it offers the
      // way in: a new document, or the two ways of finding an old one.
      return {
        ...at,
        items: [
          { label: "new note", shortcut: "Ctrl N", action: newNote },
          { label: "new snippet", shortcut: "Ctrl Shift N", action: newSnippet },
          {
            label: "quick open",
            shortcut: "Ctrl P",
            action: () => setPalette("open"),
            separatorBefore: true,
          },
          { label: "command palette", shortcut: "Ctrl K", action: () => setPalette("commands") },
        ],
      };
    },
    [store, closeOthers, reopenTab, cutSelection, copySelection, pasteIntoDoc, selectAllInDoc, emphasise, prose, insertCode, copyCode, findInDoc, save, newNote, newSnippet],
  );

  return (
    <div
      className="flex h-full flex-col bg-workspace"
      // The webview's own menu never appears: this is a desktop tool, and a
      // right-click in it is answered by the app. Text fields are the one
      // exception, and `contextFor` returns nothing for them.
      onContextMenu={(event) => {
        // A right-click on an open menu is not a request for another one: the
        // menu stays where it is rather than reopening under the pointer.
        if ((event.target as HTMLElement).closest('[role="menu"]')) {
          event.preventDefault();
          return;
        }
        const next = contextFor(event);
        if (!next) return;
        event.preventDefault();
        setContext(next);
      }}
    >
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
      {context && <ContextMenu state={context} onClose={() => setContext(null)} />}
    </div>
  );
}

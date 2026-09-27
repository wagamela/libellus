import { useCallback, useEffect, useMemo, useState } from "react";
import { MenuBar, type Menu } from "./components/MenuBar";
import { TabBar } from "./components/TabBar";
import { DocHeader } from "./components/DocHeader";
import { Editor } from "./components/Editor";
import { Welcome } from "./components/Welcome";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette, type PaletteItem } from "./components/CommandPalette";
import { searchDocs } from "./lib/search";
import { docLabel, useWorkspace } from "./store/workspace";

type PaletteMode = "commands" | "open" | null;

export default function App() {
  const store = useWorkspace();
  const [palette, setPalette] = useState<PaletteMode>(null);

  useEffect(() => {
    void store.init();
    // Startup runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeDoc = store.activeTab ? store.docs[store.activeTab] ?? null : null;
  const tabs = store.openTabs.map((id) => store.docs[id]).filter(Boolean);
  const recent = useMemo(
    () => store.order.map((id) => store.docs[id]).filter(Boolean).slice(0, 8),
    [store.order, store.docs],
  );

  const newNote = useCallback(() => store.createDoc("note"), [store]);
  const newSnippet = useCallback(() => store.createDoc("snippet"), [store]);
  const save = useCallback(() => void store.flush(), [store]);
  const closeActive = useCallback(() => {
    if (store.activeTab) store.closeTab(store.activeTab);
  }, [store]);
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
        save();
      } else if (key === "w") {
        event.preventDefault();
        closeActive();
      } else if (key === "tab") {
        event.preventDefault();
        store.cycleTab(event.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newNote, newSnippet, save, closeActive, store]);

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
      { id: "find", label: "find in document", hint: "Ctrl F", run: findInDoc },
      { id: "close", label: "close tab", hint: "Ctrl W", run: closeActive },
      { id: "next", label: "next tab", hint: "Ctrl Tab", run: () => store.cycleTab(1) },
      { id: "prev", label: "previous tab", hint: "Ctrl Shift Tab", run: () => store.cycleTab(-1) },
    ],
    [newNote, newSnippet, save, findInDoc, closeActive, store],
  );

  const buildCommands = useCallback(
    (query: string): PaletteItem[] => {
      const q = query.trim().toLowerCase();
      const matched = commands.filter((command) => command.label.includes(q));
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
    [commands, store],
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
          label: "Close Tab",
          shortcut: "Ctrl W",
          action: closeActive,
          disabled: !activeDoc,
          separatorBefore: true,
        },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Find in Document", shortcut: "Ctrl F", action: findInDoc, disabled: !activeDoc },
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
          onSelect={store.activate}
          onClose={store.closeTab}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        {activeDoc ? (
          <>
            <DocHeader
              doc={activeDoc}
              onRename={(title) => store.rename(activeDoc.id, title)}
              onLanguage={(language) => store.setLanguage(activeDoc.id, language)}
              onDelete={() => store.deleteDoc(activeDoc.id)}
            />
            <div className="min-h-0 flex-1">
              <Editor
                key={activeDoc.id}
                doc={activeDoc}
                onChange={(body) => store.updateBody(activeDoc.id, body)}
                onSave={save}
              />
            </div>
          </>
        ) : (
          <Welcome
            recent={recent}
            onOpen={store.openDoc}
            onNewNote={newNote}
            onNewSnippet={newSnippet}
          />
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

import { useEffect, useRef, useState } from "react";
import type { Doc } from "../lib/types";
import { docLabel } from "../store/workspace";

interface TabBarProps {
  tabs: Doc[];
  activeId: string | null;
  dirty: Set<string>;
  /** The tab currently being named, if any. Owned by App so that creating a
   *  document can open its tab straight into a rename. */
  renamingId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onRenameStart: (id: string) => void;
  onRenameEnd: (id: string, title: string | null) => void;
}

/** The tab label while it is being edited. Enter or blur commits, Escape
 *  abandons; an empty name lets the body title the tab again. */
function TabRename({ doc, onEnd }: { doc: Doc; onEnd: (title: string | null) => void }) {
  // A document still titled by its body starts blank, so a new note can simply
  // be typed into; one already named by hand starts with that name selected.
  const [value, setValue] = useState(doc.autoTitle ? "" : doc.title);
  const input = useRef<HTMLInputElement>(null);
  const settled = useRef(false);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const end = (title: string | null) => {
    if (settled.current) return;
    settled.current = true;
    onEnd(title);
  };

  return (
    <input
      ref={input}
      value={value}
      spellCheck={false}
      placeholder={doc.kind === "note" ? "name this note" : "name this snippet"}
      aria-label="tab name"
      onChange={(event) => setValue(event.target.value)}
      onMouseDown={(event) => event.stopPropagation()}
      onBlur={() => end(value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") end(value);
        else if (event.key === "Escape") end(null);
      }}
      className="min-w-0 flex-1 bg-raised px-1 text-[12px] text-text outline-none placeholder:text-muted"
    />
  );
}

export function TabBar({
  tabs,
  activeId,
  dirty,
  renamingId,
  onSelect,
  onClose,
  onNew,
  onRenameStart,
  onRenameEnd,
}: TabBarProps) {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const dismiss = () => setMenu(null);
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setMenu(null);
    window.addEventListener("mousedown", dismiss);
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", dismiss);
    };
  }, [menu]);

  const items = menu
    ? [
        { label: "rename", run: () => onRenameStart(menu.id) },
        { label: "close tab", run: () => onClose(menu.id) },
      ]
    : [];

  return (
    <div className="flex h-9 shrink-0 items-stretch gap-px overflow-x-auto bg-tabbar">
      {tabs.map((doc) => {
        const active = doc.id === activeId;
        const renaming = doc.id === renamingId;
        return (
          <div
            key={doc.id}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                onClose(doc.id);
              } else if (event.button === 0) {
                onSelect(doc.id);
              }
            }}
            onDoubleClick={() => onRenameStart(doc.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              onSelect(doc.id);
              setMenu({ id: doc.id, x: event.clientX, y: event.clientY });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSelect(doc.id);
              else if (event.key === "F2") onRenameStart(doc.id);
            }}
            // The selected tab is the darker of the pair; the 1px gap between
            // tabs is the strip showing through.
            className={`group relative flex max-w-60 min-w-28 items-center gap-2 px-3 text-[12px] ${
              active
                ? "bg-tab-active text-text"
                : "bg-tab text-dim hover:bg-tab-hover hover:text-text active:bg-pressed"
            }`}
          >
            <span className="text-[10px] text-muted">
              {doc.kind === "note" ? "md" : doc.language.slice(0, 2)}
            </span>
            {renaming ? (
              <TabRename doc={doc} onEnd={(title) => onRenameEnd(doc.id, title)} />
            ) : (
              <span className="truncate">{docLabel(doc)}</span>
            )}
            <span className="ml-auto flex w-4 shrink-0 items-center justify-center">
              {dirty.has(doc.id) ? (
                <span
                  title="unsaved changes"
                  className="h-[5px] w-[5px] rounded-full bg-accent group-hover:hidden"
                />
              ) : null}
              <button
                aria-label={`close ${docLabel(doc)}`}
                className={`text-muted hover:text-text active:text-dim ${
                  dirty.has(doc.id) ? "hidden group-hover:block" : ""
                }`}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  onClose(doc.id);
                }}
              >
                ×
              </button>
            </span>
          </div>
        );
      })}
      {/* A tab-shaped block, held apart by the same 1px gap as the tabs. */}
      <button
        aria-label="new note"
        title="new note (Ctrl N)"
        onClick={onNew}
        className="grid w-10 shrink-0 place-items-center bg-tab text-[15px] leading-none text-dim hover:bg-tab-hover hover:text-text active:bg-pressed"
      >
        +
      </button>
      <div className="flex-1" />
      {menu && (
        // Positioned at the cursor and nudged back inside the window, so a tab
        // near the right edge still opens a fully visible menu.
        <div
          role="menu"
          onMouseDown={(event) => event.stopPropagation()}
          style={{
            left: Math.min(menu.x, window.innerWidth - 160),
            top: Math.min(menu.y, window.innerHeight - 8 - items.length * 26),
          }}
          className="fixed z-50 min-w-36 bg-surface py-1 shadow-[0_8px_24px_#00000066]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              className="block w-full px-3 py-[5px] text-left text-[12px] text-text hover:bg-raised active:bg-pressed"
              onClick={() => {
                setMenu(null);
                item.run();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

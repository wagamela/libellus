import type { Doc } from "../lib/types";
import { docLabel } from "../store/workspace";

interface TabBarProps {
  tabs: Doc[];
  activeId: string | null;
  dirty: Set<string>;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

export function TabBar({ tabs, activeId, dirty, onSelect, onClose, onNew }: TabBarProps) {
  return (
    <div className="flex h-9 shrink-0 items-stretch gap-px overflow-x-auto bg-tabbar">
      {tabs.map((doc) => {
        const active = doc.id === activeId;
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
              } else {
                onSelect(doc.id);
              }
            }}
            onKeyDown={(event) => event.key === "Enter" && onSelect(doc.id)}
            // The selected tab is the darker of the pair; the 1px gap between
            // tabs is the strip showing through.
            className={`group relative flex max-w-60 min-w-28 items-center gap-2 px-3 text-[12px] ${
              active
                ? "bg-tab-active text-text"
                : "bg-tab text-dim hover:bg-tab-hover hover:text-text"
            }`}
          >
            <span className="text-[10px] text-muted">
              {doc.kind === "note" ? "md" : doc.language.slice(0, 2)}
            </span>
            <span className="truncate">{docLabel(doc)}</span>
            <span className="ml-auto flex w-4 shrink-0 items-center justify-center">
              {dirty.has(doc.id) ? (
                <span
                  title="unsaved changes"
                  className="h-[5px] w-[5px] rounded-full bg-accent group-hover:hidden"
                />
              ) : null}
              <button
                aria-label={`close ${docLabel(doc)}`}
                className={`text-muted hover:text-text ${
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
        className="grid w-10 shrink-0 place-items-center bg-tab text-[15px] leading-none text-dim hover:bg-tab-hover hover:text-text"
      >
        +
      </button>
      <div className="flex-1" />
    </div>
  );
}

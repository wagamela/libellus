import type { Doc } from "../lib/types";
import { docLabel } from "../store/workspace";

interface TabBarProps {
  tabs: Doc[];
  activeId: string | null;
  dirty: Set<string>;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function TabBar({ tabs, activeId, dirty, onSelect, onClose }: TabBarProps) {
  return (
    <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-line bg-tabbar">
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
            className={`group relative flex max-w-60 min-w-28 items-center gap-2 border-r border-line px-3 text-[12px] ${
              active
                ? "bg-workspace text-text"
                : "bg-tabbar text-dim hover:bg-workspace/60 hover:text-text"
            }`}
          >
            {active && <span className="absolute inset-x-0 top-0 h-px bg-accent" />}
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
      <div className="flex-1 border-b border-transparent" />
    </div>
  );
}

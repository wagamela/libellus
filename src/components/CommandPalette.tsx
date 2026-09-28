import { useEffect, useMemo, useRef, useState } from "react";

export interface PaletteItem {
  id: string;
  label: string;
  /** Right-aligned keyboard hint or category. */
  hint?: string;
  /** Second line: a matching excerpt, path, or description. */
  detail?: string;
  run: () => void;
}

interface CommandPaletteProps {
  placeholder: string;
  build: (query: string) => PaletteItem[];
  onClose: () => void;
}

export function CommandPalette({ placeholder, build, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => build(query), [build, query]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, items]);

  const run = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  return (
    <div
      className="fixed inset-0 z-100 flex justify-center bg-black/45 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        className="h-fit w-[min(680px,90vw)] bg-chrome shadow-[0_16px_48px_#00000080]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          spellCheck={false}
          value={query}
          placeholder={placeholder}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowDown" || (event.key === "n" && event.ctrlKey)) {
              event.preventDefault();
              setCursor((c) => Math.min(c + 1, items.length - 1));
            }
            if (event.key === "ArrowUp" || (event.key === "p" && event.ctrlKey)) {
              event.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              run(items[cursor]);
            }
          }}
          className="w-full bg-surface px-4 py-3 text-[13px] text-text outline-none placeholder:text-muted"
        />
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1">
          {items.length === 0 && (
            <div className="px-4 py-3 text-[12px] text-muted">no matches</div>
          )}
          {items.map((item, index) => (
            <button
              key={item.id}
              data-active={index === cursor}
              onMouseMove={() => setCursor(index)}
              onClick={() => run(item)}
              className={`flex w-full items-baseline gap-3 px-4 py-[6px] text-left ${
                index === cursor ? "bg-raised" : ""
              }`}
            >
              <span className="flex-1 truncate text-[12px] text-text">
                {item.label}
                {item.detail && (
                  <span className="block truncate text-[11px] text-muted">{item.detail}</span>
                )}
              </span>
              {item.hint && <span className="text-[11px] text-muted">{item.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

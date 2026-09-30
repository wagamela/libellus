import { useEffect, useMemo, useRef, useState } from "react";

export interface PaletteItem {
  id: string;
  label: string;
  /** Right-aligned keyboard hint or category. */
  hint?: string;
  /** Second line: a matching excerpt, path, or description. */
  detail?: string;
  run: () => void;
  /** Present on rows that stand for something deletable. The palette asks for
   *  a second click before calling it; deleting a document is irreversible. */
  remove?: () => void;
}

/** The only icon in the app so far. Drawn inline rather than pulled from a
 *  library: the CSP forbids fetching anything, and a stroked path in
 *  `currentColor` inherits the same text tokens every other glyph does. */
function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4h11" />
      <path d="M6.5 2.4h3" />
      <path d="M4.1 4l.5 9a1 1 0 0 0 1 .95h4.8a1 1 0 0 0 1-.95l.5-9" />
      <path d="M6.6 6.6v4.7M9.4 6.6v4.7" />
    </svg>
  );
}

interface CommandPaletteProps {
  placeholder: string;
  build: (query: string) => PaletteItem[];
  onClose: () => void;
}

export function CommandPalette({ placeholder, build, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  /** The row whose delete button is armed, if any. Deleting takes the same two
   *  deliberate steps here as it does from the menu. */
  const [armed, setArmed] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Scrolling belongs to keyboard navigation only: doing it for a pointer-driven
  // cursor makes the list shift under the pointer as it moves.
  const keyboardNav = useRef(false);
  const items = useMemo(() => build(query), [build, query]);

  useEffect(() => {
    setCursor(0);
    setArmed(null);
  }, [query]);

  useEffect(() => {
    if (!keyboardNav.current) return;
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, items]);

  const run = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  /** First call arms the row, second one deletes. The palette stays open: the
   *  point of deleting from here is clearing out several documents at once. */
  const remove = (item: PaletteItem | undefined) => {
    if (!item?.remove) return;
    if (armed !== item.id) {
      setArmed(item.id);
      return;
    }
    setArmed(null);
    item.remove();
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
              keyboardNav.current = true;
              setCursor((c) => Math.min(c + 1, items.length - 1));
            }
            if (event.key === "ArrowUp" || (event.key === "p" && event.ctrlKey)) {
              event.preventDefault();
              keyboardNav.current = true;
              setCursor((c) => Math.max(c - 1, 0));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              run(items[cursor]);
            }
            // Keyboard counterpart to the row's delete button.
            if (event.key.toLowerCase() === "d" && event.ctrlKey) {
              event.preventDefault();
              remove(items[cursor]);
            }
          }}
          className="w-full bg-surface px-4 py-3 text-[13px] text-text outline-none placeholder:text-muted"
        />
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1">
          {items.length === 0 && (
            <div className="px-4 py-3 text-[12px] text-muted">no matches</div>
          )}
          {items.map((item, index) => (
            // A row is a container rather than one button: deletable rows
            // carry a second control, and a button cannot sit inside a button.
            <div
              key={item.id}
              data-active={index === cursor}
              onMouseMove={() => {
                if (index === cursor) return;
                keyboardNav.current = false;
                setCursor(index);
                setArmed(null);
              }}
              className={`group flex w-full items-baseline gap-3 px-4 py-[6px] ${
                index === cursor ? "bg-raised" : ""
              }`}
            >
              <button
                onClick={() => run(item)}
                className="flex min-w-0 flex-1 items-baseline text-left active:opacity-70"
              >
                <span className="min-w-0 flex-1 truncate text-[12px] text-text">
                  {item.label}
                  {item.detail && (
                    <span className="block truncate text-[11px] text-muted">{item.detail}</span>
                  )}
                </span>
              </button>
              {item.hint && (
                <span className="shrink-0 text-[11px] text-muted">{item.hint}</span>
              )}
              {item.remove && (
                // Held until the row is hovered or selected, so the list reads
                // as a list of documents and not a list of delete buttons.
                <button
                  aria-label={
                    armed === item.id ? `confirm delete ${item.label}` : `delete ${item.label}`
                  }
                  title="delete document (Ctrl D)"
                  onClick={() => remove(item)}
                  // Negative margin keeps a comfortable hit target from making
                  // the row any taller than its text already makes it.
                  className={`-my-1 flex h-6 shrink-0 items-center gap-1.5 self-center rounded-xs px-1.5 text-[11px] hover:bg-surface hover:text-text active:bg-pressed ${
                    armed === item.id
                      ? "bg-surface text-text"
                      : `text-muted ${index === cursor ? "" : "invisible group-hover:visible"}`
                  }`}
                >
                  {armed === item.id && "delete?"}
                  <TrashIcon />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

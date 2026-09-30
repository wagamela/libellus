import { useCallback, useEffect, useRef, useState } from "react";
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
  /** Drops the dragged tab at `index` in the strip. */
  onMove: (id: string, index: number) => void;
}

/** A drag in progress. Kept in a ref rather than state: the tab follows the
 *  pointer by writing `transform` straight onto the element, so a drag costs
 *  no React renders except the reorders it causes. */
interface Drag {
  id: string;
  /** Where inside the tab the pointer grabbed it. */
  grabOffset: number;
  /** Index the tab started at, so Escape can put it back. */
  origin: number;
  startX: number;
  pointerX: number;
  /** A press only becomes a drag once it has travelled far enough. */
  active: boolean;
}

/** How far the pointer must travel before a press on a tab counts as a drag
 *  rather than a click, so selecting a tab never nudges the order. */
const DRAG_THRESHOLD = 4;

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
  onMove,
}: TabBarProps) {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const strip = useRef<HTMLDivElement>(null);
  const tabEls = useRef(new Map<string, HTMLElement>());
  const drag = useRef<Drag | null>(null);
  /** The translation currently written onto the dragged tab, so its untranslated
   *  position can be recovered from a measured rect. */
  const shift = useRef(0);
  const frame = useRef(0);
  // The pointer handlers live for the whole drag; these keep them reading the
  // current tab list without being torn down and rebuilt on every render.
  const latest = useRef({ tabs, onMove });
  latest.current = { tabs, onMove };

  const endDrag = useCallback((cancel: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (!d) return;
    const el = tabEls.current.get(d.id);
    if (el) el.style.transform = "";
    shift.current = 0;
    if (!d.active) return;
    if (cancel) latest.current.onMove(d.id, d.origin);
    setDraggingId(null);
  }, []);

  useEffect(() => {
    // One measure-and-place pass per frame: the pointer can fire far more
    // often than that, and layout reads do not belong on every event.
    const step = () => {
      frame.current = 0;
      const d = drag.current;
      if (!d?.active) return;
      const el = tabEls.current.get(d.id);
      const bounds = strip.current?.getBoundingClientRect();
      if (!el || !bounds) return;

      const rect = el.getBoundingClientRect();
      const natural = rect.left - shift.current;
      // The tab tracks the pointer but never leaves the strip.
      const left = Math.max(
        bounds.left,
        Math.min(d.pointerX - d.grabOffset, bounds.right - rect.width),
      );
      shift.current = left - natural;
      // Only `transform` moves — nothing here changes layout, so dragging
      // never reflows the strip.
      el.style.transform = `translateX(${shift.current}px)`;

      // Tabs are laid out left to right, so their centres are ordered and the
      // dragged tab belongs wherever it has covered half of a neighbour. The
      // comparison uses the leading edge — the left edge going left, the right
      // edge going right — never the dragged tab's own centre: a tab wider
      // than its neighbour can be pinned against the end of the strip with its
      // centre still short of that neighbour's, which would leave the first
      // and last places unreachable for the widest tab.
      const ids = latest.current.tabs.map((t) => t.id);
      const from = ids.indexOf(d.id);
      const right = left + rect.width;
      let target = from;
      for (let i = 0; i < ids.length; i++) {
        if (i === from) continue;
        const other = tabEls.current.get(ids[i]);
        if (!other) continue;
        const r = other.getBoundingClientRect();
        const c = r.left + r.width / 2;
        if (i < from && left < c) target = Math.min(target, i);
        else if (i > from && right > c) target = Math.max(target, i);
      }
      if (target !== from) {
        latest.current.onMove(d.id, target);
        // The strip re-lays out on the next frame; re-place the tab then so it
        // stays under the pointer even if the pointer has stopped moving.
        frame.current = requestAnimationFrame(step);
      }
    };

    const onPointerMove = (event: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      d.pointerX = event.clientX;
      if (!d.active) {
        if (Math.abs(event.clientX - d.startX) < DRAG_THRESHOLD) return;
        d.active = true;
        setDraggingId(d.id);
      }
      if (!frame.current) frame.current = requestAnimationFrame(step);
    };
    const onPointerUp = () => endDrag(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && drag.current) endDrag(true);
    };

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("keydown", onKey);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [endDrag]);

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
    <div
      ref={strip}
      className="flex h-9 shrink-0 items-stretch gap-px overflow-x-auto bg-tabbar"
    >
      {tabs.map((doc, index) => {
        const active = doc.id === activeId;
        const renaming = doc.id === renamingId;
        const dragged = doc.id === draggingId;
        return (
          <div
            key={doc.id}
            ref={(el) => {
              if (el) tabEls.current.set(doc.id, el);
              else tabEls.current.delete(doc.id);
            }}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                onClose(doc.id);
              } else if (event.button === 0) {
                onSelect(doc.id);
                // Arm a drag. It only becomes one once the pointer has moved
                // past the threshold, so a plain click still just selects.
                if (renaming) return;
                drag.current = {
                  id: doc.id,
                  grabOffset: event.clientX - event.currentTarget.getBoundingClientRect().left,
                  origin: index,
                  startX: event.clientX,
                  pointerX: event.clientX,
                  active: false,
                };
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
            // tabs is the strip showing through. A tab being dragged is lifted
            // out of that strip — above its neighbours, under the same shadow
            // the menus cast — and only `transform` ever moves it.
            className={`group relative flex max-w-60 min-w-28 items-center gap-2 px-3 text-[12px] ${
              active
                ? "bg-tab-active text-text"
                : "bg-tab text-dim hover:bg-tab-hover hover:text-text active:bg-pressed"
            } ${
              dragged
                ? "z-10 cursor-grabbing bg-tab-active text-text shadow-[0_6px_18px_#00000066]"
                : ""
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

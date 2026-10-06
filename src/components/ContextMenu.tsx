import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** One row of a menu, in the menu bar or at the pointer. The two surfaces are
 *  the same surface, so they take the same item. */
export interface MenuAction {
  label: string;
  /** Right-aligned keyboard hint. Never a second action — only a reminder. */
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  /** Groups are held apart by space, never by a rule. */
  separatorBefore?: boolean;
  /** Irreversible: the row arms on the first press and runs on the second, the
   *  same two deliberate steps the palette's delete control takes. */
  confirm?: boolean;
}

/** How far a floating menu stays from the window's edges. */
const MARGIN = 6;

/** The menu surface: the most rounded layer in the app, its items inset far
 *  enough (`p-1.5`) that their own rounding never fights the panel's corners,
 *  and lifted off what is beneath it by a shadow rather than a line.
 *
 *  Both menu surfaces render through this, which is why there is one set of
 *  item states in the app rather than two that drift apart. */
export function MenuPanel({
  items,
  onClose,
  panelRef,
  autoFocus = false,
  className = "",
  style,
}: {
  items: MenuAction[];
  onClose: () => void;
  panelRef?: (node: HTMLDivElement | null) => void;
  /** True for a menu opened at the pointer: it owns the keyboard while it is
   *  up, so it has to hold focus. A menu-bar menu leaves focus where it was. */
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  /** The highlighted row, or -1 until the pointer or a key picks one. */
  const [cursor, setCursor] = useState(-1);
  /** The row waiting for its second press, if any. */
  const [armed, setArmed] = useState<number | null>(null);
  const self = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoFocus) self.current?.focus();
  }, [autoFocus]);

  const enabled = (index: number) => items[index] && !items[index].disabled;

  /** Walks to the next row that can actually be run, so a disabled item is
   *  never something the keyboard has to step over twice. */
  const step = (from: number, delta: number) => {
    for (let i = from + delta; i >= 0 && i < items.length; i += delta) {
      if (enabled(i)) return i;
    }
    return from;
  };

  const run = (index: number) => {
    const item = items[index];
    if (!item || item.disabled) return;
    if (item.confirm && armed !== index) {
      setArmed(index);
      return;
    }
    onClose();
    item.action();
  };

  return (
    <div
      ref={(node) => {
        self.current = node;
        panelRef?.(node);
      }}
      role="menu"
      tabIndex={-1}
      style={style}
      // The panel itself is never the focus ring's subject: the highlighted row
      // is what reads as the keyboard's position.
      className={`rounded-xl bg-surface p-1.5 shadow-[0_8px_24px_#00000066] outline-none ${className}`}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          setCursor((c) => (c < 0 ? step(-1, 1) : step(c, 1)));
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          setCursor((c) => (c < 0 ? step(items.length, -1) : step(c, -1)));
        } else if (event.key === "Home") {
          event.preventDefault();
          setCursor(step(-1, 1));
        } else if (event.key === "End") {
          event.preventDefault();
          setCursor(step(items.length, -1));
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          if (cursor >= 0) run(cursor);
        }
      }}
    >
      {items.map((item, index) => (
        <div key={item.label}>
          {/* Groups are spaced apart, never ruled off. */}
          {item.separatorBefore && <div className="h-2" />}
          <button
            role="menuitem"
            disabled={item.disabled}
            // The highlight is one background, whether the pointer or a key put
            // it there, so hovering and arrowing read as the same selection.
            className={`flex w-full items-center justify-between gap-8 rounded-md px-2.5 py-[5px] text-left text-[12px] ${
              item.disabled
                ? "text-muted"
                : `text-text active:bg-pressed ${
                    index === cursor || armed === index ? "bg-raised" : ""
                  }`
            }`}
            onMouseMove={() => {
              if (item.disabled || index === cursor) return;
              setCursor(index);
              setArmed(null);
            }}
            onClick={() => run(index)}
          >
            <span>{armed === index ? `${item.label}?` : item.label}</span>
            {item.shortcut && <span className="text-[11px] text-muted">{item.shortcut}</span>}
          </button>
        </div>
      ))}
    </div>
  );
}

/** Where a context menu was asked for, and what belongs in it. */
export interface ContextMenuState {
  x: number;
  y: number;
  items: MenuAction[];
}

/** The menu at the pointer. It is the same panel the menu bar drops, placed
 *  against the cursor instead of a title: a desktop tool answers a right-click
 *  with its own menu, not the webview's.
 *
 *  Placement is measured, not guessed — the panel opens down and to the right of
 *  the cursor, flips to the other side when that side is where the room is, and
 *  is clamped into the window as a last resort, so no item ever lands
 *  off-screen. */
export function ContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  // Measured before the browser paints, so the menu is never seen at the
  // unplaced position: it appears once, already where it belongs.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const fit = (point: number, size: number, limit: number) => {
      if (point + size <= limit - MARGIN) return point;
      // Flip to the near side if the menu fits there whole; otherwise sit
      // against the edge.
      if (point - size >= MARGIN) return point - size;
      return Math.max(MARGIN, limit - MARGIN - size);
    };
    setPlace({
      left: fit(state.x, width, window.innerWidth),
      top: fit(state.y, height, window.innerHeight),
    });
  }, [state]);

  useEffect(() => {
    const dismiss = () => onClose();
    const escape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("mousedown", dismiss);
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", dismiss);
    // A menu is anchored to a point in the window, so it cannot follow what
    // moves underneath it.
    window.addEventListener("wheel", dismiss, { passive: true });
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("wheel", dismiss);
    };
  }, [onClose]);

  return (
    <MenuPanel
      panelRef={(node) => (panel.current = node)}
      items={state.items}
      onClose={onClose}
      autoFocus
      className="fixed z-60 min-w-44"
      style={{
        left: place?.left ?? state.x,
        top: place?.top ?? state.y,
        visibility: place ? "visible" : "hidden",
      }}
    />
  );
}

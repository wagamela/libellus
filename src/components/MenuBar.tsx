import { useEffect, useRef, useState } from "react";
import { MenuPanel, type MenuAction } from "./ContextMenu";

/** A menu-bar item is a menu item: the bar and the context menu drop the same
 *  panel, so there is one row shape in the app. */
export type MenuItem = MenuAction;

export interface Menu {
  label: string;
  items: MenuItem[];
}

export function MenuBar({ menus }: { menus: Menu[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!bar.current?.contains(event.target as Node)) setOpen(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      ref={bar}
      className="flex h-8 shrink-0 items-stretch bg-chrome pl-1 select-none"
    >
      {menus.map((menu) => (
        <div key={menu.label} className="relative flex">
          <button
            // Inset from the bar so the open menu's label reads as a rounded
            // block rather than a full-height column of colour.
            className={`my-1 rounded-lg px-3 text-[12px] tracking-wide ${
              open === menu.label ? "bg-raised text-text" : "text-dim hover:text-text"
            }`}
            onMouseDown={(event) => {
              event.preventDefault();
              setOpen(open === menu.label ? null : menu.label);
            }}
            onMouseEnter={() => open && setOpen(menu.label)}
          >
            {menu.label}
          </button>
          {open === menu.label && (
            // A floating layer, dropped from the title rather than placed at a
            // cursor — the same panel the right-click menu is.
            <MenuPanel
              items={menu.items}
              onClose={() => setOpen(null)}
              className="absolute top-8 left-0 z-50 min-w-56"
            />
          )}
        </div>
      ))}
      <div className="flex flex-1 items-center justify-end pr-3 font-mono text-[11px] tracking-[0.25em] text-muted">
        libellus
      </div>
    </div>
  );
}

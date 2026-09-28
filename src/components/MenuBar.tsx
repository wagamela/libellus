import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  separatorBefore?: boolean;
}

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
            className={`px-3 text-[12px] tracking-wide ${
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
            <div className="absolute top-8 left-0 z-50 min-w-56 bg-surface py-1 shadow-[0_8px_24px_#00000066]">
              {menu.items.map((item) => (
                <div key={item.label}>
                  {/* Groups are spaced apart, never ruled off. */}
                  {item.separatorBefore && <div className="h-2" />}
                  <button
                    disabled={item.disabled}
                    className={`flex w-full items-center justify-between gap-8 px-3 py-[5px] text-left text-[12px] ${
                      item.disabled
                        ? "text-muted"
                        : "text-text hover:bg-raised active:bg-pressed"
                    }`}
                    onClick={() => {
                      setOpen(null);
                      item.action();
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className="text-[11px] text-muted">{item.shortcut}</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-1 items-center justify-end pr-3 text-[11px] tracking-[0.25em] text-muted">
        libellus
      </div>
    </div>
  );
}

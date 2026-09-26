import { Check } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** Set on every item to make this a single-choice menu (menuitemradio with a check mark). */
  checked?: boolean;
}

/**
 * A small dropdown menu. Opens below its trigger, moves focus into the list, and closes on
 * Escape, outside click, Tab, or picking an item, returning focus to the trigger.
 */
export function Menu({
  label,
  trigger,
  triggerClassName,
  items,
  title,
}: {
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  items: MenuItem[];
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    const current = Math.max(
      0,
      items.findIndex((item) => item.checked),
    );
    itemRefs.current[current]?.focus();
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // Focus only when the menu opens, not whenever the items re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const onListKeyDown = (event: KeyboardEvent) => {
    const index = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      itemRefs.current[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      itemRefs.current[event.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  };

  const isRadio = items.some((item) => item.checked !== undefined);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={title}
        onClick={() => setOpen((v) => !v)}
        className={`${triggerClassName} ${open ? "bg-ink/[0.06] text-ink" : ""}`}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          onKeyDown={onListKeyDown}
          className="absolute right-0 top-full z-20 mt-1.5 min-w-52 rounded-lg border border-line bg-panel p-1 shadow-float"
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role={isRadio ? "menuitemradio" : "menuitem"}
              aria-checked={isRadio ? Boolean(item.checked) : undefined}
              tabIndex={-1}
              onClick={() => {
                close();
                item.onSelect();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-2 hover:bg-ink/[0.06] hover:text-ink focus-visible:bg-ink/[0.06] focus-visible:text-ink focus-visible:outline-none"
            >
              {item.icon && <span className="flex text-ink-3">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.checked && <Check size={14} weight="bold" className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

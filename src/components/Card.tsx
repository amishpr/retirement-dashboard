import type { ReactNode } from "react";

/** The one panel shape on the page: flat, hairline border, no shadow. Elevation is reserved for
 *  things that float (menus, tooltips), so a card never competes with the numbers inside it. */
export function Card({
  children,
  className = "",
  title,
  subtitle,
  action,
  id,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`min-w-0 rounded-xl border border-line bg-panel p-5 sm:p-6 print:break-inside-avoid print:overflow-visible ${className}`}
    >
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{title}</h2>}
            {subtitle && <p className="mt-1 max-w-[62ch] text-[13px] leading-snug text-ink-3">{subtitle}</p>}
          </div>
          {action && <div className="-mr-1.5 -mt-1 flex shrink-0 items-center gap-1 print:hidden">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  title,
  subtitle,
  action,
  variant = "default",
  accentColor = "var(--series-contrib)",
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  /** "highlight" gives the card a tinted background and colored border, for the one card on the
   *  page (the inputs panel) that should visually read as interactive rather than as a report card. */
  variant?: "default" | "highlight";
  /** Which theme color the "highlight" variant tints toward. Ignored for the default variant. */
  accentColor?: string;
}) {
  const isHighlight = variant === "highlight";
  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 print:break-inside-avoid print:break-after-page print:overflow-visible ${className}`}
      style={{
        background: isHighlight
          ? `linear-gradient(160deg, color-mix(in srgb, ${accentColor} 16%, var(--surface-card)), var(--surface-card) 65%)`
          : "var(--surface-card)",
        borderColor: isHighlight ? `color-mix(in srgb, ${accentColor} 75%, var(--border))` : "var(--border)",
        borderWidth: isHighlight ? "2px" : "1px",
        boxShadow: isHighlight
          ? `0 1px 2px rgba(11, 11, 11, 0.04), 0 12px 32px -14px color-mix(in srgb, ${accentColor} 55%, transparent)`
          : "var(--shadow-card)",
      }}
    >
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

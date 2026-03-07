import { memo } from "react";
import type { ReactNode } from "react";
import { AnimatedNumber } from "./AnimatedNumber";

export const StatTile = memo(function StatTile({
  label,
  value,
  formatter,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: number;
  formatter: (n: number) => string;
  hint?: string;
  accent?: string;
  icon?: ReactNode;
}) {
  // A dynamic formatter (e.g. compact notation for big numbers) should already keep this short,
  // but shrink the type size as a safety net if a formatted value ever comes out unusually long,
  // so a stat box never overflows or wraps no matter how large the underlying number gets.
  const formattedLength = formatter(value).length;
  const valueSizeClass = formattedLength > 10 ? "text-lg sm:text-xl" : formattedLength > 7 ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl";

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: "var(--surface-card)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: `${accent ?? "var(--series-contrib)"}1a`, color: accent ?? "var(--series-contrib)" }}
          >
            {icon}
          </span>
        )}
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
      </div>
      <p className={`mt-3 truncate font-semibold ${valueSizeClass}`} style={{ color: "var(--text-primary)" }}>
        <AnimatedNumber value={value} formatter={formatter} />
      </p>
      {hint && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </p>
      )}
    </div>
  );
});

import type { ReactNode } from "react";

export interface RankedRow {
  key: string;
  label: ReactNode;
  /** Full text for the hover title when the label is truncated. */
  title?: string;
  value: number;
  display: string;
  selected?: boolean;
}

/**
 * A ranked horizontal bar list with the value printed at the end of every row. Bars are scaled to
 * the largest row, not to 100%, so small weights stay readable, and every row carries a direct
 * label, so there's no axis to decode and no long name wrapping under a tick. Neutral bars by
 * default; a selected row gets the accent.
 */
export function RankedBars({
  rows,
  label,
  labelWidth = "9rem",
  valueWidth = "3.75rem",
}: {
  rows: RankedRow[];
  label: string;
  labelWidth?: string;
  valueWidth?: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <ul aria-label={label} className="flex flex-col">
      {rows.map((row) => {
        const share = max > 0 ? Math.max(0, row.value) / max : 0;
        return (
          <li
            key={row.key}
            title={row.title}
            className="grid items-center gap-3 py-[5px] text-[13px]"
            style={{ gridTemplateColumns: `minmax(0, ${labelWidth}) minmax(0, 1fr) ${valueWidth}` }}
          >
            <span className={`truncate ${row.selected ? "font-semibold text-ink" : "text-ink-2"}`}>{row.label}</span>
            <span className="flex h-3 items-center" aria-hidden="true">
              <span
                className={`h-full rounded-r-[3px] ${row.selected ? "bg-accent" : "bg-ink-3/60"}`}
                style={{ width: `${share * 100}%`, minWidth: row.value > 0 ? 2 : 0 }}
              />
            </span>
            <span className={`text-right font-mono tabular-nums ${row.selected ? "font-semibold text-ink" : "text-ink-2"}`}>
              {row.display}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Shown in place of a chart when there's no data for the current fund. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-line-strong px-6 text-center text-[13px] leading-relaxed text-ink-3">
      <p className="max-w-[44ch]">{children}</p>
    </div>
  );
}

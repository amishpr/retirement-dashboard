import type { ReactNode } from "react";

export interface TooltipRow {
  key: string;
  label: string;
  value: string;
  /** Swatch color that ties the row to its mark. Text always stays in ink. */
  color?: string;
  /** Line swatch for line series, square for filled marks. */
  swatch?: "line" | "square";
  emphasis?: boolean;
}

/** The minimal slice of Recharts' tooltip props the custom tooltips read. */
export interface ChartTooltipProps<P = unknown> {
  active?: boolean;
  label?: string | number;
  payload?: readonly { dataKey?: unknown; value?: unknown; payload?: P }[];
}

export function TooltipCard({ title, subtitle, rows }: { title: string; subtitle?: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="min-w-44 rounded-lg border border-line bg-panel px-3 py-2.5 text-xs text-ink shadow-float">
      <p className="font-medium text-ink">{title}</p>
      {subtitle && <p className="mt-0.5 text-ink-3">{subtitle}</p>}
      <div className="mt-2 flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-ink-2">
              {row.color && (
                <span
                  aria-hidden="true"
                  className={row.swatch === "line" ? "h-0.5 w-3 rounded-full" : "h-2 w-2 rounded-[2px]"}
                  style={{ background: row.color }}
                />
              )}
              {row.label}
            </span>
            <span className={`font-mono tabular-nums ${row.emphasis ? "font-semibold" : ""}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface LegendItem {
  key: string;
  label: ReactNode;
  color: string;
  swatch?: "line" | "square" | "band";
}

/** HTML legend above a chart: swatches carry the series color, labels stay in ink. */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={
              item.swatch === "line"
                ? "h-0.5 w-3.5 rounded-full"
                : item.swatch === "band"
                  ? "h-2.5 w-3.5 rounded-[2px] opacity-30"
                  : "h-2.5 w-2.5 rounded-[3px]"
            }
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

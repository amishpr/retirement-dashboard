interface TooltipRow {
  key: string;
  label: string;
  value: string;
  color: string;
}

export function TooltipCard({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        background: "var(--surface-card)",
        borderColor: "var(--border)",
        color: "var(--text-primary)",
      }}
    >
      <p className="mb-1.5 font-semibold" style={{ color: "var(--text-secondary)" }}>
        {title}
      </p>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: row.color }} />
              {row.label}
            </span>
            <span className="font-semibold tabular">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { memo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { FundComposition } from "../data/fundComposition";
import { Card } from "./Card";
import { TooltipCard } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";

function GeographyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <TooltipCard
      title={row.name}
      rows={[
        {
          key: row.name,
          label: "Share of fund",
          value: `${(row.value * 100).toFixed(0)}%`,
          color: row.payload.fill,
        },
      ]}
    />
  );
}

export const GeographyDonut = memo(function GeographyDonut({
  label,
  composition,
  note,
}: {
  label: string;
  composition?: FundComposition;
  note?: string;
}) {
  if (!composition) {
    return (
      <Card title="Domestic vs. International" subtitle="Approximate, illustrative geographic exposure">
        <div className="flex h-56 items-center justify-center text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Not available for {label}. We only have geographic data for a handful of popular ETFs.
        </div>
      </Card>
    );
  }

  const data = [
    { name: "US (domestic)", value: composition.domestic, fill: "var(--series-contrib)" },
    { name: "International", value: composition.international, fill: "var(--series-growth)" },
  ].filter((d) => d.value > 0);

  return (
    <Card
      className="flex h-full flex-col print:h-auto"
      title="Domestic vs. International"
      subtitle={note ?? `Approximate geographic exposure of ${label} — illustrative, not live data`}
      action={
        <DownloadCsvButton
          filename="geographic-exposure.csv"
          getRows={() => data.map((d) => ({ region: d.name, sharePct: (d.value * 100).toFixed(0) }))}
        />
      }
    >
      <div className="relative min-h-[220px] flex-1 print:h-[300px] print:flex-none">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              stroke="var(--surface-card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip content={<GeographyTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {(composition.domestic * 100).toFixed(0)}%
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            US-based
          </span>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
            {d.name} · {(d.value * 100).toFixed(0)}%
          </div>
        ))}
      </div>
    </Card>
  );
});

import { memo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FundComposition } from "../data/fundComposition";
import { Card } from "./Card";
import { TooltipCard } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";

function SectorTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <TooltipCard
      title={row.name}
      rows={[
        {
          key: "weight",
          label: "Share of fund",
          value: `${(row.weight * 100).toFixed(1)}%`,
          color: "var(--series-contrib)",
        },
      ]}
    />
  );
}

export const SectorChart = memo(function SectorChart({
  label,
  composition,
  note,
}: {
  label: string;
  composition?: FundComposition;
  note?: string;
}) {
  const sectors = composition?.sectorWeightings;

  if (!sectors || sectors.length === 0) {
    return (
      <Card title="Sector Weightings" subtitle="Approximate, illustrative composition — not live holdings data">
        <div className="flex h-64 items-center justify-center text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Not available for {label}. Bond funds and individual stocks aren't classified by
          equity sector the same way a stock fund is.
        </div>
      </Card>
    );
  }

  const data = [...sectors].sort((a, b) => b.weight - a.weight);

  return (
    <Card
      className="flex h-full flex-col print:h-auto"
      title="Sector Weightings"
      subtitle={note ?? `Approximate sector mix of ${label} — illustrative, not live data`}
      action={
        <DownloadCsvButton
          filename="sector-weightings.csv"
          getRows={() => data.map((d) => ({ sector: d.name, weightPct: (d.weight * 100).toFixed(1) }))}
        />
      }
    >
      <div className="min-h-[288px] flex-1 print:h-[420px] print:flex-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 0 }} barCategoryGap={6}>
            <CartesianGrid stroke="var(--gridline)" horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: "var(--baseline)" }}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={140}
              tick={{ fill: "var(--text-primary)", fontSize: 11 }}
            />
            <Tooltip content={<SectorTooltip />} cursor={{ fill: "var(--gridline)", opacity: 0.5 }} />
            <Bar dataKey="weight" fill="var(--series-contrib)" radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

import { memo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getTopHoldingsConcentration, type FundComposition } from "../data/fundComposition";
import { Card } from "./Card";
import { TooltipCard } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";

const SLICE_COLORS = [
  "var(--series-contrib)",
  "var(--series-growth)",
  "var(--series-accent)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
  "var(--chart-10)",
];
const OTHER_COLOR = "var(--text-muted)";
const MAX_SLICES = 10;

function HoldingsTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <TooltipCard
      title={row.name}
      rows={[
        {
          key: row.name,
          label: "Weight in fund",
          value: `${(row.value * 100).toFixed(1)}%`,
          color: row.payload.fill,
        },
      ]}
    />
  );
}

export const HoldingsDonut = memo(function HoldingsDonut({
  label,
  composition,
  note,
}: {
  label: string;
  composition?: FundComposition;
  note?: string;
}) {
  if (!composition || composition.topHoldings.length === 0) {
    return (
      <Card title="Top Holdings" subtitle="Approximate, illustrative composition — not live holdings data">
        <div className="flex h-56 items-center justify-center text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Not available for {label}. Holdings breakdowns only exist for funds, not individual
          stocks, and we only have data for a handful of popular ETFs.
        </div>
      </Card>
    );
  }

  const topSlices = composition.topHoldings.slice(0, MAX_SLICES);
  const otherWeight = Math.max(0, 1 - topSlices.reduce((sum, h) => sum + h.weight, 0));
  const data = [
    ...topSlices.map((h, i) => ({ name: h.name, value: h.weight, fill: SLICE_COLORS[i] })),
    { name: "Everything else", value: otherWeight, fill: OTHER_COLOR },
  ];
  const concentration = getTopHoldingsConcentration(composition);

  return (
    <Card
      className="flex h-full flex-col print:h-auto"
      title={`Top ${topSlices.length} Holdings`}
      subtitle={note ?? `Largest positions in ${label} — illustrative, not live holdings data`}
      action={
        <DownloadCsvButton
          filename="top-holdings.csv"
          getRows={() => data.map((d) => ({ holding: d.name, weightPct: (d.value * 100).toFixed(1) }))}
        />
      }
    >
      <p className="mb-3 text-sm" style={{ color: "var(--text-secondary)" }}>
        These make up about{" "}
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
          {(concentration * 100).toFixed(0)}%
        </span>{" "}
        of {label}'s total assets.
      </p>
      <div className="min-h-[220px] flex-1 print:h-[300px] print:flex-none">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="45%"
              outerRadius="100%"
              paddingAngle={1.5}
              stroke="var(--surface-card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip content={<HoldingsTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2" style={{ color: "var(--text-secondary)" }}>
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.fill }} />
            <span className="truncate">{d.name}</span>
            <span className="ml-auto shrink-0 tabular">{(d.value * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
});

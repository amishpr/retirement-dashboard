import { memo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getTopHoldingsConcentration, type FundComposition } from "../data/fundComposition";
import { Card } from "./Card";
import { TooltipCard } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";

function HoldingsTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <TooltipCard
      title={row.name}
      rows={[
        {
          key: "weight",
          label: "Weight in fund",
          value: `${(row.weight * 100).toFixed(1)}%`,
          color: row.isOther ? "var(--text-muted)" : "var(--series-contrib)",
        },
      ]}
    />
  );
}

export const HoldingsChart = memo(function HoldingsChart({
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
        <div className="flex h-64 items-center justify-center text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Not available for {label}. Holdings breakdowns only exist for funds, not individual
          stocks, and we only have data for a handful of popular ETFs.
        </div>
      </Card>
    );
  }

  const otherWeight = Math.max(0, 1 - composition.topHoldings.reduce((sum, h) => sum + h.weight, 0));
  const otherCount = Math.max(0, composition.holdingsCount - composition.topHoldings.length);
  const data = [
    ...composition.topHoldings.map((h) => ({ name: h.name, weight: h.weight, isOther: false })),
    ...(otherWeight > 0 ? [{ name: `Other (~${otherCount} holdings)`, weight: otherWeight, isOther: true }] : []),
  ];

  const holdingsShown = composition.topHoldings.length;
  const concentration = getTopHoldingsConcentration(composition);

  return (
    <Card
      className="flex h-full flex-col print:h-auto"
      title={`Top ${holdingsShown} Holdings`}
      subtitle={note ?? `Approximate composition of ${label} — illustrative, not live holdings data`}
      action={
        <DownloadCsvButton
          filename="top-10-holdings.csv"
          getRows={() => data.map((d) => ({ holding: d.name, weightPct: (d.weight * 100).toFixed(1) }))}
        />
      }
    >
      <p className="mb-3 text-sm" style={{ color: "var(--text-secondary)" }}>
        Your top {holdingsShown} holdings make up about{" "}
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
          {(concentration * 100).toFixed(0)}%
        </span>{" "}
        of {label}'s total assets.
      </p>
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
              width={130}
              tick={{ fill: "var(--text-primary)", fontSize: 11 }}
            />
            <Tooltip content={<HoldingsTooltip />} cursor={{ fill: "var(--gridline)", opacity: 0.5 }} />
            <Bar dataKey="weight" radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.isOther ? "var(--text-muted)" : "var(--series-contrib)"} fillOpacity={d.isOther ? 0.5 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

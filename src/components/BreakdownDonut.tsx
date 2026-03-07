import { memo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { currencyFormatterPrecise, formatCompact } from "../lib/projection";
import { Card } from "./Card";
import { TooltipCard } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <TooltipCard
      title={row.name}
      rows={[
        {
          key: row.name,
          label: row.name,
          value: currencyFormatterPrecise.format(row.value),
          color: row.payload.fill,
        },
      ]}
    />
  );
}

export const BreakdownDonut = memo(function BreakdownDonut({ contributions, growth }: { contributions: number; growth: number }) {
  const total = contributions + growth;
  const data = [
    { name: "Contributions", value: contributions, fill: "var(--series-contrib)" },
    { name: "Investment growth", value: growth, fill: "var(--series-growth)" },
  ];
  const growthShare = total > 0 ? growth / total : 0;

  return (
    <Card
      title="Where Your Balance Comes From"
      subtitle="Contributions vs. compounding at your target age"
      action={
        <DownloadCsvButton
          filename="balance-breakdown.csv"
          getRows={() => data.map((d) => ({ category: d.name, amount: d.value.toFixed(2) }))}
        />
      }
    >
      <div className="relative h-56">
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
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {formatCompact(total)}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {(growthShare * 100).toFixed(0)}% growth
          </span>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
            {d.name}
          </div>
        ))}
      </div>
    </Card>
  );
});

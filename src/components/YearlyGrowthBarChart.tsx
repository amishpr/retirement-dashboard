import { memo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { YearPoint } from "../lib/projection";
import { currencyFormatterPrecise, formatCompact } from "../lib/projection";
import { Card } from "./Card";
import { TooltipCard } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";

interface YearlyGrowthPoint {
  age: number;
  yearlyGrowth: number;
}

function buildYearlyGrowth(data: YearPoint[]): YearlyGrowthPoint[] {
  return data.slice(1).map((point, i) => ({
    age: point.age,
    yearlyGrowth: point.growth - data[i].growth,
  }));
}

function YearlyGrowthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <TooltipCard
      title={`Age ${label}`}
      rows={[
        {
          key: "yearlyGrowth",
          label: "Market growth that year",
          value: currencyFormatterPrecise.format(payload[0].value),
          color: "var(--series-growth)",
        },
      ]}
    />
  );
}

export const YearlyGrowthBarChart = memo(function YearlyGrowthBarChart({ data }: { data: YearPoint[] }) {
  const chartData = buildYearlyGrowth(data);

  return (
    <Card
      title="Growth By Year"
      subtitle="How much of your gain comes from the market each year, not new contributions"
      action={
        <DownloadCsvButton
          filename="growth-by-year.csv"
          getRows={() => chartData.map((row) => ({ age: row.age, yearlyGrowth: row.yearlyGrowth.toFixed(2) }))}
        />
      }
    >
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis
              dataKey="age"
              tickLine={false}
              axisLine={{ stroke: "var(--baseline)" }}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickMargin={8}
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={(v) => formatCompact(v)}
              width={56}
            />
            <Tooltip content={<YearlyGrowthTooltip />} cursor={{ fill: "var(--gridline)", opacity: 0.5 }} />
            <Bar dataKey="yearlyGrowth" name="Market growth" fill="var(--series-growth)" radius={[3, 3, 0, 0]} maxBarSize={20} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

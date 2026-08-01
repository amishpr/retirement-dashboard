import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildYearlyGrowth, currencyFormatterPrecise, type YearPoint, type YearlyGrowthPoint } from "../lib/projection";
import {
  bandCursor,
  formatAxisMoney,
  gridProps,
  niceTicks,
  REVEAL_MS,
  useMountReveal,
  xAxisProps,
  yAxisProps,
} from "../lib/chartTheme";
import { TooltipCard, type ChartTooltipProps } from "./ChartTooltip";

function YearlyGrowthTooltip({ active, payload, label }: ChartTooltipProps<YearlyGrowthPoint>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <TooltipCard
      title={`Age ${label}`}
      rows={[
        {
          key: "yearlyGrowth",
          label: "Market growth that year",
          value: currencyFormatterPrecise.format(point.yearlyGrowth),
          color: "var(--accent)",
        },
      ]}
    />
  );
}

/** Market growth added in each year, excluding new contributions. Chart body only. */
export const YearlyGrowthBarChart = memo(function YearlyGrowthBarChart({ data }: { data: YearPoint[] }) {
  const reveal = useMountReveal();
  const chartData = useMemo(() => buildYearlyGrowth(data), [data]);
  const hasNegative = chartData.some((d) => d.yearlyGrowth < 0);
  const ticks = hasNegative ? undefined : niceTicks(Math.max(0, ...chartData.map((d) => d.yearlyGrowth)));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="age" {...xAxisProps} interval="preserveStartEnd" minTickGap={28} />
        <YAxis
          {...yAxisProps}
          ticks={ticks}
          domain={ticks ? [0, ticks[ticks.length - 1]] : undefined}
          tickFormatter={formatAxisMoney}
          width={52}
        />
        <Tooltip content={<YearlyGrowthTooltip />} cursor={bandCursor} />
        <Bar
          dataKey="yearlyGrowth"
          fill="var(--accent)"
          radius={[3, 3, 0, 0]}
          maxBarSize={20}
          isAnimationActive={reveal}
          animationDuration={REVEAL_MS}
        />
      </BarChart>
    </ResponsiveContainer>
  );
});

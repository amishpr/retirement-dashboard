import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildYearlyGrowth, currencyFormatterPrecise, type YearPoint, type YearlyGrowthPoint } from "../lib/projection";
import {
  bandCursor,
  formatAxisMoney,
  gridProps,
  niceTicks,
  niceTicksRange,
  REVEAL_MS,
  useMountReveal,
  xAxisProps,
  yAxisProps,
} from "../lib/chartTheme";
import { TooltipCard, type ChartTooltipProps } from "./ChartTooltip";
import { EmptyNote } from "./RankedBars";

/** A losing year (only possible with a negative assumed return) wears the critical status color,
 *  since a loss means "bad" here rather than being just another series. */
const barColor = (value: number) => (value < 0 ? "var(--status-critical)" : "var(--accent)");

function YearlyGrowthTooltip({ active, payload, label }: ChartTooltipProps<YearlyGrowthPoint>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const loss = point.yearlyGrowth < 0;
  return (
    <TooltipCard
      title={`Age ${label}`}
      rows={[
        {
          key: "yearlyGrowth",
          label: loss ? "Market loss that year" : "Market growth that year",
          value: currencyFormatterPrecise.format(point.yearlyGrowth),
          color: barColor(point.yearlyGrowth),
        },
      ]}
    />
  );
}

/** Market growth added in each year, excluding new contributions. Chart body only. */
export const YearlyGrowthBarChart = memo(function YearlyGrowthBarChart({ data }: { data: YearPoint[] }) {
  const reveal = useMountReveal();
  const chartData = useMemo(() => buildYearlyGrowth(data), [data]);
  const values = chartData.map((d) => d.yearlyGrowth);
  const hasNegative = values.some((v) => v < 0);
  const ticks = hasNegative ? niceTicksRange(Math.min(...values), Math.max(...values)) : niceTicks(Math.max(0, ...values));

  // At a 0% return every bar is zero, which drew an empty grid with nothing to explain it.
  if (values.every((v) => v === 0)) {
    return <EmptyNote className="h-full">At a 0% return, the market adds nothing in any year, so there are no bars to show.</EmptyNote>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="age" {...xAxisProps} interval="preserveStartEnd" minTickGap={28} />
        <YAxis
          {...yAxisProps}
          ticks={ticks}
          domain={[ticks[0], ticks[ticks.length - 1]]}
          tickFormatter={formatAxisMoney}
          width={52}
        />
        <Tooltip content={<YearlyGrowthTooltip />} cursor={bandCursor} />
        <Bar
          dataKey="yearlyGrowth"
          fill="var(--accent)"
          radius={[4, 4, 0, 0]}
          maxBarSize={20}
          isAnimationActive={reveal}
          animationDuration={REVEAL_MS}
        >
          {hasNegative && chartData.map((d) => <Cell key={d.age} fill={barColor(d.yearlyGrowth)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

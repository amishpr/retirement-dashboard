import { memo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { YearPoint } from "../lib/projection";
import { currencyFormatterPrecise } from "../lib/projection";
import {
  formatAxisMoney,
  gridProps,
  lineCursor,
  niceTicks,
  REVEAL_MS,
  useMountReveal,
  xAxisProps,
  yAxisProps,
} from "../lib/chartTheme";
import { ChartLegend, TooltipCard, type ChartTooltipProps } from "./ChartTooltip";

const money = (v: number) => currencyFormatterPrecise.format(v);

/** A negative assumed return turns growth into a loss for the whole run, and a loss wears the
 *  critical status color, the same as the losing years in the Yearly view. */
const growthSeries = (loss: boolean) =>
  loss
    ? { label: "Market loss", color: "var(--status-critical)" }
    : { label: "Market growth", color: "var(--accent)" };

function GrowthTooltip({ active, payload, label }: ChartTooltipProps<YearPoint>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <TooltipCard
      title={`Age ${label}`}
      rows={[
        { key: "balance", label: "Balance", value: money(point.contributions + point.growth), emphasis: true },
        { key: "contributions", label: "You put in", value: money(point.contributions), color: "var(--contrib)" },
        { key: "growth", ...growthSeries(point.growth < 0), value: money(point.growth) },
      ]}
    />
  );
}

/** Stacked balance: contributions underneath, market growth on top. Chart body only; the
 *  Projection card supplies the frame, title, and height. */
export const GrowthChart = memo(function GrowthChart({ data }: { data: YearPoint[] }) {
  const reveal = useMountReveal();
  // Round-number y ticks, unless a negative return pushes growth below zero, where Recharts'
  // own scale handles the negative range better.
  const hasNegative = data.some((d) => d.growth < 0);
  const ticks = hasNegative ? undefined : niceTicks(Math.max(...data.map((d) => d.contributions + d.growth)));
  const growth = growthSeries(hasNegative);

  return (
    <div className="flex h-full flex-col">
      <ChartLegend
        items={[
          { key: "contributions", label: "You put in", color: "var(--contrib)" },
          { key: "growth", ...growth },
        ]}
      />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="age" {...xAxisProps} interval="preserveStartEnd" minTickGap={28} />
            <YAxis
              {...yAxisProps}
              ticks={ticks}
              domain={ticks ? [0, ticks[ticks.length - 1]] : undefined}
              tickFormatter={formatAxisMoney}
              width={52}
            />
            <Tooltip content={<GrowthTooltip />} cursor={lineCursor} />
            <Area
              type="monotone"
              dataKey="contributions"
              stackId="1"
              stroke="var(--contrib)"
              strokeWidth={2}
              fill="var(--contrib)"
              // Heavier than the growth wash: in the dark theme nord8 and nord14 sit at almost the
              // same lightness, so the two layers need a difference in fill strength to separate.
              fillOpacity={0.26}
              isAnimationActive={reveal}
              animationDuration={REVEAL_MS}
            />
            <Area
              type="monotone"
              dataKey="growth"
              stackId="1"
              stroke={growth.color}
              strokeWidth={2}
              fill={growth.color}
              fillOpacity={0.12}
              isAnimationActive={reveal}
              animationDuration={REVEAL_MS}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

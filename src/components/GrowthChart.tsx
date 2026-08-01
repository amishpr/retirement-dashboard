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

function GrowthTooltip({ active, payload, label }: ChartTooltipProps<YearPoint>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <TooltipCard
      title={`Age ${label}`}
      rows={[
        { key: "balance", label: "Balance", value: money(point.contributions + point.growth), emphasis: true },
        { key: "contributions", label: "You put in", value: money(point.contributions), color: "var(--contrib)" },
        { key: "growth", label: "Market growth", value: money(point.growth), color: "var(--accent)" },
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

  return (
    <div className="flex h-full flex-col">
      <ChartLegend
        items={[
          { key: "contributions", label: "You put in", color: "var(--contrib)" },
          { key: "growth", label: "Market growth", color: "var(--accent)" },
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
              fillOpacity={0.16}
              isAnimationActive={reveal}
              animationDuration={REVEAL_MS}
            />
            <Area
              type="monotone"
              dataKey="growth"
              stackId="1"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="var(--accent)"
              fillOpacity={0.16}
              isAnimationActive={reveal}
              animationDuration={REVEAL_MS}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

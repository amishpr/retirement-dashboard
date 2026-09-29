import { memo, useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InflationPath } from "../lib/inflation";
import { currencyFormatter, currencyFormatterPrecise, type YearPoint } from "../lib/projection";
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

interface BuyingPowerPoint {
  age: number;
  calendarYear: number;
  future: number;
  today: number;
  priceIndex: number;
  /** Today's-dollar balance if prices end up at their 90th and 10th percentiles. */
  range?: [low: number, high: number];
  /** What inflation takes: from the future-dollar line down to the top of the likely range (or to
   *  the today's-dollar line when there's no range), so the two shaded areas never overlap. */
  gap: [low: number, high: number];
}

const money = (v: number) => currencyFormatterPrecise.format(v);

function BuyingPowerTooltip({ active, payload }: ChartTooltipProps<BuyingPowerPoint>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <TooltipCard
      title={`Age ${point.age} · ${point.calendarYear}`}
      subtitle={point.priceIndex > 1 ? `Prices ${point.priceIndex.toFixed(2)}× today` : "Today's prices"}
      rows={[
        { key: "future", label: "Future dollars", value: money(point.future), color: "var(--ink-3)", swatch: "dash" },
        { key: "today", label: "Today's dollars", value: money(point.today), color: "var(--accent)", swatch: "line", emphasis: true },
        ...(point.range && point.range[1] > point.range[0]
          ? [
              {
                key: "range",
                label: "Likely range",
                value: `${currencyFormatter.format(point.range[0])} to ${currencyFormatter.format(point.range[1])}`,
              },
            ]
          : []),
        { key: "gap", label: "Lost to inflation", value: money(point.future - point.today), color: "var(--inflation)" },
      ]}
    />
  );
}

/**
 * The same balance in future dollars (what the statement will say) and today's dollars (what it
 * will buy), with the 10 to 90% range for prices around the today's-dollar line and the space
 * between the two lines tinted as what inflation takes. Chart body only.
 */
export const BuyingPowerChart = memo(function BuyingPowerChart({ data, path }: { data: YearPoint[]; path: InflationPath }) {
  const reveal = useMountReveal();
  const hasRange = path.years.some((y) => y.priceLow !== undefined);

  const chartData = useMemo<BuyingPowerPoint[]>(
    () =>
      data.map((point) => {
        const year = path.years[point.year - 1];
        const range: [number, number] | undefined =
          hasRange && year?.priceHigh && year.priceLow
            ? [point.balance / year.priceHigh, point.balance / year.priceLow]
            : hasRange
              ? [point.realBalance, point.realBalance]
              : undefined;
        return {
          age: point.age,
          calendarYear: point.calendarYear,
          future: point.balance,
          today: point.realBalance,
          priceIndex: point.priceIndex,
          range,
          gap: [Math.min(point.balance, range ? range[1] : point.realBalance), point.balance],
        };
      }),
    [data, path, hasRange],
  );

  const max = Math.max(...chartData.map((d) => Math.max(d.future, d.range?.[1] ?? 0)));
  const ticks = max > 0 ? niceTicks(max) : undefined;

  return (
    <div className="flex h-full flex-col">
      <ChartLegend
        items={[
          { key: "future", label: "Future dollars", color: "var(--ink-3)", swatch: "dash" },
          { key: "today", label: "Today's dollars", color: "var(--accent)", swatch: "line" },
          ...(hasRange ? [{ key: "range", label: "Likely range", color: "var(--accent)", swatch: "band" as const }] : []),
          { key: "gap", label: "Lost to inflation", color: "var(--inflation)" },
        ]}
      />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="age" {...xAxisProps} interval="preserveStartEnd" minTickGap={28} />
            <YAxis
              {...yAxisProps}
              ticks={ticks}
              domain={ticks ? [0, ticks[ticks.length - 1]] : undefined}
              tickFormatter={formatAxisMoney}
              width={52}
            />
            <Tooltip content={<BuyingPowerTooltip />} cursor={lineCursor} />
            <Area
              dataKey="gap"
              stroke="none"
              fill="var(--inflation)"
              fillOpacity={0.22}
              activeDot={false}
              isAnimationActive={reveal}
              animationDuration={REVEAL_MS}
            />
            {hasRange && (
              <Area
                dataKey="range"
                stroke="none"
                fill="var(--accent)"
                fillOpacity={0.16}
                activeDot={false}
                isAnimationActive={reveal}
                animationDuration={REVEAL_MS}
              />
            )}
            <Line
              dataKey="future"
              stroke="var(--ink-3)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--panel)" }}
              isAnimationActive={reveal}
              animationDuration={REVEAL_MS}
            />
            <Line
              dataKey="today"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--panel)" }}
              isAnimationActive={reveal}
              animationDuration={REVEAL_MS}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

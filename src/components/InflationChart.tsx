import { memo } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { bandCursor, formatAxisPercent, gridProps, niceTicksRange, REVEAL_MS, useMountReveal, xAxisProps, yAxisProps } from "../lib/chartTheme";
import { ChartLegend, TooltipCard, type ChartTooltipProps } from "./ChartTooltip";

/** One calendar year, in percent. A year has either an actual rate (history) or a forecast. */
export interface InflationChartPoint {
  year: number;
  actual?: number;
  forecast?: number;
  range?: [low: number, high: number];
}

const pct = (v: number) => `${v.toFixed(1)}%`;

function InflationTooltip({ active, payload }: ChartTooltipProps<InflationChartPoint>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <TooltipCard
      title={String(point.year)}
      rows={[
        ...(point.actual !== undefined
          ? [{ key: "actual", label: "Actual", value: pct(point.actual), color: "var(--inflation)", emphasis: true }]
          : []),
        ...(point.forecast !== undefined
          ? [{ key: "forecast", label: "Forecast", value: pct(point.forecast), color: "var(--inflation)", swatch: "dash" as const, emphasis: point.actual === undefined }]
          : []),
        ...(point.range && point.range[1] > point.range[0]
          ? [{ key: "range", label: "Likely range", value: `${pct(point.range[0])} to ${pct(point.range[1])}` }]
          : []),
      ]}
    />
  );
}

/**
 * Yearly US inflation: bars for what happened, then a dashed line for what the plan assumes, with
 * its 10 to 90% range. History and forecast are the same quantity, so they share one color and
 * differ in shape. Chart body only.
 */
export const InflationChart = memo(function InflationChart({
  data,
  today,
  planAverage,
  hasRange,
}: {
  data: InflationChartPoint[];
  today: number;
  /** The plan's average rate, in percent, drawn as a reference line. */
  planAverage: number;
  hasRange: boolean;
}) {
  const reveal = useMountReveal();
  const values = data.flatMap((d) => [d.actual ?? 0, d.forecast ?? 0, ...(d.range ?? [])]);
  const ticks = niceTicksRange(Math.min(...values), Math.max(...values), 5);
  const first = data[0]?.year ?? today;
  const last = data[data.length - 1]?.year ?? today;
  const decadeTicks: number[] = [];
  for (let y = Math.ceil(first / 10) * 10; y <= last; y += 10) decadeTicks.push(y);

  return (
    <div className="flex h-full flex-col">
      <ChartLegend
        items={[
          { key: "actual", label: "Actual", color: "var(--inflation)" },
          { key: "forecast", label: "Plan assumption", color: "var(--inflation)", swatch: "dash" },
          ...(hasRange ? [{ key: "range", label: "Likely range", color: "var(--inflation)", swatch: "band" as const }] : []),
          { key: "average", label: `Plan average ${pct(planAverage)}`, color: "var(--ink-3)", swatch: "dash" },
        ]}
      />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 14, right: 8, left: 0, bottom: 0 }} barCategoryGap={1}>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="year"
              type="number"
              domain={[first - 0.5, last + 0.5]}
              ticks={decadeTicks}
              {...xAxisProps}
            />
            <YAxis {...yAxisProps} ticks={ticks} domain={[ticks[0], ticks[ticks.length - 1]]} tickFormatter={formatAxisPercent} width={40} />
            <Tooltip content={<InflationTooltip />} cursor={bandCursor} />
            <ReferenceLine y={0} stroke="var(--line-strong)" />
            {hasRange && (
              <Area
                dataKey="range"
                stroke="none"
                fill="var(--inflation)"
                fillOpacity={0.14}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={reveal}
                animationDuration={REVEAL_MS}
              />
            )}
            <Bar dataKey="actual" fill="var(--inflation)" radius={[2, 2, 0, 0]} maxBarSize={10} isAnimationActive={reveal} animationDuration={REVEAL_MS} />
            <Line
              dataKey="forecast"
              stroke="var(--inflation)"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--panel)" }}
              connectNulls={false}
              isAnimationActive={reveal}
              animationDuration={REVEAL_MS}
            />
            <ReferenceLine y={planAverage} stroke="var(--ink-3)" strokeDasharray="3 3" />
            <ReferenceLine
              x={today}
              stroke="var(--ink-3)"
              label={{ value: "Today", position: "top", fill: "var(--ink-2)", fontSize: 12, offset: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

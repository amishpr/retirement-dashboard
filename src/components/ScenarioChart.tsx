import { memo, useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

export interface ScenarioPoint {
  age: number;
  conservative: number;
  expected: number;
  optimistic: number;
}

type FanPoint = ScenarioPoint & { range: [number, number] };

const money = (v: number) => currencyFormatterPrecise.format(v);
const rate = (r: number) => `${(r * 100).toFixed(1)}%`;

function ScenarioTooltip({ active, payload, label }: ChartTooltipProps<FanPoint>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <TooltipCard
      title={`Age ${label}`}
      rows={[
        { key: "optimistic", label: "Higher returns", value: money(point.optimistic) },
        { key: "expected", label: "Expected", value: money(point.expected), color: "var(--accent)", swatch: "line", emphasis: true },
        { key: "conservative", label: "Lower returns", value: money(point.conservative) },
      ]}
    />
  );
}

/**
 * The expected path with a shaded band from the lower-return to the higher-return case. The three
 * cases are one ordered range, not three categories, so they share one hue: a solid line for the
 * expectation and a light band (with thin dashed edges) for the spread around it.
 */
export const ScenarioChart = memo(function ScenarioChart({
  data,
  annualReturn,
  returnSpread,
}: {
  data: ScenarioPoint[];
  annualReturn: number;
  returnSpread: number;
}) {
  const reveal = useMountReveal();
  const rows: FanPoint[] = useMemo(() => data.map((d) => ({ ...d, range: [d.conservative, d.optimistic] })), [data]);
  const hasNegative = data.some((d) => d.conservative < 0);
  const ticks = hasNegative ? undefined : niceTicks(Math.max(...data.map((d) => d.optimistic)));
  const edge = { stroke: "var(--accent)", strokeOpacity: 0.5, strokeWidth: 1, strokeDasharray: "3 4", dot: false } as const;

  return (
    <div className="flex h-full flex-col">
      <ChartLegend
        items={[
          { key: "expected", label: `Expected, ${rate(annualReturn)} a year`, color: "var(--accent)", swatch: "line" },
          {
            key: "range",
            label: `Range, ${rate(Math.max(0, annualReturn - returnSpread))} to ${rate(annualReturn + returnSpread)}`,
            color: "var(--accent)",
            swatch: "band",
          },
        ]}
      />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="age" {...xAxisProps} interval="preserveStartEnd" minTickGap={28} />
            <YAxis
              {...yAxisProps}
              ticks={ticks}
              domain={ticks ? [0, ticks[ticks.length - 1]] : undefined}
              tickFormatter={formatAxisMoney}
              width={52}
            />
            <Tooltip content={<ScenarioTooltip />} cursor={lineCursor} />
            <Area
              type="monotone"
              dataKey="range"
              stroke="none"
              fill="var(--accent)"
              fillOpacity={0.13}
              isAnimationActive={reveal}
              animationDuration={REVEAL_MS}
            />
            <Line type="monotone" dataKey="optimistic" {...edge} isAnimationActive={false} />
            <Line type="monotone" dataKey="conservative" {...edge} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="expected"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--panel)", strokeWidth: 2 }}
              isAnimationActive={reveal}
              animationDuration={REVEAL_MS}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

import { memo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { currencyFormatterPrecise, formatCompact } from "../lib/projection";
import { Card } from "./Card";
import { TooltipCard } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";

export interface ScenarioPoint {
  age: number;
  conservative: number;
  expected: number;
  optimistic: number;
}

const SERIES = [
  { key: "optimistic", label: "Optimistic", color: "var(--series-growth)" },
  { key: "expected", label: "Expected", color: "var(--series-contrib)" },
  { key: "conservative", label: "Conservative", color: "var(--series-accent)" },
] as const;

function ScenarioTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <TooltipCard
      title={`Age ${label}`}
      rows={SERIES.map((s) => ({
        key: s.key,
        label: s.label,
        value: currencyFormatterPrecise.format(payload.find((p: any) => p.dataKey === s.key)?.value ?? 0),
        color: s.color,
      }))}
    />
  );
}

export const ScenarioChart = memo(function ScenarioChart({ data, returnSpread }: { data: ScenarioPoint[]; returnSpread: number }) {
  return (
    <Card
      title="What If Returns Differ?"
      subtitle={`Expected return ±${(returnSpread * 100).toFixed(0)}pp shows a realistic range of outcomes`}
      action={
        <DownloadCsvButton
          filename="scenario-range.csv"
          getRows={() =>
            data.map((row) => ({
              age: row.age,
              conservative: row.conservative.toFixed(2),
              expected: row.expected.toFixed(2),
              optimistic: row.optimistic.toFixed(2),
            }))
          }
        />
      }
    >
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis
              dataKey="age"
              tickLine={false}
              axisLine={{ stroke: "var(--baseline)" }}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={(v) => formatCompact(v)}
              width={56}
            />
            <Tooltip
              content={<ScenarioTooltip />}
              cursor={{ stroke: "var(--baseline)", strokeWidth: 1, strokeDasharray: "3 3" }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={32}
              iconType="line"
              wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
            />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-card)" }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

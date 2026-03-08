import { memo } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./Card";
import { TooltipCard } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";

export interface RiskReturnPoint {
  ticker: string;
  risk: number;
  returnPct: number;
  highlighted: boolean;
}

function RiskDot(props: any) {
  const { cx, cy, payload } = props;
  const point = payload as RiskReturnPoint;
  const color = point.highlighted ? "var(--series-growth)" : "var(--series-contrib)";
  const r = point.highlighted ? 6 : 5;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={point.highlighted ? 1 : 0.6} stroke="var(--surface-card)" strokeWidth={1.5} />
      <text x={cx} y={cy - r - 5} textAnchor="middle" fontSize={11} fontWeight={point.highlighted ? 700 : 500} fill="var(--text-secondary)">
        {point.ticker}
      </text>
    </g>
  );
}

function RiskReturnTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as RiskReturnPoint;
  return (
    <TooltipCard
      title={point.ticker}
      rows={[
        {
          key: "return",
          label: "Avg. annual return",
          value: `${point.returnPct.toFixed(1)}%`,
          color: "var(--series-growth)",
        },
        {
          key: "risk",
          label: "Annualized volatility",
          value: `${point.risk.toFixed(1)}%`,
          color: "var(--series-contrib)",
        },
      ]}
    />
  );
}

export const RiskReturnChart = memo(function RiskReturnChart({ points, subtitle }: { points: RiskReturnPoint[]; subtitle?: string }) {
  const data = points.map((p) => ({ ...p, risk: p.risk * 100 }));

  return (
    <Card
      title="Risk vs. Return"
      subtitle={subtitle ?? "More volatility (right) doesn't always mean more return (up) — this is where that tradeoff shows up"}
      action={
        <DownloadCsvButton
          filename="risk-vs-return.csv"
          getRows={() =>
            points.map((p) => ({
              ticker: p.ticker,
              volatilityPct: (p.risk * 100).toFixed(1),
              avgReturnPct: p.returnPct.toFixed(1),
            }))
          }
        />
      }
    >
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="var(--gridline)" />
            <XAxis
              type="number"
              dataKey="risk"
              name="Risk"
              unit="%"
              tickLine={false}
              axisLine={{ stroke: "var(--baseline)" }}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              label={{ value: "Annualized volatility →", position: "insideBottom", offset: -2, fill: "var(--text-muted)", fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="returnPct"
              name="Return"
              unit="%"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              width={44}
              label={{ value: "Avg. return →", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 11 }}
            />
            <Tooltip content={<RiskReturnTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "var(--baseline)" }} />
            <Scatter data={data} shape={<RiskDot />} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

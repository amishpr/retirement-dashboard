import { memo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RiskLabel } from "../data/etfs";
import { Card } from "./Card";
import { TooltipCard } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";

export interface VolatilityPoint {
  ticker: string;
  volatility: number;
  riskLabel: RiskLabel;
  highlighted: boolean;
}

const RISK_COLOR: Record<RiskLabel, string> = {
  Low: "var(--status-good)",
  Medium: "var(--status-warning)",
  High: "var(--status-serious)",
  "Very High": "var(--status-critical)",
};

function VolatilityTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as VolatilityPoint;
  return (
    <TooltipCard
      title={row.ticker}
      rows={[
        {
          key: "volatility",
          label: "Annualized volatility",
          value: `${(row.volatility * 100).toFixed(1)}%`,
          color: RISK_COLOR[row.riskLabel],
        },
        {
          key: "risk",
          label: "Risk level",
          value: row.riskLabel,
          color: RISK_COLOR[row.riskLabel],
        },
      ]}
    />
  );
}

export const VolatilityBarChart = memo(function VolatilityBarChart({ points }: { points: VolatilityPoint[] }) {
  const rows = [...points].sort((a, b) => a.volatility - b.volatility);

  return (
    <Card
      title="Volatility By Fund"
      subtitle="Lower is steadier; higher swings more year to year"
      action={
        <DownloadCsvButton
          filename="volatility-by-fund.csv"
          getRows={() =>
            rows.map((r) => ({ ticker: r.ticker, volatilityPct: (r.volatility * 100).toFixed(1), riskLabel: r.riskLabel }))
          }
        />
      }
    >
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }} barCategoryGap={10}>
            <CartesianGrid stroke="var(--gridline)" horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: "var(--baseline)" }}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <YAxis
              type="category"
              dataKey="ticker"
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: "var(--text-primary)", fontSize: 12, fontWeight: 600 }}
            />
            <Tooltip content={<VolatilityTooltip />} cursor={{ fill: "var(--gridline)", opacity: 0.5 }} />
            <Bar dataKey="volatility" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
              {rows.map((row) => (
                <Cell
                  key={row.ticker}
                  fill={RISK_COLOR[row.riskLabel]}
                  stroke={row.highlighted ? "var(--text-primary)" : "none"}
                  strokeWidth={row.highlighted ? 1.5 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        {(["Low", "Medium", "High", "Very High"] as const).map((label) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR[label] }} />
            {label}
          </div>
        ))}
      </div>
    </Card>
  );
});

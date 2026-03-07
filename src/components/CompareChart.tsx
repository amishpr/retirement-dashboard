import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { currencyFormatterPrecise, finalPoint, formatCompact } from "../lib/projection";
import type { ProjectionInput } from "../lib/projection";
import { Card } from "./Card";
import { TooltipCard } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";

export interface CompareFund {
  ticker: string;
  name: string;
  avgReturn: number;
  expenseRatio?: number;
}

function CompareTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const rows = [
    {
      key: "balance",
      label: "Projected balance",
      value: currencyFormatterPrecise.format(row.balance),
      color: row.selected ? "var(--series-growth)" : "var(--series-contrib)",
    },
    {
      key: "return",
      label: "Avg. annual return",
      value: `${(row.avgReturn * 100).toFixed(1)}%`,
      color: "var(--text-muted)",
    },
  ];
  if (typeof row.expenseRatio === "number") {
    rows.push({
      key: "expenseRatio",
      label: "Expense ratio",
      value: `${(row.expenseRatio * 100).toFixed(2)}%/yr`,
      color: "var(--text-muted)",
    });
  }
  return <TooltipCard title={`${row.ticker} — ${row.name}`} rows={rows} />;
}

export const CompareChart = memo(function CompareChart({
  input,
  funds,
  highlightTicker,
}: {
  input: ProjectionInput;
  funds: CompareFund[];
  highlightTicker: string;
}) {
  const rows = useMemo(
    () =>
      funds
        .map((fund) => {
          const point = finalPoint(input, fund.avgReturn);
          return {
            ticker: fund.ticker,
            name: fund.name,
            avgReturn: fund.avgReturn,
            expenseRatio: fund.expenseRatio,
            balance: point.balance,
            selected: fund.ticker === highlightTicker,
          };
        })
        .sort((a, b) => b.balance - a.balance),
    [funds, input, highlightTicker],
  );

  return (
    <Card
      title="How Popular ETFs Compare"
      subtitle="Same schedule and timeline, applied to each fund's historical average return"
      action={
        <DownloadCsvButton
          filename="etf-comparison.csv"
          getRows={() =>
            rows.map((r) => ({
              ticker: r.ticker,
              name: r.name,
              avgReturnPct: (r.avgReturn * 100).toFixed(1),
              expenseRatioPct: r.expenseRatio !== undefined ? (r.expenseRatio * 100).toFixed(2) : "",
              projectedBalance: r.balance.toFixed(2),
            }))
          }
        />
      }
    >
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }} barCategoryGap={10}>
            <CartesianGrid stroke="var(--gridline)" horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: "var(--baseline)" }}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={(v) => formatCompact(v)}
            />
            <YAxis
              type="category"
              dataKey="ticker"
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: "var(--text-primary)", fontSize: 12, fontWeight: 600 }}
            />
            <Tooltip content={<CompareTooltip />} cursor={{ fill: "var(--gridline)", opacity: 0.5 }} />
            <Bar dataKey="balance" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
              {rows.map((row) => (
                <Cell
                  key={row.ticker}
                  fill={row.selected ? "var(--series-growth)" : "var(--series-contrib)"}
                  fillOpacity={row.selected ? 1 : 0.55}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});

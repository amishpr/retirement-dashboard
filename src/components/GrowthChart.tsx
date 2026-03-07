import { memo, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { YearPoint } from "../lib/projection";
import { currencyFormatterPrecise, formatCompact } from "../lib/projection";
import { Card } from "./Card";
import { TooltipCard } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";
import { TableIcon, LineChartIcon } from "lucide-react";

function GrowthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const contrib = payload.find((p: any) => p.dataKey === "contributions")?.value ?? 0;
  const growth = payload.find((p: any) => p.dataKey === "growth")?.value ?? 0;
  return (
    <TooltipCard
      title={`Age ${label}`}
      rows={[
        {
          key: "balance",
          label: "Total balance",
          value: currencyFormatterPrecise.format(contrib + growth),
          color: "var(--text-primary)",
        },
        {
          key: "contributions",
          label: "Contributions",
          value: currencyFormatterPrecise.format(contrib),
          color: "var(--series-contrib)",
        },
        {
          key: "growth",
          label: "Investment growth",
          value: currencyFormatterPrecise.format(growth),
          color: "var(--series-growth)",
        },
      ]}
    />
  );
}

/** How long the one-time draw-in takes. Snappier than Recharts' 1.5s default. */
const REVEAL_MS = 900;

export const GrowthChart = memo(function GrowthChart({ data, subtitle }: { data: YearPoint[]; subtitle: string }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [prevView, setPrevView] = useState(view);

  // The reveal plays on mount, and again each time you switch back from the table view, but never
  // while a slider is being dragged — replaying a full draw-in on every intermediate value is what
  // made the page feel laggy (each change restarts the animation, which re-renders the chart
  // repeatedly). Switching to table view unmounts the AreaChart entirely, so returning to chart
  // view mounts a fresh one; `revealing` has to already be true on that first render (Recharts
  // needs isAnimationActive=true from the start to animate), which is why this is set synchronously
  // during render rather than in an effect, which would only flip it a render too late.
  const [revealing, setRevealing] = useState(true);
  if (view !== prevView) {
    setPrevView(view);
    if (view === "chart") setRevealing(true);
  }

  useEffect(() => {
    if (!revealing) return;
    const timer = setTimeout(() => setRevealing(false), REVEAL_MS + 100);
    return () => clearTimeout(timer);
  }, [revealing]);

  return (
    <Card
      title="Portfolio Growth Over Time"
      subtitle={subtitle}
      action={
        <div className="print:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView(view === "chart" ? "table" : "chart")}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            {view === "chart" ? <TableIcon size={14} /> : <LineChartIcon size={14} />}
            {view === "chart" ? "Table" : "Chart"}
          </button>
          <DownloadCsvButton
            filename="portfolio-growth.csv"
            getRows={() =>
              data.map((row) => ({
                age: row.age,
                contributions: row.contributions.toFixed(2),
                growth: row.growth.toFixed(2),
                balance: (row.contributions + row.growth).toFixed(2),
              }))
            }
          />
        </div>
      }
    >
      {view === "chart" ? (
        <div className="h-72 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="contribFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-contrib)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--series-contrib)" stopOpacity={0.22} />
                </linearGradient>
                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-growth)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--series-growth)" stopOpacity={0.22} />
                </linearGradient>
              </defs>
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
                content={<GrowthTooltip />}
                cursor={{ stroke: "var(--baseline)", strokeWidth: 1, strokeDasharray: "3 3" }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={32}
                iconType="line"
                wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
              />
              <Area
                type="monotone"
                dataKey="contributions"
                name="Contributions"
                stackId="1"
                stroke="var(--series-contrib)"
                strokeWidth={2}
                fill="url(#contribFill)"
                isAnimationActive={revealing}
                animationDuration={REVEAL_MS}
              />
              <Area
                type="monotone"
                dataKey="growth"
                name="Investment growth"
                stackId="1"
                stroke="var(--series-growth)"
                strokeWidth={2}
                fill="url(#growthFill)"
                isAnimationActive={revealing}
                animationDuration={REVEAL_MS}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr style={{ color: "var(--text-muted)" }} className="text-xs uppercase">
                <th className="py-2 pr-4 font-medium">Age</th>
                <th className="py-2 pr-4 font-medium">Contributions</th>
                <th className="py-2 pr-4 font-medium">Growth</th>
                <th className="py-2 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.age} style={{ borderTop: "1px solid var(--gridline)" }}>
                  <td className="py-2 pr-4 tabular" style={{ color: "var(--text-primary)" }}>
                    {row.age}
                  </td>
                  <td className="py-2 pr-4 tabular" style={{ color: "var(--text-secondary)" }}>
                    {currencyFormatterPrecise.format(row.contributions)}
                  </td>
                  <td className="py-2 pr-4 tabular" style={{ color: "var(--text-secondary)" }}>
                    {currencyFormatterPrecise.format(row.growth)}
                  </td>
                  <td className="py-2 tabular font-semibold" style={{ color: "var(--text-primary)" }}>
                    {currencyFormatterPrecise.format(row.contributions + row.growth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
});

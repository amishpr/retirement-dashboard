import { memo, useMemo, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisPercent, lineCursor, niceTicks, numberTick } from "../lib/chartTheme";
import { classifyRisk } from "../lib/risk";
import { Card } from "./Card";
import { TooltipCard, type ChartTooltipProps } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";
import { RiskBadge } from "./RiskBadge";
import { Segmented } from "./Segmented";

export interface RiskReturnPoint {
  ticker: string;
  risk: number;
  returnPct: number;
  highlighted: boolean;
}

type PlotPoint = RiskReturnPoint & { riskPct: number; labeled: boolean };

const displayTicker = (t: string) => (t === "MIX" ? "Your mix" : t);

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: PlotPoint;
}

function RiskDot({ cx = 0, cy = 0, payload }: DotProps) {
  if (!payload) return null;
  const { highlighted, labeled, ticker } = payload;
  const r = highlighted ? 6 : 4.5;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={highlighted ? "var(--accent)" : "var(--ink-3)"}
        fillOpacity={highlighted ? 1 : 0.75}
        stroke="var(--panel)"
        strokeWidth={2}
      />
      {labeled && (
        <text
          x={cx + r + 5}
          y={cy + 4}
          fontSize={12}
          fontWeight={highlighted ? 600 : 500}
          fill={highlighted ? "var(--ink)" : "var(--ink-2)"}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {displayTicker(ticker)}
        </text>
      )}
    </g>
  );
}

function RiskReturnTooltip({ active, payload }: ChartTooltipProps<PlotPoint>) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <TooltipCard
      title={displayTicker(point.ticker)}
      subtitle={`${classifyRisk(point.risk)} risk`}
      rows={[
        { key: "return", label: "Average return", value: `${point.returnPct.toFixed(1)}%` },
        { key: "risk", label: "Volatility", value: `${point.riskPct.toFixed(1)}%` },
      ]}
    />
  );
}

/**
 * Where each fund sits on the risk/return tradeoff. Only your fund and the extremes get a label
 * (the popular US funds cluster so tightly their labels would print on top of each other); every
 * dot names itself on hover, and the table view lists all of them with their risk tier.
 */
export const RiskReturnChart = memo(function RiskReturnChart({ points }: { points: RiskReturnPoint[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");

  const data: PlotPoint[] = useMemo(() => {
    if (points.length === 0) return [];
    const extremes = new Set<string>([
      points.reduce((a, b) => (b.returnPct > a.returnPct ? b : a)).ticker,
      points.reduce((a, b) => (b.risk > a.risk ? b : a)).ticker,
      points.reduce((a, b) => (b.risk < a.risk ? b : a)).ticker,
    ]);
    return points.map((p) => ({ ...p, riskPct: p.risk * 100, labeled: p.highlighted || extremes.has(p.ticker) }));
  }, [points]);

  const byRisk = useMemo(() => [...data].sort((a, b) => a.risk - b.risk), [data]);
  const xTicks = niceTicks(Math.max(1, ...data.map((d) => d.riskPct)));
  const yTicks = niceTicks(Math.max(1, ...data.map((d) => d.returnPct)));

  return (
    <Card
      title="Risk vs return"
      subtitle="More volatility doesn't always buy more return."
      action={
        <>
          <Segmented
            size="sm"
            label="Risk vs return view"
            options={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
            value={view}
            onChange={setView}
          />
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
        </>
      }
    >
      {view === "chart" ? (
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 40, left: 0, bottom: 16 }}>
              <CartesianGrid stroke="var(--line)" />
              <XAxis
                type="number"
                dataKey="riskPct"
                ticks={xTicks}
                domain={[0, xTicks[xTicks.length - 1]]}
                tickFormatter={formatAxisPercent}
                tickLine={false}
                axisLine={{ stroke: "var(--line-strong)" }}
                tick={numberTick}
                label={{ value: "Volatility", position: "insideBottom", offset: -12, fill: "var(--ink-3)", fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="returnPct"
                ticks={yTicks}
                domain={[0, yTicks[yTicks.length - 1]]}
                tickFormatter={formatAxisPercent}
                tickLine={false}
                axisLine={false}
                tick={numberTick}
                width={52}
                label={{ value: "Average return", angle: -90, position: "insideLeft", offset: 10, fill: "var(--ink-3)", fontSize: 12 }}
              />
              <Tooltip content={<RiskReturnTooltip />} cursor={lineCursor} />
              <Scatter data={data} shape={<RiskDot />} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-line">
          <table className="w-full text-[13px]">
            <thead className="bg-sunken text-xs text-ink-3">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Fund</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Volatility</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Return</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {byRisk.map((p) => (
                <tr key={p.ticker} className={p.highlighted ? "bg-accent/[0.07]" : undefined}>
                  <td className={`px-3 py-2 font-mono ${p.highlighted ? "font-semibold text-ink" : "text-ink-2"}`}>
                    {displayTicker(p.ticker)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-2 tabular-nums">{p.riskPct.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-mono text-ink-2 tabular-nums">{p.returnPct.toFixed(1)}%</td>
                  <td className="px-3 py-2">
                    <RiskBadge label={classifyRisk(p.risk)} />
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

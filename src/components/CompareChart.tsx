import { memo, useMemo } from "react";
import { finalPoint, type ProjectionInput } from "../lib/projection";
import { Card } from "./Card";
import { DownloadCsvButton } from "./DownloadCsvButton";
import { RankedBars } from "./RankedBars";

export interface CompareFund {
  ticker: string;
  name: string;
  avgReturn: number;
  expenseRatio?: number;
}

function formatBalance(v: number): string {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${Math.round(v / 1e3)}K`;
}

/** Your exact schedule run through each fund's historical average, ranked, with your pick in the
 *  accent color so you can see where it lands. */
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
        .map((fund) => ({
          ...fund,
          balance: finalPoint(input, fund.avgReturn).balance,
          selected: fund.ticker === highlightTicker,
        }))
        .sort((a, b) => b.balance - a.balance),
    [funds, input, highlightTicker],
  );

  return (
    <Card
      title="Compare funds"
      subtitle="Your schedule and timeline, applied to each fund's historical average return."
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
      <RankedBars
        label={`Projected balance at age ${input.targetAge} by fund`}
        labelWidth="8.5rem"
        valueWidth="4.5rem"
        rows={rows.map((r) => ({
          key: r.ticker,
          title: `${r.ticker}: ${r.name}`,
          selected: r.selected,
          value: r.balance,
          display: formatBalance(r.balance),
          label: (
            <span className="flex items-baseline gap-2">
              <span className="font-mono">{r.ticker === "MIX" ? "Your mix" : r.ticker}</span>
              <span className="font-mono text-xs font-normal text-ink-3 tabular-nums">{(r.avgReturn * 100).toFixed(1)}%</span>
            </span>
          ),
        }))}
      />
    </Card>
  );
});

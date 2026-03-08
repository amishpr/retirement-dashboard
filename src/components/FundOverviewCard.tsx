import { memo } from "react";
import type { RiskLabel } from "../data/etfs";
import { Card } from "./Card";
import { RiskBadge } from "./RiskBadge";

export interface FundOverviewData {
  ticker: string;
  name: string;
  description?: string;
  category?: string;
  avgReturn: number;
  expenseRatio?: number;
  riskLabel?: RiskLabel;
  volatility?: number;
  domestic?: number;
  international?: number;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

export const FundOverviewCard = memo(function FundOverviewCard({ data }: { data: FundOverviewData }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {data.ticker}
            </h3>
            {data.category && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: "color-mix(in srgb, var(--series-contrib) 12%, transparent)",
                  color: "var(--series-contrib)",
                }}
              >
                {data.category}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            {data.name}
          </p>
          {data.description && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
              {data.description}
            </p>
          )}
        </div>
        {data.riskLabel && <RiskBadge label={data.riskLabel} className="shrink-0 text-xs" />}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Assumed avg. return" value={`${(data.avgReturn * 100).toFixed(1)}%/yr`} />
        <Stat label="Expense ratio" value={data.expenseRatio !== undefined ? `${(data.expenseRatio * 100).toFixed(2)}%/yr` : "—"} />
        <Stat label="Volatility" value={data.volatility !== undefined ? `${(data.volatility * 100).toFixed(1)}%` : "—"} />
        <Stat
          label="Domestic / international"
          value={
            data.domestic !== undefined && data.international !== undefined
              ? `${(data.domestic * 100).toFixed(0)}% / ${(data.international * 100).toFixed(0)}%`
              : "—"
          }
        />
      </div>
    </Card>
  );
});

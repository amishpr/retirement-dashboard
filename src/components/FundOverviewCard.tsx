import { memo, type ReactNode } from "react";
import type { RiskLabel } from "../data/etfs";
import { formatPrice, type FundPrice } from "../lib/liveData";
import { Card } from "./Card";
import { RiskBadge } from "./RiskBadge";

export interface FundOverviewData {
  ticker: string;
  name: string;
  description?: string;
  category?: string;
  avgReturn: number;
  /** Undefined for a mix, and for a custom ticker until its first quote arrives. */
  price?: FundPrice;
  expenseRatio?: number;
  riskLabel?: RiskLabel;
  volatility?: number;
  domestic?: number;
  international?: number;
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}

const pct = (v: number | undefined, digits: number, suffix = "") =>
  v === undefined ? "n/a" : `${(v * 100).toFixed(digits)}%${suffix}`;

/** The selected fund (or mix) at a glance, including where its money is invested. */
export const FundOverviewCard = memo(function FundOverviewCard({ data }: { data: FundOverviewData }) {
  const isMix = data.ticker === "MIX";
  const hasSplit = data.domestic !== undefined && data.international !== undefined;
  const { price } = data;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-xl font-semibold tracking-[-0.02em] text-ink">{isMix ? "Your mix" : data.ticker}</h2>
            {data.category && (
              <span className="rounded-[6px] bg-sunken px-1.5 py-0.5 text-xs font-medium text-ink-2">{data.category}</span>
            )}
            {!isMix && <span className="text-sm text-ink-2">{data.name}</span>}
          </div>
          {data.description && <p className="mt-1 text-[13px] text-ink-3">{data.description}</p>}
        </div>
        {data.riskLabel && <RiskBadge label={data.riskLabel} className="shrink-0 text-[13px]" />}
      </div>

      {/* The US/international bar takes a row of its own until there's room for it beside the stats. */}
      <dl
        className={`mt-5 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-5 md:gap-x-10 ${
          price ? "sm:grid-cols-4 xl:grid-cols-[auto_auto_auto_auto_minmax(0,1fr)]" : "sm:grid-cols-3 md:grid-cols-[auto_auto_auto_minmax(0,1fr)]"
        }`}
      >
        {price && (
          <Stat
            label={price.source === "live" ? "Live price" : "12-month avg price"}
            value={
              <span title={price.source === "live" ? undefined : "Live price unavailable, showing the average close over the past 12 months"}>
                {formatPrice(price)}
              </span>
            }
          />
        )}
        <Stat label="Assumed return" value={pct(data.avgReturn, 1, "/yr")} />
        <Stat label="Expense ratio" value={pct(data.expenseRatio, 2, "/yr")} />
        <Stat label="Volatility" value={pct(data.volatility, 1)} />
        {hasSplit && (
          <div className={`col-span-2 min-w-0 ${price ? "sm:col-span-4 xl:col-span-1" : "sm:col-span-3 md:col-span-1"}`}>
            <dt className="flex justify-between text-[13px] text-ink-3">
              <span>
                US <span className="font-semibold text-ink tabular-nums">{pct(data.domestic, 0)}</span>
              </span>
              <span>
                International <span className="font-semibold text-ink tabular-nums">{pct(data.international, 0)}</span>
              </span>
            </dt>
            <dd
              role="img"
              aria-label={`${pct(data.domestic, 0)} US, ${pct(data.international, 0)} international`}
              className="mt-2 flex h-2.5 gap-[2px] overflow-hidden rounded-[3px]"
            >
              <span className="bg-ink-2" style={{ width: `${data.domestic! * 100}%` }} />
              <span className="bg-ink-3/45" style={{ width: `${data.international! * 100}%` }} />
            </dd>
          </div>
        )}
      </dl>
    </Card>
  );
});

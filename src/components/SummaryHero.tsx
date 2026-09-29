import { memo } from "react";
import { currencyFormatter, formatCompact, type Dollars } from "../lib/projection";
import { AnimatedNumber } from "./AnimatedNumber";
import { Segmented } from "./Segmented";

const DOLLAR_OPTIONS = [
  { value: "today", label: "Today's dollars" },
  { value: "future", label: "Future dollars" },
] as const;

// Full dollars read best for the headline number; compact only kicks in for absurd inputs, so the
// figure can never outgrow the panel.
const formatHeadline = (v: number) => (Math.abs(v) >= 1e10 ? formatCompact(v) : currencyFormatter.format(v));
const formatMoney = (v: number) => currencyFormatter.format(v);
const formatMultiple = (v: number) => `${v.toFixed(1)}×`;

function Figure({ label, value, formatter }: { label: string; value: number; formatter: (v: number) => string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] text-ink tabular-nums">
        <AnimatedNumber value={value} formatter={formatter} />
      </dd>
    </div>
  );
}

/**
 * The answer, first: projected balance, what it pays in retirement, and how much of it you put in
 * versus what the market added. Replaces the old banner, four stat tiles, breakdown donut, and
 * income card, which repeated these same numbers five different ways.
 *
 * Everything here follows the dollars toggle. Today's dollars (what the money will buy, in today's
 * prices) is the default; the other figure always sits under the headline so neither is hidden.
 */
export const SummaryHero = memo(function SummaryHero({
  dollars,
  onDollarsChange,
  balance,
  futureBalance,
  todayBalance,
  retirementYear,
  realReturn,
  contributed,
  growth,
  multiple,
  annualIncome,
  targetAge,
  years,
  planLabel,
  annualReturn,
  withdrawalRate,
}: {
  dollars: Dollars;
  onDollarsChange: (dollars: Dollars) => void;
  /** The headline, in the dollars being shown. */
  balance: number;
  futureBalance: number;
  todayBalance: number;
  retirementYear: number;
  /** The assumed return after the plan's average inflation. */
  realReturn: number;
  contributed: number;
  growth: number;
  multiple: number;
  annualIncome: number;
  targetAge: number;
  years: number;
  planLabel: string;
  annualReturn: number;
  withdrawalRate: number;
}) {
  // With a gain, the bar splits the balance into what you put in and what the market added. With a
  // loss (a negative assumed return, or in today's dollars a return below inflation), it splits
  // what you put in into what's left and what was lost.
  const today = dollars === "today";
  const loss = growth < 0;
  const growthShare = !loss && balance > 0 ? Math.min(1, growth / balance) : 0;
  const lostShare = loss && contributed > 0 ? Math.min(1, -growth / contributed) : 0;
  const contribShare = 1 - growthShare - lostShare;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const rate = (v: number) => `${(v * 100).toFixed(1)}%`;
  const growthLabel = today ? (loss ? "Inflation takes" : "Growth after inflation") : loss ? "The market takes" : "The market adds";

  return (
    <section aria-labelledby="summary-heading" className="rounded-xl border border-line bg-panel p-5 sm:p-7 print:break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <h2 id="summary-heading" className="pt-1.5 text-[13px] font-medium text-ink-2">
          Projected balance at {targetAge}
          {today ? ", in today's dollars" : `, in ${retirementYear} dollars`}
        </h2>
        <Segmented
          size="sm"
          label="Show amounts in"
          options={DOLLAR_OPTIONS}
          value={dollars}
          onChange={onDollarsChange}
          className="print:hidden"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
        <div className="min-w-0">
          <p className="text-[44px] font-semibold leading-none tracking-[-0.04em] text-ink tabular-nums sm:text-[60px]">
            <AnimatedNumber value={balance} formatter={formatHeadline} />
          </p>
          {years > 0 && (
            <p className="mt-2 text-[15px] text-ink-2 tabular-nums">
              {today
                ? `About ${formatMoney(futureBalance)} in ${retirementYear} dollars`
                : `Worth about ${formatMoney(todayBalance)} in today's dollars`}
            </p>
          )}
          <p className="mt-3 text-sm text-ink-3">
            {years > 0
              ? `${planLabel} at an assumed ${rate(annualReturn)} a year, about ${rate(realReturn)} after inflation. Actual returns will vary.`
              : "Set a target age later than your current age."}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-10 gap-y-1">
          <Figure label="Income a year" value={annualIncome} formatter={formatMoney} />
          <Figure label="A month" value={annualIncome / 12} formatter={formatMoney} />
          <p className="col-span-2 mt-1 text-xs text-ink-3">
            Withdrawing {Math.round(withdrawalRate * 100)}% a year, {today ? "in today's dollars" : `in ${retirementYear} dollars`}
          </p>
        </dl>
      </div>

      <div className="mt-8">
        <div
          role="img"
          aria-label={
            loss
              ? `${growthLabel} ${pct(lostShare)} of the money you put in`
              : `${pct(contribShare)} of the balance is money you put in, ${pct(growthShare)} is ${today ? "growth after inflation" : "market growth"}`
          }
          className="flex h-3 gap-[2px] overflow-hidden rounded-[4px]"
        >
          <div className="bg-contrib" style={{ width: `${contribShare * 100}%` }} />
          {loss ? (
            <div className="bg-[var(--status-critical)]" style={{ width: `${lostShare * 100}%` }} />
          ) : (
            <div className="bg-accent" style={{ width: `${growthShare * 100}%` }} />
          )}
        </div>
        <dl className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2 text-[13px]">
          <div className="flex items-baseline gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 translate-y-px self-center rounded-[3px] bg-contrib" />
            <dt className="text-ink-3">You put in</dt>
            <dd className="font-semibold text-ink tabular-nums">
              <AnimatedNumber value={contributed} formatter={formatMoney} />
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 translate-y-px self-center rounded-[3px] ${loss ? "bg-[var(--status-critical)]" : "bg-accent"}`}
            />
            <dt className="text-ink-3">{growthLabel}</dt>
            <dd className="font-semibold text-ink tabular-nums">
              <AnimatedNumber value={Math.abs(growth)} formatter={formatMoney} />
            </dd>
          </div>
          <div className="flex items-baseline gap-2 sm:ml-auto">
            <dt className="text-ink-3">Every dollar in becomes</dt>
            <dd className="font-semibold text-ink tabular-nums">
              <AnimatedNumber value={multiple} formatter={formatMultiple} />
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
});

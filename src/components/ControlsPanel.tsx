import { ChevronDown, ChevronUp, Minus, Plus, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getAllFunds, DEFAULT_CUSTOM_RETURN, DEFAULT_ETF_TICKER, type CustomTicker } from "../data/etfs";
import type { LiveQuote } from "../lib/liveData";
import { addFundToMix, removeFundFromMix, updateMixWeight, type AllocationEntry } from "../lib/portfolio";
import {
  computeRequiredMonthlyContribution,
  currencyFormatter,
  fromMonthlyContribution,
  SAFE_WITHDRAWAL_RATE,
  type ContributionFrequency,
} from "../lib/projection";
import { Card } from "./Card";

export type { CustomTicker, AllocationEntry };

export interface Controls {
  mode: "single" | "portfolio";
  ticker: string;
  customTickers: CustomTicker[];
  allocations: AllocationEntry[];
  currentAge: number;
  targetAge: number;
  currentAmount: number;
  contributionAmount: number;
  contributionFrequency: ContributionFrequency;
  planningMode: "contribution" | "goal";
  desiredAnnualIncome: number;
}

const FREQUENCIES: { value: ContributionFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const MODES: { value: Controls["mode"]; label: string }[] = [
  { value: "single", label: "Single Fund" },
  { value: "portfolio", label: "Mix Portfolio" },
];

const DEFAULT_VISIBLE_TICKERS = ["VOO", "SPY", "VTI", "VT"];

const PLANNING_MODES: { value: Controls["planningMode"]; label: string }[] = [
  { value: "contribution", label: "By Contribution" },
  { value: "goal", label: "By Goal" },
];

const FREQUENCY_NOUN: Record<ContributionFrequency, string> = {
  weekly: "week",
  biweekly: "2 weeks",
  monthly: "month",
  yearly: "year",
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {label}
        </label>
        {hint && (
          <span className="text-xs font-semibold tabular" style={{ color: "var(--text-primary)" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function normalizeTicker(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z.]/g, "")
    .slice(0, 6);
}

const sliderClass = "w-full accent-[var(--plan-accent)]";

const stepperButtonClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40";

function AgeStepper({
  label,
  value,
  min,
  max,
  onChange,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const [text, setText] = useState(String(value));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(String(value));
  }

  const commitText = () => {
    const num = Number(text);
    if (text.trim() === "" || Number.isNaN(num)) {
      setText(String(value));
      return;
    }
    onChange(Math.max(min, Math.min(max, Math.round(num))));
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDecrement}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className={stepperButtonClass}
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label={label}
          className="no-spinner w-full min-w-0 rounded-lg border bg-transparent px-2 py-1.5 text-center text-sm font-semibold tabular outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <button
          type="button"
          onClick={onIncrement}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
          className={stepperButtonClass}
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function TickerAddForm({
  existingTickers,
  onAdd,
}: {
  existingTickers: string[];
  onAdd: (ticker: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const ticker = normalizeTicker(value);
    if (!ticker) return;
    if (ticker === "MIX") {
      setError("That symbol is reserved — try another");
      return;
    }
    if (existingTickers.includes(ticker)) {
      setError(`${ticker} is already in your list`);
      return;
    }
    onAdd(ticker);
    setValue("");
    setError(null);
  };

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={value}
          placeholder="e.g. AAPL"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm uppercase outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "transparent" }}
        />
        <button
          type="button"
          onClick={submit}
          className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
          style={{ borderColor: "var(--plan-accent)", color: "var(--plan-accent)" }}
        >
          <Plus size={13} />
          Add
        </button>
      </div>
      {error && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      )}
      <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
        Any symbol works — we'll try to pull its real 5-year return; you can always adjust it.
      </p>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="font-semibold tabular" style={{ color: "var(--text-primary)" }}>
        {children}
      </span>
    </div>
  );
}

function FundDetails({ quote }: { quote?: LiveQuote }) {
  const has5yr = quote?.ok && quote.cagr !== undefined;

  if (!has5yr) return null;

  return (
    <div
      className="mt-3 flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-xs"
      style={{ borderColor: "var(--border)" }}
    >
      <DetailRow label="5-Year Real Return">{(quote!.cagr! * 100).toFixed(1)}%/yr</DetailRow>
    </div>
  );
}

export function ControlsPanel({
  controls,
  onChange,
  liveData,
  annualReturn,
  currentAnnualIncomeEstimate,
}: {
  controls: Controls;
  onChange: (next: Controls) => void;
  liveData: Record<string, LiveQuote>;
  annualReturn: number;
  currentAnnualIncomeEstimate: number;
}) {
  const update = <K extends keyof Controls>(key: K, value: Controls[K]) =>
    onChange({ ...controls, [key]: value });

  const [showAllFunds, setShowAllFunds] = useState(false);

  // Goal mode solves backward for the contribution: given a desired retirement income (via the
  // 4% rule), current age/amount, and the assumed return, find the monthly contribution that
  // reaches that target balance exactly — then keep `contributionAmount` in sync so the rest of
  // the app (charts, stat tiles) reflects the goal-based plan without needing to know about it.
  const goalYears = Math.max(0, controls.targetAge - controls.currentAge);
  const goalTargetBalance = controls.desiredAnnualIncome / SAFE_WITHDRAWAL_RATE;
  const requiredMonthly =
    controls.planningMode === "goal"
      ? computeRequiredMonthlyContribution(goalTargetBalance, controls.currentAmount, goalYears, annualReturn)
      : 0;
  const requiredAtFrequency = fromMonthlyContribution(requiredMonthly, controls.contributionFrequency);

  useEffect(() => {
    if (controls.planningMode !== "goal") return;
    const rounded = Math.round(requiredAtFrequency * 100) / 100;
    if (Math.abs(controls.contributionAmount - rounded) > 0.005) {
      update("contributionAmount", rounded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls.planningMode, requiredAtFrequency]);

  const allFunds = getAllFunds(controls.customTickers);
  const selectedFund = allFunds.find((f) => f.ticker === controls.ticker);

  // Custom tickers you've added, and whatever's currently selected, are never hidden behind the
  // "show more" toggle — collapsing the list should never hide the fund you're actually looking at.
  const visibleFunds = showAllFunds
    ? allFunds
    : allFunds.filter(
        (f) => DEFAULT_VISIBLE_TICKERS.includes(f.ticker) || f.category === "Custom" || f.ticker === controls.ticker,
      );
  const hiddenFundCount = allFunds.length - visibleFunds.length;

  const addCustomTicker = (ticker: string) => {
    const nextCustomTickers = [...controls.customTickers, { ticker, avgReturn: DEFAULT_CUSTOM_RETURN }];
    if (controls.mode === "single") {
      onChange({ ...controls, customTickers: nextCustomTickers, ticker });
    } else {
      onChange({
        ...controls,
        customTickers: nextCustomTickers,
        allocations: addFundToMix(controls.allocations, ticker),
      });
    }
  };

  const removeCustomTicker = (ticker: string) => {
    const nextCustomTickers = controls.customTickers.filter((ct) => ct.ticker !== ticker);
    const nextAllocations = removeFundFromMix(controls.allocations, ticker);
    onChange({
      ...controls,
      customTickers: nextCustomTickers,
      allocations: nextAllocations,
      ticker: controls.ticker === ticker ? DEFAULT_ETF_TICKER : controls.ticker,
    });
  };

  const updateCustomReturn = (ticker: string, avgReturn: number) => {
    update(
      "customTickers",
      controls.customTickers.map((ct) => (ct.ticker === ticker ? { ...ct, avgReturn } : ct)),
    );
  };

  const fundsInMix = controls.allocations
    .map((a) => ({ allocation: a, fund: allFunds.find((f) => f.ticker === a.ticker) }))
    .filter((row): row is { allocation: AllocationEntry; fund: (typeof allFunds)[number] } => !!row.fund);
  const fundsNotInMix = allFunds.filter((f) => !controls.allocations.some((a) => a.ticker === f.ticker));
  const totalWeight = controls.allocations.reduce((s, a) => s + a.weight, 0);

  const updateAllocationWeight = (ticker: string, weight: number) => {
    update("allocations", updateMixWeight(controls.allocations, ticker, weight));
  };

  const removeAllocation = (ticker: string) => {
    // A custom ticker is fully forgotten (not just unweighted) so it can be re-added by name
    // without hitting a stale "already in your list" error.
    const isCustom = controls.customTickers.some((ct) => ct.ticker === ticker);
    if (isCustom) {
      removeCustomTicker(ticker);
    } else {
      update("allocations", removeFundFromMix(controls.allocations, ticker));
    }
  };

  return (
    <Card
      variant="highlight"
      accentColor="var(--plan-accent)"
      title={
        <span className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-lg"
            style={{ background: "color-mix(in srgb, var(--plan-accent) 20%, transparent)", color: "var(--plan-accent)" }}
          >
            <SlidersHorizontal size={13} />
          </span>
          Your Plan
        </span>
      }
      subtitle="Adjust any input to see the projection update live"
    >
      <div className="flex flex-col gap-6">
        <div>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            {MODES.map((m) => {
              const active = m.value === controls.mode;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => update("mode", m.value)}
                  className="rounded-lg border py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: active ? "var(--plan-accent)" : "var(--border)",
                    background: active ? "color-mix(in srgb, var(--plan-accent) 14%, transparent)" : "transparent",
                    color: active ? "var(--plan-accent)" : "var(--text-secondary)",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {controls.mode === "single" ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                {visibleFunds.map((etf) => {
                  const active = etf.ticker === controls.ticker;
                  const isCustom = etf.category === "Custom";
                  return (
                    <button
                      key={etf.ticker}
                      type="button"
                      onClick={() => update("ticker", etf.ticker)}
                      className="relative rounded-xl border px-3 py-2 text-left transition-colors"
                      style={{
                        borderColor: active ? "var(--plan-accent)" : "var(--border)",
                        background: active
                          ? "color-mix(in srgb, var(--plan-accent) 14%, transparent)"
                          : "transparent",
                      }}
                    >
                      {isCustom && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCustomTicker(etf.ticker);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                              removeCustomTicker(etf.ticker);
                            }
                          }}
                          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border"
                          style={{ borderColor: "var(--border)", background: "var(--surface-card)", color: "var(--text-muted)" }}
                        >
                          <X size={10} />
                        </span>
                      )}
                      <span
                        className="block whitespace-nowrap text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {etf.ticker}
                      </span>
                      <span className="block whitespace-nowrap text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {isCustom ? "your estimate" : `~${(etf.avgReturn * 100).toFixed(1)}%/yr avg`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {hiddenFundCount > 0 || showAllFunds ? (
                <button
                  type="button"
                  onClick={() => setShowAllFunds((v) => !v)}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-medium transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  {showAllFunds ? (
                    <>
                      <ChevronUp size={13} />
                      Show fewer
                    </>
                  ) : (
                    <>
                      <ChevronDown size={13} />
                      Show {hiddenFundCount} more
                    </>
                  )}
                </button>
              ) : null}

              <div className="mt-2">
                <TickerAddForm
                  existingTickers={allFunds.map((f) => f.ticker)}
                  onAdd={addCustomTicker}
                />
              </div>

              {selectedFund?.category === "Custom" && (
                <div className="mt-3">
                  <Field
                    label={`${selectedFund.ticker} Expected Annual Return`}
                    hint={`${(selectedFund.avgReturn * 100).toFixed(1)}%`}
                  >
                    <input
                      type="range"
                      min={-10}
                      max={50}
                      step={0.5}
                      value={selectedFund.avgReturn * 100}
                      onChange={(e) => updateCustomReturn(selectedFund.ticker, Number(e.target.value) / 100)}
                      className={sliderClass}
                    />
                  </Field>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {liveData[selectedFund.ticker]?.cagr !== undefined
                      ? "Auto-filled from real 5-year performance — drag to override."
                      : "Set manually below, or wait a moment for a live estimate."}
                  </p>
                </div>
              )}

              {selectedFund && <FundDetails quote={liveData[selectedFund.ticker]} />}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {fundsInMix.map(({ allocation, fund }) => (
                  <div key={fund.ticker} className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {fund.ticker}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold tabular" style={{ color: "var(--text-primary)" }}>
                          {allocation.weight.toFixed(0)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAllocation(fund.ticker)}
                          aria-label={`Remove ${fund.ticker} from mix`}
                          className="flex h-5 w-5 items-center justify-center rounded-full"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateAllocationWeight(fund.ticker, allocation.weight - 1)}
                        disabled={fundsInMix.length <= 1 || allocation.weight <= 0}
                        aria-label={`Decrease ${fund.ticker} allocation`}
                        className={stepperButtonClass}
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={allocation.weight}
                        disabled={fundsInMix.length <= 1}
                        onChange={(e) => updateAllocationWeight(fund.ticker, Number(e.target.value))}
                        className={`${sliderClass} disabled:opacity-50`}
                      />
                      <button
                        type="button"
                        onClick={() => updateAllocationWeight(fund.ticker, allocation.weight + 1)}
                        disabled={fundsInMix.length <= 1 || allocation.weight >= 100}
                        aria-label={`Increase ${fund.ticker} allocation`}
                        className={stepperButtonClass}
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {fundsInMix.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Add a couple of funds below to build your mix.
                  </p>
                )}
              </div>

              {fundsInMix.length > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>Total Allocation</span>
                  <span className="font-semibold tabular" style={{ color: "var(--success-text)" }}>
                    {totalWeight.toFixed(0)}%
                  </span>
                </div>
              )}

              {fundsNotInMix.length > 0 && (
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Add A Fund To The Mix
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      const ticker = e.target.value;
                      if (!ticker) return;
                      update("allocations", addFundToMix(controls.allocations, ticker));
                    }}
                    className="w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "transparent" }}
                  >
                    <option value="">Choose a fund…</option>
                    {fundsNotInMix.map((f) => (
                      <option key={f.ticker} value={f.ticker}>
                        {f.ticker} — {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-3">
                <TickerAddForm
                  existingTickers={allFunds.map((f) => f.ticker)}
                  onAdd={addCustomTicker}
                />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <AgeStepper
            label="Current Age"
            value={controls.currentAge}
            min={1}
            max={99}
            onChange={(age) => update("currentAge", Math.min(age, controls.targetAge - 1))}
            onDecrement={() => update("currentAge", Math.max(1, controls.currentAge - 1))}
            onIncrement={() => update("currentAge", Math.min(controls.targetAge - 1, controls.currentAge + 1))}
          />
          <AgeStepper
            label="Target Age"
            value={controls.targetAge}
            min={2}
            max={100}
            onChange={(age) => update("targetAge", Math.max(age, controls.currentAge + 1))}
            onDecrement={() => update("targetAge", Math.max(controls.currentAge + 1, controls.targetAge - 1))}
            onIncrement={() => update("targetAge", Math.min(100, controls.targetAge + 1))}
          />
        </div>

        <Field label="Current Invested Amount">
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: "var(--border)" }}
          >
            <span style={{ color: "var(--text-muted)" }}>$</span>
            <input
              type="number"
              min={0}
              value={controls.currentAmount}
              onChange={(e) => update("currentAmount", Math.max(0, Number(e.target.value)))}
              className="w-full bg-transparent text-sm tabular outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
        </Field>

        <div>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            {PLANNING_MODES.map((m) => {
              const active = m.value === controls.planningMode;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    // Seed the goal input with whatever the current plan is already on track for,
                    // rather than a generic default — only on the transition into goal mode, so it
                    // doesn't clobber a value the user has since edited.
                    if (m.value === "goal" && controls.planningMode !== "goal") {
                      onChange({
                        ...controls,
                        planningMode: "goal",
                        desiredAnnualIncome: Math.round(currentAnnualIncomeEstimate),
                      });
                    } else {
                      update("planningMode", m.value);
                    }
                  }}
                  className="rounded-lg border py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: active ? "var(--plan-accent)" : "var(--border)",
                    background: active ? "color-mix(in srgb, var(--plan-accent) 14%, transparent)" : "transparent",
                    color: active ? "var(--plan-accent)" : "var(--text-secondary)",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {controls.planningMode === "contribution" ? (
            <Field label="Planned Contribution">
              <div
                className="flex items-center gap-2 rounded-xl border px-3 py-2"
                style={{ borderColor: "var(--border)" }}
              >
                <span style={{ color: "var(--text-muted)" }}>$</span>
                <input
                  type="number"
                  min={0}
                  value={controls.contributionAmount}
                  onChange={(e) => update("contributionAmount", Math.max(0, Number(e.target.value)))}
                  className="w-full bg-transparent text-sm tabular outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
            </Field>
          ) : (
            <>
              <Field label="Desired Annual Retirement Income">
                <div
                  className="flex items-center gap-2 rounded-xl border px-3 py-2"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span style={{ color: "var(--text-muted)" }}>$</span>
                  <input
                    type="number"
                    min={0}
                    value={controls.desiredAnnualIncome}
                    onChange={(e) => update("desiredAnnualIncome", Math.max(0, Number(e.target.value)))}
                    className="w-full bg-transparent text-sm tabular outline-none"
                    style={{ color: "var(--text-primary)" }}
                  />
                </div>
              </Field>
              <div className="mt-2 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: "var(--border)" }}>
                {requiredMonthly > 0 ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ color: "var(--text-secondary)" }}>You'll need to contribute</span>
                      <span className="font-semibold tabular" style={{ color: "var(--text-primary)" }}>
                        {currencyFormatter.format(requiredAtFrequency)}/{FREQUENCY_NOUN[controls.contributionFrequency]}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      Using the {(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% rule,{" "}
                      {currencyFormatter.format(controls.desiredAnnualIncome)}/year in retirement needs about{" "}
                      {currencyFormatter.format(goalTargetBalance)} saved by age {controls.targetAge}.
                    </p>
                  </>
                ) : (
                  <p style={{ color: "var(--success-text)" }}>
                    Your current savings alone are already projected to clear this goal by age {controls.targetAge} —
                    no extra contribution needed.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {FREQUENCIES.map((freq) => {
              const active = freq.value === controls.contributionFrequency;
              return (
                <button
                  key={freq.value}
                  type="button"
                  onClick={() => update("contributionFrequency", freq.value)}
                  className="rounded-lg border px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    borderColor: active ? "var(--plan-accent)" : "var(--border)",
                    background: active ? "color-mix(in srgb, var(--plan-accent) 14%, transparent)" : "transparent",
                    color: active ? "var(--plan-accent)" : "var(--text-secondary)",
                  }}
                >
                  {freq.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

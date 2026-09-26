import { CaretDown, CaretUp, CheckCircle, MagnifyingGlass, Minus, Plus, Warning, X } from "@phosphor-icons/react";
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { getAllFunds, DEFAULT_CUSTOM_RETURN, DEFAULT_ETF_TICKER, type CustomTicker, type EtfOption } from "../data/etfs";
import { formatPrice, resolvePrice, type FundPrice, type LiveQuote } from "../lib/liveData";
import { addFundToMix, removeFundFromMix, updateMixWeight, type AllocationEntry } from "../lib/portfolio";
import {
  computeRequiredMonthlyContribution,
  currencyFormatter,
  fromMonthlyContribution,
  SAFE_WITHDRAWAL_RATE,
  type ContributionFrequency,
} from "../lib/projection";
import { fieldLabel, fieldShell, ghostButton, iconButton } from "../lib/ui";
import { Segmented } from "./Segmented";

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

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

const MODES = [
  { value: "single", label: "One fund" },
  { value: "portfolio", label: "A mix of funds" },
] as const;

const PLANNING_MODES = [
  { value: "contribution", label: "By contribution" },
  { value: "goal", label: "By income goal" },
] as const;

const DEFAULT_VISIBLE_TICKERS = ["VOO", "SPY", "VTI", "VT"];
const COLLAPSED_MIX_CHOICES = 4;

const FREQUENCY_PHRASE: Record<ContributionFrequency, string> = {
  weekly: "a week",
  biweekly: "every 2 weeks",
  monthly: "a month",
  yearly: "a year",
};

type Fund = EtfOption;

function normalizeTicker(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z.]/g, "")
    .slice(0, 6);
}

/** A fund's price for a list row. A 12-month average is marked with "~" and explained under the list. */
function PriceText({ price }: { price: FundPrice | undefined }) {
  if (!price) return null;
  const isAverage = price.source === "average";
  return (
    <span
      title={isAverage ? "12-month average price" : "Live price"}
      className={`shrink-0 font-mono text-xs tabular-nums ${isAverage ? "text-ink-3" : "text-ink-2"}`}
    >
      {isAverage && "~"}
      {formatPrice(price)}
    </span>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

/** A dollar amount that reads "10,000" at rest and becomes a plain number while you edit it. */
function MoneyInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value.toLocaleString("en-US", { maximumFractionDigits: 2 });

  return (
    <div className={fieldShell}>
      <span aria-hidden="true" className="text-sm text-ink-3">
        $
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        onFocus={(e) => {
          setDraft(String(value));
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, "");
          setDraft(raw);
          const num = Number(raw);
          if (raw !== "" && !Number.isNaN(num)) onChange(Math.max(0, num));
        }}
        onBlur={() => {
          if (draft === "") onChange(0);
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink tabular-nums outline-none"
      />
    </div>
  );
}

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
  const id = useId();
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

  const stepButton = "flex h-full w-9 shrink-0 items-center justify-center text-ink-2 hover:bg-ink/[0.05] hover:text-ink disabled:opacity-35";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <div className="flex h-10 items-stretch overflow-hidden rounded-lg border border-line-strong bg-panel focus-within:border-focus focus-within:ring-3 focus-within:ring-focus/20">
        <button
          type="button"
          onClick={onDecrement}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className={stepButton}
        >
          <Minus size={14} />
        </button>
        <input
          id={id}
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
          className="no-spinner w-full min-w-0 bg-transparent text-center text-sm font-semibold text-ink tabular-nums outline-none"
        />
        <button
          type="button"
          onClick={onIncrement}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
          className={stepButton}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * One field that both finds a preset fund and adds any other ticker. Typing filters the list; if
 * nothing matches, the list offers to add what you typed. Replaces the old preset tiles, "show
 * more" toggle, fund dropdown, and separate add-ticker form.
 */
function FundPicker({
  mode,
  funds,
  selectedTicker,
  allTickers,
  priceOf,
  onPick,
  onAdd,
  onRemoveCustom,
}: {
  mode: Controls["mode"];
  /** Single mode: every fund. Mix mode: only funds not already in the mix. */
  funds: Fund[];
  selectedTicker?: string;
  allTickers: string[];
  priceOf: (fund: Fund) => FundPrice | undefined;
  onPick: (ticker: string) => void;
  onAdd: (ticker: string) => void;
  onRemoveCustom: (ticker: string) => void;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typed = normalizeTicker(query);
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const matches = searching
    ? funds.filter((f) => f.ticker.toLowerCase().includes(q) || f.name.toLowerCase().includes(q))
    : funds;

  const defaultFunds =
    mode === "single"
      ? funds.filter(
          (f) => DEFAULT_VISIBLE_TICKERS.includes(f.ticker) || f.category === "Custom" || f.ticker === selectedTicker,
        )
      : funds.slice(0, COLLAPSED_MIX_CHOICES);
  const visible = searching || expanded ? matches : defaultFunds;
  const hiddenCount = searching ? 0 : funds.length - defaultFunds.length;
  const canAdd = typed.length > 0 && !allTickers.includes(typed);
  const showsAverage = visible.some((f) => priceOf(f)?.source === "average");

  const reset = () => {
    setQuery("");
    setError(null);
  };

  const add = (ticker: string) => {
    if (ticker === "MIX") {
      setError("MIX is reserved for your blended portfolio. Try another symbol.");
      return;
    }
    onAdd(ticker);
    reset();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      reset();
      return;
    }
    if (event.key !== "Enter" || !typed) return;
    event.preventDefault();
    const exact = funds.find((f) => f.ticker === typed);
    if (exact) {
      onPick(exact.ticker);
      reset();
    } else if (allTickers.includes(typed)) {
      setError(`${typed} is already in your mix.`);
    } else if (matches.length === 1) {
      onPick(matches[0].ticker);
      reset();
    } else {
      add(typed);
    }
  };

  const rowBase = "flex min-h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-ink/[0.05]";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className={fieldLabel}>
          {mode === "single" ? "Search or add any ticker" : "Add a fund"}
        </label>
        <div className={fieldShell}>
          <MagnifyingGlass aria-hidden="true" size={16} className="shrink-0 text-ink-3" />
          <input
            id={inputId}
            type="text"
            value={query}
            placeholder="e.g. VOO or AAPL"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            onKeyDown={onKeyDown}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          />
          {query && (
            <button type="button" onClick={reset} aria-label="Clear search" className="-mr-1.5 text-ink-3 hover:text-ink">
              <X size={14} />
            </button>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="flex items-start gap-1.5 text-xs text-ink-2">
            <Warning size={14} weight="fill" className="mt-px shrink-0 text-[var(--status-critical)]" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>

      <ul
        role={mode === "single" ? "radiogroup" : undefined}
        aria-label={mode === "single" ? "Fund" : "Funds you can add"}
        className="-mx-2 flex flex-col"
      >
        {visible.map((fund) => {
          const isCustom = fund.category === "Custom";
          const selected = mode === "single" && fund.ticker === selectedTicker;
          const content = (
            <>
              {mode === "single" ? (
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-accent" : "border-line-strong"
                  }`}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
                </span>
              ) : (
                <Plus aria-hidden="true" size={14} className="shrink-0 text-ink-3" />
              )}
              {/* Two lines, like a watchlist: ticker and price, then the name and the assumed return. */}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className={`font-mono text-[13px] text-ink ${selected ? "font-semibold" : "font-medium"}`}>{fund.ticker}</span>
                  <PriceText price={priceOf(fund)} />
                </span>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-xs text-ink-3">{isCustom ? "Your estimate" : fund.name}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-3 tabular-nums" title="Assumed return per year">
                    {(fund.avgReturn * 100).toFixed(1)}%/yr
                  </span>
                </span>
              </span>
            </>
          );
          return (
            <li key={fund.ticker} className="flex items-center gap-0.5">
              {mode === "single" ? (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onPick(fund.ticker)}
                  className={`${rowBase} ${selected ? "bg-accent/[0.08] hover:bg-accent/[0.12]" : ""}`}
                >
                  {content}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onPick(fund.ticker);
                    reset();
                  }}
                  aria-label={`Add ${fund.ticker} to the mix`}
                  className={rowBase}
                >
                  {content}
                </button>
              )}
              {isCustom && mode === "single" && (
                <button
                  type="button"
                  onClick={() => onRemoveCustom(fund.ticker)}
                  aria-label={`Remove ${fund.ticker}`}
                  title={`Remove ${fund.ticker}`}
                  className={`${iconButton} h-7 w-7`}
                >
                  <X size={13} />
                </button>
              )}
            </li>
          );
        })}

        {canAdd && (
          <li>
            <button type="button" onClick={() => add(typed)} className={`${rowBase} w-full`}>
              <Plus aria-hidden="true" size={14} className="shrink-0 text-accent" />
              <span className="text-[13px] text-ink">
                Add <span className="font-mono font-semibold">{typed}</span>
              </span>
              <span className="ml-auto truncate text-xs text-ink-3">looks up its 5-year return</span>
            </button>
          </li>
        )}

        {searching && visible.length === 0 && !canAdd && (
          <li className="px-2 py-2 text-[13px] text-ink-3">No matching funds.</li>
        )}
      </ul>

      {showsAverage && (
        <p className="text-xs text-ink-3">~ is the 12-month average price, shown where a live price isn't available.</p>
      )}

      {hiddenCount > 0 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className={`${ghostButton} -ml-2 self-start`}>
          {expanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
          {expanded ? "Show fewer" : `Show ${hiddenCount} more`}
        </button>
      )}
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
  const ids = {
    currentAmount: useId(),
    contribution: useId(),
    income: useId(),
    customReturn: useId(),
  };

  const update = <K extends keyof Controls>(key: K, value: Controls[K]) =>
    onChange({ ...controls, [key]: value });

  // Goal mode solves backward for the contribution: given a desired retirement income (via the
  // 4% rule), current age/amount, and the assumed return, find the monthly contribution that
  // reaches that target balance exactly — then keep `contributionAmount` in sync so the rest of
  // the app (charts, summary) reflects the goal-based plan without needing to know about it.
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
  const allTickers = allFunds.map((f) => f.ticker);
  const selectedFund = allFunds.find((f) => f.ticker === controls.ticker);

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
    .filter((row): row is { allocation: AllocationEntry; fund: Fund } => !!row.fund);
  const fundsNotInMix = allFunds.filter((f) => !controls.allocations.some((a) => a.ticker === f.ticker));
  const totalWeight = controls.allocations.reduce((s, a) => s + a.weight, 0);

  const updateAllocationWeight = (ticker: string, weight: number) => {
    update("allocations", updateMixWeight(controls.allocations, ticker, weight));
  };

  const removeAllocation = (ticker: string) => {
    // A custom ticker is fully forgotten (not just unweighted) so it can be re-added by name
    // without hitting a stale "already in your mix" error.
    const isCustom = controls.customTickers.some((ct) => ct.ticker === ticker);
    if (isCustom) {
      removeCustomTicker(ticker);
    } else {
      update("allocations", removeFundFromMix(controls.allocations, ticker));
    }
  };

  const setPlanningMode = (mode: Controls["planningMode"]) => {
    // Seed the goal input with whatever the current plan is already on track for, rather than a
    // generic default — only on the transition into goal mode, so it doesn't clobber a value the
    // user has since edited.
    if (mode === "goal" && controls.planningMode !== "goal") {
      onChange({ ...controls, planningMode: "goal", desiredAnnualIncome: Math.round(currentAnnualIncomeEstimate) });
    } else {
      update("planningMode", mode);
    }
  };

  const liveCagr = selectedFund ? liveData[selectedFund.ticker]?.cagr : undefined;
  const priceOf = (fund: Fund) => resolvePrice(liveData[fund.ticker], fund.avgPrice);
  const stepButton = `${iconButton} h-7 w-7 border border-line-strong`;

  return (
    // Lighter than the result cards so the one part of the page you can edit stands out as such.
    <div className="rounded-xl border border-line bg-raised">
      <div className="px-5 pt-5">
        <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">Your plan</h2>
      </div>

      <div className="divide-y divide-line">
        <Group title="Fund">
          <Segmented label="Invest in" options={MODES} value={controls.mode} onChange={(mode) => update("mode", mode)} />

          {controls.mode === "single" ? (
            <>
              <FundPicker
                mode="single"
                funds={allFunds}
                selectedTicker={controls.ticker}
                allTickers={allTickers}
                priceOf={priceOf}
                onPick={(ticker) => update("ticker", ticker)}
                onAdd={addCustomTicker}
                onRemoveCustom={removeCustomTicker}
              />

              {selectedFund?.category === "Custom" && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <label htmlFor={ids.customReturn} className={fieldLabel}>
                      {selectedFund.ticker} expected return
                    </label>
                    <span className="font-mono text-[13px] font-medium text-ink tabular-nums">
                      {(selectedFund.avgReturn * 100).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    id={ids.customReturn}
                    type="range"
                    min={-10}
                    max={50}
                    step={0.5}
                    value={selectedFund.avgReturn * 100}
                    onChange={(e) => updateCustomReturn(selectedFund.ticker, Number(e.target.value) / 100)}
                    className="w-full"
                  />
                  <p className="text-xs text-ink-3">
                    {liveCagr !== undefined
                      ? "Filled in from its real 5-year performance. Drag to override."
                      : "Set it here, or wait a moment for a live estimate."}
                  </p>
                </div>
              )}

              {liveCagr !== undefined && (
                <p className="flex items-baseline justify-between text-[13px] text-ink-3">
                  Actual 5-year return
                  <span className="font-mono font-medium text-ink tabular-nums">{(liveCagr * 100).toFixed(1)}%/yr</span>
                </p>
              )}
            </>
          ) : (
            <>
              {fundsInMix.length > 0 ? (
                <div>
                  <ul className="divide-y divide-line">
                    {fundsInMix.map(({ allocation, fund }) => (
                      <li key={fund.ticker} className="py-3 first:pt-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-baseline gap-2">
                            <span className="font-mono text-[13px] font-semibold text-ink">{fund.ticker}</span>
                            <PriceText price={priceOf(fund)} />
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[13px] font-medium text-ink tabular-nums">
                              {allocation.weight.toFixed(0)}%
                            </span>
                            <button
                              type="button"
                              onClick={() => removeAllocation(fund.ticker)}
                              aria-label={`Remove ${fund.ticker} from the mix`}
                              className={`${iconButton} h-7 w-7`}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateAllocationWeight(fund.ticker, allocation.weight - 1)}
                            disabled={fundsInMix.length <= 1 || allocation.weight <= 0}
                            aria-label={`Decrease ${fund.ticker} share`}
                            className={stepButton}
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={allocation.weight}
                            disabled={fundsInMix.length <= 1}
                            aria-label={`${fund.ticker} share of the mix`}
                            onChange={(e) => updateAllocationWeight(fund.ticker, Number(e.target.value))}
                            className="w-full disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={() => updateAllocationWeight(fund.ticker, allocation.weight + 1)}
                            disabled={fundsInMix.length <= 1 || allocation.weight >= 100}
                            aria-label={`Increase ${fund.ticker} share`}
                            className={stepButton}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 flex items-center justify-between border-t border-line pt-3 text-[13px] text-ink-3">
                    Total
                    <span className="flex items-center gap-1.5 font-mono font-medium text-ink tabular-nums">
                      {Math.round(totalWeight) !== 100 && (
                        <Warning size={14} weight="fill" className="text-[var(--status-warning)]" aria-label="Doesn't add up to 100%" />
                      )}
                      {totalWeight.toFixed(0)}%
                    </span>
                  </p>
                </div>
              ) : (
                <p className="text-[13px] text-ink-3">Add a couple of funds below to build your mix.</p>
              )}

              <FundPicker
                mode="portfolio"
                funds={fundsNotInMix}
                allTickers={allTickers}
                priceOf={priceOf}
                onPick={(ticker) => update("allocations", addFundToMix(controls.allocations, ticker))}
                onAdd={addCustomTicker}
                onRemoveCustom={removeCustomTicker}
              />
            </>
          )}
        </Group>

        <Group title="Timeline">
          <div className="grid grid-cols-2 gap-3">
            <AgeStepper
              label="Current age"
              value={controls.currentAge}
              min={1}
              max={99}
              onChange={(age) => update("currentAge", Math.min(age, controls.targetAge - 1))}
              onDecrement={() => update("currentAge", Math.max(1, controls.currentAge - 1))}
              onIncrement={() => update("currentAge", Math.min(controls.targetAge - 1, controls.currentAge + 1))}
            />
            <AgeStepper
              label="Retire at"
              value={controls.targetAge}
              min={2}
              max={100}
              onChange={(age) => update("targetAge", Math.max(age, controls.currentAge + 1))}
              onDecrement={() => update("targetAge", Math.max(controls.currentAge + 1, controls.targetAge - 1))}
              onIncrement={() => update("targetAge", Math.min(100, controls.targetAge + 1))}
            />
          </div>
        </Group>

        <Group title="Money in">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.currentAmount} className={fieldLabel}>
              Invested today
            </label>
            <MoneyInput id={ids.currentAmount} value={controls.currentAmount} onChange={(v) => update("currentAmount", v)} />
          </div>

          <Segmented label="Plan by" options={PLANNING_MODES} value={controls.planningMode} onChange={setPlanningMode} />

          {controls.planningMode === "contribution" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.contribution} className={fieldLabel}>
                You'll add
              </label>
              <MoneyInput
                id={ids.contribution}
                value={controls.contributionAmount}
                onChange={(v) => update("contributionAmount", v)}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.income} className={fieldLabel}>
                Retirement income you want, per year
              </label>
              <MoneyInput
                id={ids.income}
                value={controls.desiredAnnualIncome}
                onChange={(v) => update("desiredAnnualIncome", v)}
              />
            </div>
          )}

          <Segmented
            size="sm"
            label="How often you contribute"
            options={FREQUENCIES}
            value={controls.contributionFrequency}
            onChange={(freq) => update("contributionFrequency", freq)}
          />

          {controls.planningMode === "goal" && (
            <div className="rounded-lg bg-sunken px-3.5 py-3" aria-live="polite">
              {requiredMonthly > 0 ? (
                <>
                  <p className="text-[13px] text-ink-3">You'll need to put in</p>
                  <p className="mt-0.5 text-ink">
                    <span className="text-lg font-semibold tracking-[-0.02em] tabular-nums">
                      {currencyFormatter.format(requiredAtFrequency)}
                    </span>{" "}
                    <span className="text-[13px] text-ink-2">{FREQUENCY_PHRASE[controls.contributionFrequency]}</span>
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-ink-3">
                    At a {(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% withdrawal rate,{" "}
                    {currencyFormatter.format(controls.desiredAnnualIncome)} a year takes about{" "}
                    {currencyFormatter.format(goalTargetBalance)} saved by {controls.targetAge}.
                  </p>
                </>
              ) : (
                <p className="flex items-start gap-2 text-[13px] text-ink">
                  <CheckCircle size={16} weight="fill" className="mt-px shrink-0 text-[var(--status-good)]" aria-hidden="true" />
                  Your current savings are already on track for this goal by {controls.targetAge}. No extra contributions
                  needed.
                </p>
              )}
            </div>
          )}
        </Group>
      </div>
    </div>
  );
}

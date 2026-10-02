import { CheckCircle, MagnifyingGlass, Minus, Plus, Warning, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { getAllFunds, DEFAULT_CUSTOM_RETURN, DEFAULT_ETF_TICKER, type CustomTicker, type EtfOption } from "../data/etfs";
import { CORE_TICKERS } from "../lib/coreQuotes";
import { buildInflationPath, formatCpiMonth, type InflationData, type InflationMode } from "../lib/inflation";
import { formatPrice, resolvePrice, type FundPrice, type LiveQuote, type LiveStatus } from "../lib/liveData";
import { addFundToMix, removeFundFromMix, updateMixWeight, type AllocationEntry } from "../lib/portfolio";
import {
  computeRequiredMonthlyContribution,
  currencyFormatter,
  DOLLAR_OPTIONS,
  fromMonthlyContribution,
  incomeGoal,
  SAFE_WITHDRAWAL_RATE,
  type ContributionFrequency,
  type Dollars,
} from "../lib/projection";
import { fieldLabel, fieldShell, iconButton } from "../lib/ui";
import { DataSource } from "./DataSource";
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
  /** In the dollars `goalDollars` names. */
  desiredAnnualIncome: number;
  /** Whether the income goal is counted in today's dollars or the retirement year's. */
  goalDollars: Dollars;
  inflationMode: InflationMode;
  /** The flat yearly rate for the custom inflation mode, as a decimal. */
  customInflation: number;
  raiseContributions: boolean;
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

/** The fund list's sections, in order. Funds keep their order from etfs.ts within each one. */
const CATEGORY_SECTIONS: [EtfOption["category"], string][] = [
  ["US Broad Market", "US market"],
  ["Global", "Global"],
  ["Growth / Tech", "Growth and tech"],
  ["Dividend", "Dividend"],
  ["Bonds", "Bonds"],
  ["Low Volatility", "Lower volatility"],
  ["Custom", "Your tickers"],
];

const INFLATION_MODES = [
  { value: "forecast", label: "Forecast" },
  { value: "history", label: "History" },
  { value: "custom", label: "Custom" },
] as const;

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

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

/** A fund's price for a list row. A 12-month average is marked with "~" and explained under the list.
 *  While the fund's first quote is on its way, a quiet bar holds the spot instead of an average that
 *  would be swapped out a moment later. */
function PriceText({ price, pending = false }: { price: FundPrice | undefined; pending?: boolean }) {
  if (pending) {
    return <span aria-hidden="true" className="h-2.5 w-12 shrink-0 self-center rounded-sm bg-ink/[0.08] motion-safe:animate-pulse" />;
  }
  if (!price) return null;
  const isAverage = price.source === "average";
  return (
    <span
      title={isAverage ? "12-month average price" : "Live price"}
      className={`shrink-0 text-xs tabular-nums ${isAverage ? "text-ink-3" : "text-ink-2"}`}
    >
      {isAverage && "~"}
      {formatPrice(price)}
    </span>
  );
}

function Group({
  title,
  detail,
  children,
  className = "",
}: {
  title: string;
  /** A short readout on the right of the title row. */
  detail?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 px-5 py-3.5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {detail}
      </div>
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
 * nothing matches, the list offers to add what you typed. Replaces the old preset tiles, fund
 * dropdown, and separate add-ticker form.
 *
 * The list starts with the five core funds, plus the selected fund and your own tickers, and
 * "Show more" opens every fund under category headings. A search always covers every fund.
 */
function FundPicker({
  mode,
  funds,
  selectedTicker,
  allTickers,
  priceOf,
  isPending,
  expanded,
  onExpandedChange,
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
  /** Whether the fund's first live quote is still on its way. */
  isPending: (fund: Fund) => boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onPick: (ticker: string) => void;
  onAdd: (ticker: string) => void;
  onRemoveCustom: (ticker: string) => void;
}) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const typed = normalizeTicker(query);
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const matches = funds.filter((f) => f.ticker.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
  const canAdd = typed.length > 0 && !allTickers.includes(typed);

  // Collapsed: the core five in their own order, then the selected fund if it's another one, then
  // your own tickers, so nothing you've chosen is ever hidden.
  const shortList = [
    ...CORE_TICKERS.flatMap((ticker) => funds.filter((f) => f.ticker === ticker)),
    ...funds.filter((f) => !CORE_TICKERS.includes(f.ticker) && (f.ticker === selectedTicker || f.category === "Custom")),
  ];
  const hiddenCount = funds.length - shortList.length;
  const showToggle = !searching && (expanded || hiddenCount > 0);

  // A search shows a flat list of matches. Otherwise it's the short list, or every fund under
  // category headings once the list is open.
  const sections = searching
    ? [{ key: "matches", label: undefined, funds: matches }]
    : expanded
      ? CATEGORY_SECTIONS.map(([category, label]) => ({
          key: category,
          label,
          funds: funds.filter((f) => f.category === category),
        })).filter((section) => section.funds.length > 0)
      : [{ key: "short", label: undefined, funds: shortList }];
  const shown = sections.flatMap((section) => section.funds);
  const showsAverage = shown.some((f) => !isPending(f) && priceOf(f)?.source === "average");

  // Bring the selected fund into view inside the list, never by scrolling the page: the list
  // scrolls on its own, and scrollIntoView would move the whole window to reach it. Opening the
  // full list does the same, since the selected fund may sit far down it.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!list || !row) return;
    const stickyHeading = 28;
    const top = row.offsetTop - stickyHeading;
    const bottom = row.offsetTop + row.offsetHeight;
    if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = Math.max(0, top);
    }
  }, [selectedTicker, expanded]);

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

  const rowBase = "flex min-h-9 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-ink/[0.05]";

  const renderFund = (fund: Fund) => {
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
            <span className={`text-[13px] text-ink ${selected ? "font-semibold" : "font-medium"}`}>{fund.ticker}</span>
            <PriceText price={priceOf(fund)} pending={isPending(fund)} />
          </span>
          <span className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-xs text-ink-3">{isCustom ? "Your estimate" : fund.name}</span>
            <span className="shrink-0 text-xs text-ink-3 tabular-nums" title="Assumed return per year">
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
  };

  return (
    // On tall desktop screens, the open list fills the Fund group and takes whatever height is left,
    // so the list scrolls and the rest of the plan panel stays put. The flex basis is 0px, not
    // flex-1's 0%: a percentage of a height that isn't known yet counts as the full content height,
    // and the list would never shrink. The short list, and every list on other screens, is only as
    // tall as its rows, up to about six of them.
    <div className={`flex flex-col gap-2 ${expanded ? "tall:flex-[1_1_0px]" : ""}`}>
      <div className="flex flex-col gap-1.5">
        {/* The magnifier and placeholder make this read as a search box, so its label is for screen
            readers only, which saves a row in a panel that has to fit the window. */}
        <label htmlFor={inputId} className="sr-only">
          {mode === "single" ? "Search or add any ticker" : "Add a fund"}
        </label>
        <div className={fieldShell}>
          <MagnifyingGlass aria-hidden="true" size={16} className="shrink-0 text-ink-3" />
          <input
            id={inputId}
            type="text"
            value={query}
            placeholder={mode === "single" ? "Search or add a ticker, e.g. AAPL" : "Add a fund, e.g. VOO"}
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

      {/* The toggle is a footer inside the list's border rather than the last row, so it stays in
          reach wherever the list is scrolled to. The open list keeps at least about four rows
          above it; if even that can't fit, the plan panel's groups scroll together instead. */}
      <div
        className={`flex flex-col overflow-hidden rounded-lg border border-line ${
          expanded ? "tall:min-h-[13.25rem] tall:flex-[1_1_0px]" : ""
        }`}
      >
        <div
          ref={listRef}
          id={listId}
          className={`relative max-h-80 overflow-y-auto overscroll-contain ${
            expanded ? "tall:max-h-none tall:min-h-0 tall:flex-[1_1_0px]" : ""
          }`}
        >
          <ul
            role={mode === "single" ? "radiogroup" : undefined}
            aria-label={mode === "single" ? "Fund" : "Funds you can add"}
            className="flex flex-col px-1 pb-1"
          >
            {sections.map((section) => (
              <li key={section.key} role="presentation">
                {section.label && (
                  <p className="sticky top-0 z-[1] bg-raised px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                    {section.label}
                  </p>
                )}
                <ul role="presentation" className={`flex flex-col ${section.label ? "" : "pt-1"}`}>
                  {section.funds.map(renderFund)}
                </ul>
              </li>
            ))}

            {canAdd && (
              <li className={sections[0]?.funds.length ? "" : "pt-1"}>
                <button type="button" onClick={() => add(typed)} className={`${rowBase} w-full`}>
                  <Plus aria-hidden="true" size={14} className="shrink-0 text-accent" />
                  <span className="text-[13px] text-ink">
                    Add <span className="font-semibold">{typed}</span>
                  </span>
                  <span className="ml-auto truncate text-xs text-ink-3">looks up its 5-year return</span>
                </button>
              </li>
            )}

            {searching && matches.length === 0 && !canAdd && (
              <li className="px-2 py-2 text-[13px] text-ink-3">No matching funds.</li>
            )}

            {!searching && !expanded && shortList.length === 0 && (
              <li className="px-2 pb-1 pt-2 text-[13px] text-ink-3">{CORE_TICKERS.join(", ")} are all in your mix.</li>
            )}
          </ul>
        </div>

        {showToggle && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => onExpandedChange(!expanded)}
            className="flex h-10 w-full shrink-0 items-center justify-center gap-1.5 border-t border-line lg:h-9 text-[13px] font-medium text-ink-2 hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-offset-[-2px]"
          >
            {expanded ? "Show fewer" : "Show more"}
            {expanded ? <Minus aria-hidden="true" size={13} weight="bold" /> : <Plus aria-hidden="true" size={13} weight="bold" />}
          </button>
        )}
      </div>

      {showsAverage && (
        <p className="text-xs text-ink-3">~ is the 12-month average price, shown where a live price isn't available.</p>
      )}
    </div>
  );
}

export function ControlsPanel({
  controls,
  onChange,
  liveData,
  liveStatus,
  livePending,
  onShowAllFunds,
  inflationData,
  inflationLive,
  startYear,
  annualReturn,
  onTrackIncome,
}: {
  controls: Controls;
  onChange: (next: Controls) => void;
  liveData: Record<string, LiveQuote>;
  liveStatus: LiveStatus;
  /** Symbols whose first live quote is still on its way. */
  livePending: ReadonlySet<string>;
  /** Called when the full fund list opens, so the other funds' prices can be fetched right away. */
  onShowAllFunds: () => void;
  inflationData: InflationData;
  /** Whether `inflationData` is fresh from FRED or the built-in copy. */
  inflationLive: boolean;
  startYear: number;
  annualReturn: number;
  /** What the current plan pays per year in retirement, in each kind of dollars. */
  onTrackIncome: Record<Dollars, number>;
}) {
  const ids = {
    currentAmount: useId(),
    contribution: useId(),
    income: useId(),
    customReturn: useId(),
    customInflation: useId(),
    raise: useId(),
  };

  const update = <K extends keyof Controls>(key: K, value: Controls[K]) =>
    onChange({ ...controls, [key]: value });

  // Computed here from the immediate controls, not the deferred copy App renders charts from, so
  // the goal math below never runs on a different timeline than the one on screen.
  const goalYears = Math.max(0, controls.targetAge - controls.currentAge);
  const inflationPath = buildInflationPath(
    { mode: controls.inflationMode, customRate: controls.customInflation },
    inflationData,
    goalYears,
    startYear,
  );
  const retirementPrices = inflationPath.years[inflationPath.years.length - 1]?.priceIndex ?? 1;

  // Goal mode solves backward for the contribution. The income you want is in today's dollars or
  // the retirement year's, so it's first put in the retirement year's prices, turned into a balance
  // with the 4% rule, and then the same simulation the charts use finds the contribution that
  // reaches it. `contributionAmount` stays in sync, so the rest of the app reflects the goal-based
  // plan without knowing about it.
  const retirementYear = startYear + goalYears;
  const goal = incomeGoal(controls.desiredAnnualIncome, controls.goalDollars, retirementPrices);
  const requiredMonthly =
    controls.planningMode === "goal"
      ? computeRequiredMonthlyContribution(goal.targetBalance, {
          currentAge: controls.currentAge,
          targetAge: controls.targetAge,
          currentAmount: controls.currentAmount,
          annualReturn,
          inflation: inflationPath.years.map((y) => y.rate),
          raiseContributions: controls.raiseContributions,
          startYear,
        })
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
    // Seed the goal input with whatever the current plan is already on track for, in the goal's
    // dollars, rather than a generic default. Only on the way into goal mode, so it doesn't clobber
    // a value the user has since edited.
    if (mode === "goal" && controls.planningMode !== "goal") {
      onChange({ ...controls, planningMode: "goal", desiredAnnualIncome: Math.round(onTrackIncome[controls.goalDollars]) });
    } else {
      update("planningMode", mode);
    }
  };

  // One-fund and mix mode share whether the full list is open.
  const [showAllFunds, setShowAllFunds] = useState(false);
  const setFundListExpanded = (expanded: boolean) => {
    setShowAllFunds(expanded);
    if (expanded) onShowAllFunds();
  };

  const liveCagr = selectedFund ? liveData[selectedFund.ticker]?.cagr : undefined;
  const priceOf = (fund: Fund) => resolvePrice(liveData[fund.ticker], fund.avgPrice);
  const isPending = (fund: Fund) => livePending.has(fund.ticker) && !liveData[fund.ticker];
  const stepButton = `${iconButton} h-7 w-7 border border-line-strong`;

  return (
    // Lighter than the result cards so the one part of the page you can edit stands out as such.
    // On tall screens the panel is never taller than the window (App sizes the aside). With the full
    // fund list open it's exactly that tall and only the list scrolls; with the short list it ends
    // under its content. If the rest still can't fit, the groups scroll together as a last resort.
    <div
      className={`rounded-xl border border-line bg-raised tall:flex tall:flex-col ${
        showAllFunds ? "tall:h-full" : "tall:max-h-full"
      }`}
    >
      <div className="px-5 pt-4">
        <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">Your plan</h2>
      </div>

      <div className="divide-y divide-line tall:flex tall:min-h-0 tall:flex-1 tall:flex-col tall:overflow-y-auto">
        <Group
          title="Fund"
          className={showAllFunds ? "tall:flex-[1_1_0px]" : undefined}
          detail={<Segmented size="sm" label="Invest in" options={MODES} value={controls.mode} onChange={(mode) => update("mode", mode)} />}
        >
          {controls.mode === "single" ? (
            <>
              <FundPicker
                mode="single"
                funds={allFunds}
                selectedTicker={controls.ticker}
                allTickers={allTickers}
                priceOf={priceOf}
                isPending={isPending}
                expanded={showAllFunds}
                onExpandedChange={setFundListExpanded}
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
                    <span className="text-[13px] font-medium text-ink tabular-nums">
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
                            <span className="text-[13px] font-semibold text-ink">{fund.ticker}</span>
                            <PriceText price={priceOf(fund)} pending={isPending(fund)} />
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[13px] font-medium text-ink tabular-nums">
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
                    <span className="flex items-center gap-1.5 font-medium text-ink tabular-nums">
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
                isPending={isPending}
                expanded={showAllFunds}
                onExpandedChange={setFundListExpanded}
                onPick={(ticker) => update("allocations", addFundToMix(controls.allocations, ticker))}
                onAdd={addCustomTicker}
                onRemoveCustom={removeCustomTicker}
              />
            </>
          )}

          <DataSource status={liveStatus} />
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
          <Segmented label="Plan by" options={PLANNING_MODES} value={controls.planningMode} onChange={setPlanningMode} />

          {/* Side by side, so the panel fits a desktop window without scrolling. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={ids.currentAmount} className={fieldLabel}>
                Invested today
              </label>
              <MoneyInput id={ids.currentAmount} value={controls.currentAmount} onChange={(v) => update("currentAmount", v)} />
            </div>

            {controls.planningMode === "contribution" ? (
              <div className="flex min-w-0 flex-col gap-1.5">
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
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor={ids.income}
                  className={fieldLabel}
                  title={`Retirement income you want per year, in ${controls.goalDollars === "today" ? "today's" : retirementYear} dollars`}
                >
                  Yearly income goal
                </label>
                <MoneyInput
                  id={ids.income}
                  value={controls.desiredAnnualIncome}
                  onChange={(v) => update("desiredAnnualIncome", v)}
                />
              </div>
            )}
          </div>

          {/* Changing it keeps the number and changes what it means, so the contribution follows. */}
          {controls.planningMode === "goal" && (
            <div className="flex items-center justify-between gap-3">
              <span aria-hidden="true" className={fieldLabel}>
                Goal in
              </span>
              <Segmented
                size="sm"
                label="Income goal in"
                options={DOLLAR_OPTIONS}
                value={controls.goalDollars}
                onChange={(dollars) => update("goalDollars", dollars)}
                className="min-w-0 flex-1"
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
                  <p className="text-ink">
                    <span className="text-[13px] text-ink-3">You'll need</span>{" "}
                    <span className="text-lg font-semibold tracking-[-0.02em] tabular-nums">
                      {currencyFormatter.format(requiredAtFrequency)}
                    </span>{" "}
                    <span className="text-[13px] text-ink-2">{FREQUENCY_PHRASE[controls.contributionFrequency]}</span>
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
                    {controls.goalDollars === "today"
                      ? `${currencyFormatter.format(goal.today)} today is about ${currencyFormatter.format(goal.future)} a year in ${retirementYear} prices.`
                      : `${currencyFormatter.format(goal.future)} a year in ${retirementYear} is about ${currencyFormatter.format(goal.today)} in today's dollars.`}{" "}
                    At a {(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% withdrawal rate, that takes about{" "}
                    {currencyFormatter.format(goal.targetBalance)} saved by {controls.targetAge}.
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

        <Group
          title="Inflation"
          detail={
            <span className="text-xs text-ink-3 tabular-nums">
              About <span className="font-semibold text-ink">{pct1(inflationPath.average)}</span> a year
            </span>
          }
        >
          <Segmented
            size="sm"
            label="Inflation assumption"
            options={INFLATION_MODES}
            value={controls.inflationMode}
            onChange={(mode) => update("inflationMode", mode)}
          />

          {controls.inflationMode === "custom" ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor={ids.customInflation} className={fieldLabel}>
                  Your inflation rate
                </label>
                <span className="text-[13px] font-medium text-ink tabular-nums">{pct1(controls.customInflation)}</span>
              </div>
              <input
                id={ids.customInflation}
                type="range"
                min={0}
                max={10}
                step={0.1}
                value={controls.customInflation * 100}
                onChange={(e) => update("customInflation", Number(e.target.value) / 100)}
                className="w-full"
              />
            </div>
          ) : (
            <p
              className="text-xs leading-relaxed text-ink-3"
              title={inflationLive ? "Live CPI data from FRED, the St. Louis Fed" : "Built-in copy of CPI data from FRED, the St. Louis Fed"}
            >
              {controls.inflationMode === "forecast"
                ? `Now ${pct1(inflationData.latest.yoy)} (${formatCpiMonth(inflationData.latest.date)}), easing toward ${pct1(inflationPath.anchor)}.`
                : "The US average since 1926."}
            </p>
          )}

          <label htmlFor={ids.raise} className="flex items-start gap-2.5 text-[13px] text-ink-2">
            <input
              id={ids.raise}
              type="checkbox"
              checked={controls.raiseContributions}
              onChange={(e) => update("raiseContributions", e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            Raise my contributions with inflation
          </label>
        </Group>
      </div>
    </div>
  );
}

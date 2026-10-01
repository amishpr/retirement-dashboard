import { lazy, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ControlsPanel, type Controls } from "./components/ControlsPanel";
import { Header } from "./components/Header";
import { SummaryHero } from "./components/SummaryHero";
import { MobileBalanceBar } from "./components/MobileBalanceBar";
import { ProjectionCard } from "./components/ProjectionCard";
import { Deferred } from "./components/DeferredCard";
import type { CompareFund } from "./components/CompareChart";
import type { RiskReturnPoint } from "./components/RiskReturnChart";
import type { FundOverviewData } from "./components/FundOverviewCard";
import { ETF_OPTIONS, getAllFunds, DEFAULT_ETF_TICKER, FALLBACK_PRICES_AS_OF } from "./data/etfs";
import { aggregatePortfolioComposition, getFundComposition, getTopHoldingsConcentration } from "./data/fundComposition";
import type { ExcelSheet } from "./lib/excelExport";
import { BUILT_IN_INFLATION } from "./data/cpiHistory";
import { annualRates, buildInflationPath, formatCpiMonth, realReturn, type InflationData } from "./lib/inflation";
import { fetchInflationData, resolvePrice, type LiveQuote } from "./lib/liveData";
import { useLiveQuotes, whenIdle } from "./lib/useLiveQuotes";
import { computeBlendedReturn, computeBlendedVolatility, type PortfolioMixRow } from "./lib/portfolio";
import {
  finalPoint,
  pickDollars,
  projectGrowth,
  SAFE_WITHDRAWAL_RATE,
  type Dollars,
  type ProjectionInput,
  type YearPoint,
} from "./lib/projection";
import { classifyRisk } from "./lib/risk";

const RETURN_SPREAD = 0.02;
const LIVE_RETURN_BOUNDS: [number, number] = [-0.1, 0.5];

// The cards below the main chart load as one chunk after the first view is drawn (see detailStage).
let detailCards: Promise<typeof import("./components/detailCards")> | undefined;
const loadDetailCards = () => (detailCards ??= import("./components/detailCards"));
const InflationCard = lazy(() => loadDetailCards().then((m) => ({ default: m.InflationCard })));
const FundOverviewCard = lazy(() => loadDetailCards().then((m) => ({ default: m.FundOverviewCard })));
const HoldingsChart = lazy(() => loadDetailCards().then((m) => ({ default: m.HoldingsChart })));
const SectorChart = lazy(() => loadDetailCards().then((m) => ({ default: m.SectorChart })));
const CompareChart = lazy(() => loadDetailCards().then((m) => ({ default: m.CompareChart })));
const RiskReturnChart = lazy(() => loadDetailCards().then((m) => ({ default: m.RiskReturnChart })));

/** Inflation, then the fund overview, then holdings and sectors, then compare and risk. */
const DETAIL_STAGES = 4;

const initialControls: Controls = {
  mode: "single",
  ticker: DEFAULT_ETF_TICKER,
  customTickers: [],
  allocations: [
    { ticker: "VOO", weight: 60 },
    { ticker: "VXUS", weight: 40 },
  ],
  currentAge: 30,
  targetAge: 65,
  currentAmount: 10000,
  contributionAmount: 200,
  contributionFrequency: "biweekly",
  planningMode: "contribution",
  desiredAnnualIncome: 40000,
  goalDollars: "future",
  inflationMode: "forecast",
  customInflation: 0.03,
  raiseContributions: false,
};

/** The plan starts today. Read once, so a session left open over New Year doesn't shift mid-edit. */
const START_YEAR = new Date().getFullYear();

const DOLLARS_KEY = "dollars";

/** Future dollars, what the account statement will say, unless the visitor picked today's dollars
 *  before. Storage can throw (private windows, blocked site data), and then it's just the default. */
function readStoredDollars(): Dollars {
  try {
    return localStorage.getItem(DOLLARS_KEY) === "today" ? "today" : "future";
  } catch {
    return "future";
  }
}

function App() {
  const [controls, setControls] = useState<Controls>(initialControls);
  const [inflationData, setInflationData] = useState<InflationData>(BUILT_IN_INFLATION);
  const [inflationLive, setInflationLive] = useState(false);
  const [dollars, setDollarsState] = useState<Dollars>(readStoredDollars);

  const setDollars = (next: Dollars) => {
    setDollarsState(next);
    try {
      localStorage.setItem(DOLLARS_KEY, next);
    } catch {
      // Not remembered across visits, which is fine.
    }
  };

  // CPI comes out monthly, so one fetch per visit is plenty. Until it answers, and whenever it
  // can't, the built-in copy keeps every inflation figure working.
  useEffect(() => {
    let cancelled = false;
    fetchInflationData()
      .then((data) => {
        if (cancelled) return;
        setInflationData(data);
        setInflationLive(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Typing in a field or dragging an allocation slider changes state that ~15 charts depend on.
  // Deferring the copy that feeds those charts lets React commit the input's own update first and
  // re-render the charts at low priority, so a fast drag stays responsive instead of queueing a
  // full chart repaint behind every intermediate value. The sidebar keeps the immediate `controls`.
  const plan = useDeferredValue(controls);

  const allFunds = useMemo(() => getAllFunds(plan.customTickers), [plan.customTickers]);
  const selectedFund = allFunds.find((f) => f.ticker === plan.ticker) ?? allFunds[0];

  // The first view is the hero, the plan panel, and the main chart. The cards below it mount one
  // step at a time when the browser is idle, each rendered as a transition so typing stays
  // responsive, and each step waits for their shared chunk. Scrolling toward a card mounts it early.
  const [detailStage, setDetailStage] = useState(0);
  useEffect(() => {
    if (detailStage >= DETAIL_STAGES) return;
    let cancelled = false;
    const cancelIdle = whenIdle(() => {
      void loadDetailCards().then(() => {
        if (!cancelled) startTransition(() => setDetailStage((stage) => Math.max(stage, detailStage + 1)));
      });
    }, 1500);
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [detailStage]);
  const showDetailStage = useMemo(
    () =>
      Array.from({ length: DETAIL_STAGES + 1 }, (_, n) => () => {
        startTransition(() => setDetailStage((stage) => Math.max(stage, n)));
      }),
    [],
  );

  // A printed report needs every card, even if it's printed before they've all had their turn.
  useEffect(() => {
    const onBeforePrint = () => flushSync(() => setDetailStage(DETAIL_STAGES));
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, []);

  // Seed a freshly-added custom ticker's assumed return from its real 5yr CAGR, once, without
  // clobbering a value the user has since dragged the slider to set themselves.
  const seedCustomReturns = useCallback((quotes: LiveQuote[]) => {
    setControls((prev) => {
      let changed = false;
      const nextCustomTickers = prev.customTickers.map((ct) => {
        const live = quotes.find((q) => q.symbol === ct.ticker);
        if (!ct.liveSeeded && live?.cagr !== undefined) {
          changed = true;
          const clamped = Math.min(LIVE_RETURN_BOUNDS[1], Math.max(LIVE_RETURN_BOUNDS[0], live.cagr));
          return { ...ct, avgReturn: clamped, liveSeeded: true };
        }
        return ct;
      });
      return changed ? { ...prev, customTickers: nextCustomTickers } : prev;
    });
  }, []);

  // Live prices and returns are a progressive enhancement. They're only there when the finance
  // function is reachable (on Netlify, or `netlify dev` locally); otherwise the app runs on its
  // built-in averages and says so under the fund list. The core five come first, the other presets
  // once the lower cards are drawn. See useLiveQuotes.
  const customTickerList = useMemo(() => controls.customTickers.map((ct) => ct.ticker), [controls.customTickers]);
  const live = useLiveQuotes({
    customTickers: customTickerList,
    detailReady: detailStage >= DETAIL_STAGES,
    onQuotes: seedCustomReturns,
  });
  const liveData = live.quotes;

  const blendedReturn = useMemo(
    () => computeBlendedReturn(plan.allocations, allFunds),
    [plan.allocations, allFunds],
  );

  const annualReturn = plan.mode === "portfolio" ? blendedReturn : selectedFund.avgReturn;

  const planLabel =
    plan.mode === "portfolio"
      ? "Your mix"
      : selectedFund.ticker;

  const compareFunds: CompareFund[] = useMemo(() => {
    const presets: CompareFund[] = ETF_OPTIONS.map((f) => ({
      ticker: f.ticker,
      name: f.name,
      avgReturn: f.avgReturn,
      expenseRatio: f.expenseRatio,
    }));
    if (plan.mode === "portfolio") {
      return [...presets, { ticker: "MIX", name: "Your portfolio mix", avgReturn: blendedReturn }];
    }
    if (selectedFund.category === "Custom") {
      return [...presets, { ticker: selectedFund.ticker, name: selectedFund.name, avgReturn: selectedFund.avgReturn }];
    }
    return presets;
  }, [plan.mode, blendedReturn, selectedFund]);

  const compareHighlight = plan.mode === "portfolio" ? "MIX" : selectedFund.ticker;

  const getVolatility = (ticker: string, staticVolatility?: number) =>
    liveData[ticker]?.volatility ?? staticVolatility;
  // A mix blends its funds' volatility, so each fund needs the same built-in fallback a single fund
  // gets. Without it, a mix showed "n/a" and dropped off the risk chart whenever live data was down.
  const fundVolatility = (ticker: string) =>
    getVolatility(ticker, ETF_OPTIONS.find((f) => f.ticker === ticker)?.staticVolatility);

  const riskReturnPoints: RiskReturnPoint[] = useMemo(() => {
    const points: RiskReturnPoint[] = [];
    for (const f of ETF_OPTIONS) {
      const risk = getVolatility(f.ticker, f.staticVolatility);
      if (risk === undefined) continue;
      points.push({ ticker: f.ticker, risk, returnPct: f.avgReturn * 100, highlighted: compareHighlight === f.ticker });
    }
    if (plan.mode === "portfolio") {
      const mixRisk = computeBlendedVolatility(plan.allocations, fundVolatility);
      if (mixRisk !== undefined) {
        points.push({ ticker: "MIX", risk: mixRisk, returnPct: blendedReturn * 100, highlighted: true });
      }
    } else if (selectedFund.category === "Custom") {
      const risk = getVolatility(selectedFund.ticker);
      if (risk !== undefined) {
        points.push({ ticker: selectedFund.ticker, risk, returnPct: selectedFund.avgReturn * 100, highlighted: true });
      }
    }
    return points;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveData, plan.mode, plan.allocations, selectedFund, blendedReturn, compareHighlight]);

  const compositionResult = useMemo(() => {
    if (plan.mode === "portfolio") {
      const agg = aggregatePortfolioComposition(plan.allocations);
      if (!agg) return { composition: undefined, note: undefined };
      const totalWeight = plan.allocations.reduce((s, a) => s + a.weight, 0) || 1;
      const coveragePct = (agg.coveredWeight / totalWeight) * 100;
      return {
        composition: agg.composition,
        note: `Weighted across the funds in your mix with known composition data (~${coveragePct.toFixed(0)}% of your allocation). Approximate, not live.`,
      };
    }
    return { composition: getFundComposition(selectedFund.ticker), note: undefined };
  }, [plan.mode, plan.allocations, selectedFund]);

  const portfolioMixRows: PortfolioMixRow[] = useMemo(() => {
    if (plan.mode === "single") {
      return [{ ticker: selectedFund.ticker, name: selectedFund.name, weight: 1 }];
    }
    const totalWeight = plan.allocations.reduce((s, a) => s + Math.max(0, a.weight), 0);
    if (totalWeight <= 0) return [];
    return plan.allocations.map((a) => {
      const fund = allFunds.find((f) => f.ticker === a.ticker);
      return { ticker: a.ticker, name: fund?.name ?? a.ticker, weight: Math.max(0, a.weight) / totalWeight };
    });
  }, [plan.mode, plan.allocations, selectedFund, allFunds]);

  const fundOverviewData: FundOverviewData = useMemo(() => {
    if (plan.mode === "portfolio") {
      const totalWeight = plan.allocations.reduce((s, a) => s + Math.max(0, a.weight), 0);
      let knownExpenseWeight = 0;
      let expenseSum = 0;
      for (const a of plan.allocations) {
        const fund = allFunds.find((f) => f.ticker === a.ticker);
        if (fund?.expenseRatio !== undefined) {
          expenseSum += fund.expenseRatio * Math.max(0, a.weight);
          knownExpenseWeight += Math.max(0, a.weight);
        }
      }
      const blendedExpenseRatio = knownExpenseWeight > 0 ? expenseSum / knownExpenseWeight : undefined;
      const mixRisk = totalWeight > 0 ? computeBlendedVolatility(plan.allocations, fundVolatility) : undefined;

      return {
        ticker: "MIX",
        name: "Your portfolio mix",
        description: `${plan.allocations.length} fund${plan.allocations.length === 1 ? "" : "s"} blended together`,
        category: "Portfolio mix",
        avgReturn: blendedReturn,
        expenseRatio: blendedExpenseRatio,
        riskLabel: mixRisk !== undefined ? classifyRisk(mixRisk) : undefined,
        volatility: mixRisk,
        domestic: compositionResult.composition?.domestic,
        international: compositionResult.composition?.international,
      };
    }

    const quote = liveData[selectedFund.ticker];
    return {
      ticker: selectedFund.ticker,
      name: selectedFund.name,
      description: selectedFund.description,
      category: selectedFund.category,
      avgReturn: selectedFund.avgReturn,
      actualReturn: quote?.cagr,
      expenseRatio: selectedFund.expenseRatio,
      price: resolvePrice(quote, selectedFund.avgPrice),
      pricePending: live.pending.has(selectedFund.ticker) && !quote,
      riskLabel: quote?.riskLabel ?? selectedFund.riskLabel,
      volatility: quote?.volatility ?? selectedFund.staticVolatility,
      domestic: compositionResult.composition?.domestic,
      international: compositionResult.composition?.international,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.mode, plan.allocations, allFunds, selectedFund, liveData, live.pending, blendedReturn, compositionResult]);

  const years = plan.targetAge - plan.currentAge;

  const inflationPath = useMemo(
    () => buildInflationPath({ mode: plan.inflationMode, customRate: plan.customInflation }, inflationData, years, START_YEAR),
    [plan.inflationMode, plan.customInflation, inflationData, years],
  );

  const input: ProjectionInput = useMemo(
    () => ({
      currentAge: plan.currentAge,
      targetAge: plan.targetAge,
      currentAmount: plan.currentAmount,
      contributionAmount: plan.contributionAmount,
      contributionFrequency: plan.contributionFrequency,
      annualReturn,
      inflation: inflationPath.years.map((y) => y.rate),
      raiseContributions: plan.raiseContributions,
      startYear: START_YEAR,
    }),
    // Listed field by field rather than depending on the whole plan object, so edits that don't
    // affect the projection (switching planning mode, adding a ticker) don't invalidate every chart.
    [
      plan.currentAge,
      plan.targetAge,
      plan.currentAmount,
      plan.contributionAmount,
      plan.contributionFrequency,
      annualReturn,
      inflationPath,
      plan.raiseContributions,
    ],
  );

  const growthData = useMemo(() => projectGrowth(input), [input]);
  const final = growthData[growthData.length - 1];

  // The same projection with balance, contributions, and growth in the dollars being shown. The
  // Balance, Yearly, and Table views read only those three fields, so they follow the toggle
  // without knowing about it.
  const shownData: YearPoint[] = useMemo(
    () => (dollars === "future" ? growthData : growthData.map((point) => ({ ...point, ...pickDollars(point, dollars) }))),
    [growthData, dollars],
  );

  const scenarioData = useMemo(() => {
    const conservative = projectGrowth(input, Math.max(0, annualReturn - RETURN_SPREAD));
    const optimistic = projectGrowth(input, annualReturn + RETURN_SPREAD);
    return growthData.map((point, i) => ({
      age: point.age,
      conservative: pickDollars(conservative[i], dollars).balance,
      expected: pickDollars(point, dollars).balance,
      optimistic: pickDollars(optimistic[i], dollars).balance,
    }));
  }, [input, annualReturn, growthData, dollars]);

  const shown = pickDollars(final, dollars);
  const totalContributed = shown.contributions;
  const totalGrowth = shown.growth;
  const multiple = totalContributed > 0 ? shown.balance / totalContributed : 0;
  const annualIncome = shown.balance * SAFE_WITHDRAWAL_RATE;
  const realIncome = final.realBalance * SAFE_WITHDRAWAL_RATE;
  const annualRealReturn = realReturn(annualReturn, inflationPath.average);
  const retirementYear = START_YEAR + Math.max(0, years);

  const getReportSheets = (): ExcelSheet[] => {
    const composition = compositionResult.composition;

    const summary: Record<string, unknown>[] = [
      { metric: "Plan", value: plan.mode === "portfolio" ? "Portfolio mix" : selectedFund.ticker },
      { metric: "Current age", value: plan.currentAge },
      { metric: "Target age", value: plan.targetAge },
      { metric: "Years to target", value: years },
      { metric: "Current invested amount", value: plan.currentAmount },
      { metric: "Planning mode", value: plan.planningMode === "goal" ? "By goal" : "By contribution" },
      ...(plan.planningMode === "goal"
        ? [
            {
              metric: `Desired annual retirement income (${plan.goalDollars === "today" ? "today's" : retirementYear} dollars)`,
              value: plan.desiredAnnualIncome.toFixed(2),
            },
          ]
        : []),
      { metric: "Contribution amount", value: plan.contributionAmount.toFixed(2) },
      { metric: "Contribution frequency", value: plan.contributionFrequency },
      { metric: "Assumed avg. annual return (%)", value: (annualReturn * 100).toFixed(2) },
      {
        metric: "Inflation assumption",
        value: { forecast: "Forecast", history: "History (since 1926)", custom: "Custom" }[plan.inflationMode],
      },
      { metric: "Assumed avg. inflation (%)", value: (inflationPath.average * 100).toFixed(2) },
      { metric: "Return after inflation (%)", value: (annualRealReturn * 100).toFixed(2) },
      { metric: `Latest CPI, 12-month change (%), ${formatCpiMonth(inflationData.latest.date)}`, value: (inflationData.latest.yoy * 100).toFixed(2) },
      { metric: "10-year breakeven inflation (%)", value: (inflationData.market.breakeven10y * 100).toFixed(2) },
      { metric: "Contributions rise with inflation", value: plan.raiseContributions ? "Yes" : "No" },
      { metric: "Amounts on screen", value: dollars === "today" ? "Today's dollars" : "Future dollars" },
      { metric: `Final balance (${retirementYear} dollars)`, value: final.balance.toFixed(2) },
      { metric: "Final balance (today's dollars)", value: final.realBalance.toFixed(2) },
      { metric: "Prices at retirement vs today (x)", value: final.priceIndex.toFixed(3) },
      { metric: "Total contributed", value: final.contributions.toFixed(2) },
      { metric: "Investment growth", value: final.growth.toFixed(2) },
      { metric: "Growth after inflation (today's dollars)", value: final.realGrowth.toFixed(2) },
      { metric: "Growth multiple", value: (final.contributions > 0 ? final.balance / final.contributions : 0).toFixed(2) },
      {
        metric: `Estimated annual retirement income (${(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% rule, ${retirementYear} dollars)`,
        value: (final.balance * SAFE_WITHDRAWAL_RATE).toFixed(2),
      },
      {
        metric: `Estimated annual retirement income (${(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% rule, today's dollars)`,
        value: realIncome.toFixed(2),
      },
      {
        metric: `Estimated monthly retirement income (${(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% rule, today's dollars)`,
        value: (realIncome / 12).toFixed(2),
      },
      { metric: "Expense ratio (%)", value: fundOverviewData.expenseRatio !== undefined ? (fundOverviewData.expenseRatio * 100).toFixed(2) : "" },
      { metric: "Risk level", value: fundOverviewData.riskLabel ?? "" },
      { metric: "Volatility (%)", value: fundOverviewData.volatility !== undefined ? (fundOverviewData.volatility * 100).toFixed(1) : "" },
      { metric: "Domestic (%)", value: composition ? (composition.domestic * 100).toFixed(0) : "" },
      { metric: "International (%)", value: composition ? (composition.international * 100).toFixed(0) : "" },
      { metric: "Top holdings concentration (%)", value: composition ? (getTopHoldingsConcentration(composition) * 100).toFixed(0) : "" },
    ];

    const compareRows = compareFunds
      .map((fund) => {
        const point = finalPoint(input, fund.avgReturn);
        return {
          ticker: fund.ticker,
          name: fund.name,
          avgReturnPct: (fund.avgReturn * 100).toFixed(1),
          expenseRatioPct: fund.expenseRatio !== undefined ? (fund.expenseRatio * 100).toFixed(2) : "",
          projectedBalance: point.balance.toFixed(2),
          projectedBalanceTodaysDollars: point.realBalance.toFixed(2),
        };
      })
      .sort((a, b) => Number(b.projectedBalance) - Number(a.projectedBalance));

    const yearlyGrowthRows = growthData.slice(1).map((point, i) => ({
      age: point.age,
      year: point.calendarYear,
      yearlyGrowth: (point.growth - growthData[i].growth).toFixed(2),
      yearlyGrowthAfterInflation: (point.realGrowth - growthData[i].realGrowth).toFixed(2),
    }));

    const conservative = projectGrowth(input, Math.max(0, annualReturn - RETURN_SPREAD));
    const optimistic = projectGrowth(input, annualReturn + RETURN_SPREAD);
    const scenarioRows = growthData.map((point, i) => ({
      age: point.age,
      year: point.calendarYear,
      conservative: conservative[i].balance.toFixed(2),
      expected: point.balance.toFixed(2),
      optimistic: optimistic[i].balance.toFixed(2),
      conservativeTodaysDollars: conservative[i].realBalance.toFixed(2),
      expectedTodaysDollars: point.realBalance.toFixed(2),
      optimisticTodaysDollars: optimistic[i].realBalance.toFixed(2),
    }));

    const inflationRows = [
      ...annualRates(inflationData.annual)
        .filter(([year]) => year >= 1960)
        .map(([year, rate]) => ({ year, actualPct: (rate * 100).toFixed(2) })),
      ...inflationPath.years.map((y) => ({
        year: y.calendarYear,
        forecastPct: (y.rate * 100).toFixed(2),
        lowPct: y.rateLow !== undefined ? (y.rateLow * 100).toFixed(2) : "",
        highPct: y.rateHigh !== undefined ? (y.rateHigh * 100).toFixed(2) : "",
        pricesVsToday: y.priceIndex.toFixed(4),
        buyingPowerOfOneDollar: (1 / y.priceIndex).toFixed(4),
      })),
    ];

    const holdingsRows = composition
      ? [
          ...composition.topHoldings.map((h) => ({ holding: h.name, weightPct: (h.weight * 100).toFixed(1) })),
          {
            holding: `Other (~${Math.max(0, composition.holdingsCount - composition.topHoldings.length)} holdings)`,
            weightPct: (Math.max(0, 1 - composition.topHoldings.reduce((s, h) => s + h.weight, 0)) * 100).toFixed(1),
          },
        ]
      : [];

    const sectorRows = composition?.sectorWeightings
      ? [...composition.sectorWeightings]
          .sort((a, b) => b.weight - a.weight)
          .map((s) => ({ sector: s.name, weightPct: (s.weight * 100).toFixed(1) }))
      : [];

    const geographyRows = composition
      ? [
          { region: "US (domestic)", sharePct: (composition.domestic * 100).toFixed(0) },
          { region: "International", sharePct: (composition.international * 100).toFixed(0) },
        ]
      : [];

    return [
      { name: "Summary", rows: summary },
      {
        name: "Growth Projection",
        rows: growthData.map((row) => ({
          age: row.age,
          year: row.calendarYear,
          contributions: row.contributions.toFixed(2),
          growth: row.growth.toFixed(2),
          balance: row.balance.toFixed(2),
          priceIndex: row.priceIndex.toFixed(4),
          contributionsTodaysDollars: row.realContributions.toFixed(2),
          growthAfterInflation: row.realGrowth.toFixed(2),
          balanceTodaysDollars: row.realBalance.toFixed(2),
        })),
      },
      { name: "Scenario Range", rows: scenarioRows },
      { name: "Growth By Year", rows: yearlyGrowthRows },
      {
        name: "Risk vs Return",
        rows: riskReturnPoints.map((p) => ({
          ticker: p.ticker,
          volatilityPct: (p.risk * 100).toFixed(1),
          avgReturnPct: p.returnPct.toFixed(1),
        })),
      },
      { name: "Top Holdings", rows: holdingsRows },
      { name: "Sector Weightings", rows: sectorRows },
      { name: "Domestic vs Intl", rows: geographyRows },
      {
        name: "Portfolio Composition",
        rows: portfolioMixRows.map((r) => ({ ticker: r.ticker, fund: r.name, sharePct: (r.weight * 100).toFixed(1) })),
      },
      { name: "ETF Comparison", rows: compareRows },
      { name: "Inflation", rows: inflationRows },
    ];
  };

  const planPanelRef = useRef<HTMLElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-dvh pb-16">
      <Header getSheets={getReportSheets} />

      <main className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-6 lg:pt-8">
        {/* One column on small screens, ordered answer first, then the inputs, then the detail.
            From lg up, the plan panel sits in a sticky left column spanning both rows. In a tall
            window it's exactly the window's height and only its fund list scrolls; in a short one
            the whole panel scrolls. */}
        <div className="grid grid-cols-1 gap-6 print:block lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
          <div ref={summaryRef} className="min-w-0 lg:col-start-2 lg:row-start-1 print:mb-6">
            <SummaryHero
              dollars={dollars}
              onDollarsChange={setDollars}
              balance={shown.balance}
              futureBalance={final.balance}
              todayBalance={final.realBalance}
              retirementYear={retirementYear}
              contributed={totalContributed}
              growth={totalGrowth}
              multiple={multiple}
              annualIncome={annualIncome}
              withdrawalRate={SAFE_WITHDRAWAL_RATE}
              targetAge={plan.targetAge}
              years={years}
              planLabel={planLabel}
              annualReturn={annualReturn}
              realReturn={annualRealReturn}
            />
          </div>

          <aside
            ref={planPanelRef}
            aria-label="Your plan"
            className="min-w-0 print:hidden lg:sticky lg:top-6 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto tall:h-[calc(100dvh-3rem)] tall:overflow-visible"
          >
            <ControlsPanel
              controls={controls}
              onChange={setControls}
              liveData={liveData}
              liveStatus={live.status}
              livePending={live.pending}
              onShowAllFunds={live.loadRest}
              inflationData={inflationData}
              inflationLive={inflationLive}
              startYear={START_YEAR}
              annualReturn={annualReturn}
              onTrackIncome={{ today: realIncome, future: final.balance * SAFE_WITHDRAWAL_RATE }}
            />
          </aside>

          <div className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-2">
            <ProjectionCard
              data={shownData}
              rawData={growthData}
              inflationPath={inflationPath}
              dollars={dollars}
              scenarioData={scenarioData}
              annualReturn={annualReturn}
              returnSpread={RETURN_SPREAD}
              planLabel={planLabel}
            />

            {/* Skeleton heights match each card in its default state at each breakpoint, measured
                in the browser, so the swap doesn't shift anything below it. */}
            <Deferred show={detailStage >= 1} onApproach={showDetailStage[1]} skeleton="h-[828px] sm:h-[738px] md:h-[722px] lg:h-[738px] xl:h-[722px]">
              <InflationCard
                data={inflationData}
                live={inflationLive}
                path={inflationPath}
                targetAge={plan.targetAge}
                startYear={START_YEAR}
              />
            </Deferred>

            <Deferred show={detailStage >= 2} onApproach={showDetailStage[2]} skeleton="h-[366px] min-[440px]:h-[334px] sm:h-[278px] xl:h-[205px]">
              <FundOverviewCard data={fundOverviewData} />
            </Deferred>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Deferred show={detailStage >= 3} onApproach={showDetailStage[3]} skeleton="h-[449px] sm:h-[439px] xl:h-[457px]">
                <HoldingsChart label={planLabel} composition={compositionResult.composition} note={compositionResult.note} />
              </Deferred>
              <Deferred show={detailStage >= 3} onApproach={showDetailStage[3]} skeleton="h-[432px] sm:h-[440px] xl:h-[457px]">
                <SectorChart label={planLabel} composition={compositionResult.composition} note={compositionResult.note} />
              </Deferred>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Deferred show={detailStage >= 4} onApproach={showDetailStage[4]} skeleton="h-[704px] min-[389px]:h-[686px] min-[640px]:h-[694px] min-[664px]:h-[676px] xl:h-[694px]">
                <CompareChart input={input} funds={compareFunds} highlightTicker={compareHighlight} dollars={dollars} />
              </Deferred>
              <Deferred show={detailStage >= 4} onApproach={showDetailStage[4]} skeleton="h-[414px] sm:h-[436px] xl:h-[694px]">
                <RiskReturnChart points={riskReturnPoints} />
              </Deferred>
            </div>

            <footer className="flex flex-col gap-2 pt-2 text-[13px] leading-relaxed text-ink-3">
              <p>
                <span className="font-medium text-ink-2">Where the numbers come from.</span> Fund prices and 5-year
                returns come live from Yahoo Finance through this site's server. They refresh every 5 minutes while the
                page is open and can be delayed by up to 15 minutes. When Yahoo can't be reached, the app shows built-in
                12-month average prices to {FALLBACK_PRICES_AS_OF} instead, and keeps trying in the background. The
                assumed return for each fund is a long-run historical average built into the app, so live data only
                fills in the estimate for a ticker you add.
                Inflation comes from FRED (the St. Louis Fed), with a built-in copy as the fallback.
              </p>
              <p>
                Average annual returns are approximate, long-run historical figures for each fund and are provided for
                educational purposes only. They are not a guarantee or prediction of future performance. This tool does
                not account for fees, taxes, or dividend reinvestment timing, and is not financial advice. The inflation
                forecast is a simple statistical model of past prices and bond market expectations, not a prediction.
              </p>
              <p>
                Made by{" "}
                <a
                  href="https://github.com/amishpr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-ink-3"
                >
                  Amish Prajapati
                </a>
                .
              </p>
            </footer>
          </div>
        </div>
      </main>

      <MobileBalanceBar
        planRef={planPanelRef}
        summaryRef={summaryRef}
        balance={shown.balance}
        targetAge={plan.targetAge}
        dollars={dollars}
      />
    </div>
  );
}

export default App;

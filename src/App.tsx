import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ControlsPanel, type Controls } from "./components/ControlsPanel";
import { Header } from "./components/Header";
import { SummaryHero } from "./components/SummaryHero";
import { MobileBalanceBar } from "./components/MobileBalanceBar";
import { ProjectionCard } from "./components/ProjectionCard";
import { CompareChart, type CompareFund } from "./components/CompareChart";
import { RiskReturnChart, type RiskReturnPoint } from "./components/RiskReturnChart";
import { HoldingsChart } from "./components/HoldingsChart";
import { SectorChart } from "./components/SectorChart";
import { FundOverviewCard, type FundOverviewData } from "./components/FundOverviewCard";
import { ETF_OPTIONS, getAllFunds, DEFAULT_ETF_TICKER } from "./data/etfs";
import { aggregatePortfolioComposition, getFundComposition, getTopHoldingsConcentration } from "./data/fundComposition";
import type { ExcelSheet } from "./lib/excelExport";
import { fetchLiveQuotes, resolvePrice, type LiveQuote } from "./lib/liveData";
import { computeBlendedReturn, computeBlendedVolatility, type PortfolioMixRow } from "./lib/portfolio";
import { finalPoint, projectGrowth, SAFE_WITHDRAWAL_RATE, type ProjectionInput } from "./lib/projection";
import { classifyRisk } from "./lib/risk";

const RETURN_SPREAD = 0.02;
const LIVE_RETURN_BOUNDS: [number, number] = [-0.1, 0.5];
/** Matches the finance function's 5-minute cache, so each refresh can bring a newer quote. */
const LIVE_REFRESH_MS = 5 * 60 * 1000;

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
};

function App() {
  const [controls, setControls] = useState<Controls>(initialControls);
  const [liveData, setLiveData] = useState<Record<string, LiveQuote>>({});

  // Typing in a field or dragging an allocation slider changes state that ~15 charts depend on.
  // Deferring the copy that feeds those charts lets React commit the input's own update first and
  // re-render the charts at low priority, so a fast drag stays responsive instead of queueing a
  // full chart repaint behind every intermediate value. The sidebar keeps the immediate `controls`.
  const plan = useDeferredValue(controls);

  const allFunds = useMemo(() => getAllFunds(plan.customTickers), [plan.customTickers]);
  const selectedFund = allFunds.find((f) => f.ticker === plan.ticker) ?? allFunds[0];

  const fundTickerKey = useMemo(() => allFunds.map((f) => f.ticker).join(","), [allFunds]);

  // Live prices/returns are a progressive enhancement — only available when deployed on Netlify
  // (or via `netlify dev` locally). If the function route doesn't exist, this silently no-ops
  // and the app behaves exactly as it does with the built-in historical-average assumptions.
  useEffect(() => {
    const tickers = fundTickerKey ? fundTickerKey.split(",") : [];
    if (tickers.length === 0) return;
    let cancelled = false;

    const load = () =>
      fetchLiveQuotes(tickers, "5y")
        .then((results) => {
          if (cancelled) return;
          const okResults = results.filter((r) => r.ok);

          setLiveData((prev) => {
            const next = { ...prev };
            for (const result of okResults) next[result.symbol] = result;
            return next;
          });

          // Seed a freshly-added custom ticker's assumed return from its real 5yr CAGR, once,
          // without clobbering a value the user has since dragged the slider to set themselves.
          setControls((prev) => {
            let changed = false;
            const nextCustomTickers = prev.customTickers.map((ct) => {
              const live = okResults.find((r) => r.symbol === ct.ticker);
              if (!ct.liveSeeded && live?.cagr !== undefined) {
                changed = true;
                const clamped = Math.min(LIVE_RETURN_BOUNDS[1], Math.max(LIVE_RETURN_BOUNDS[0], live.cagr));
                return { ...ct, avgReturn: clamped, liveSeeded: true };
              }
              return ct;
            });
            return changed ? { ...prev, customTickers: nextCustomTickers } : prev;
          });
        })
        .catch(() => {
          // Live data unavailable (e.g. running plain `vite dev`) — ignore and keep static assumptions.
        });

    load();
    // Prices move through the trading day. Skip refreshes while the tab is in the background, and
    // a failed refresh keeps the last good quotes rather than dropping back to averages.
    const timer = window.setInterval(() => {
      if (!document.hidden) load();
    }, LIVE_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [fundTickerKey]);

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

    const live = liveData[selectedFund.ticker];
    return {
      ticker: selectedFund.ticker,
      name: selectedFund.name,
      description: selectedFund.description,
      category: selectedFund.category,
      avgReturn: selectedFund.avgReturn,
      expenseRatio: selectedFund.expenseRatio,
      price: resolvePrice(live, selectedFund.avgPrice),
      riskLabel: live?.riskLabel ?? selectedFund.riskLabel,
      volatility: live?.volatility ?? selectedFund.staticVolatility,
      domestic: compositionResult.composition?.domestic,
      international: compositionResult.composition?.international,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.mode, plan.allocations, allFunds, selectedFund, liveData, blendedReturn, compositionResult]);

  const input: ProjectionInput = useMemo(
    () => ({
      currentAge: plan.currentAge,
      targetAge: plan.targetAge,
      currentAmount: plan.currentAmount,
      contributionAmount: plan.contributionAmount,
      contributionFrequency: plan.contributionFrequency,
      annualReturn,
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
    ],
  );

  const growthData = useMemo(() => projectGrowth(input), [input]);
  const final = growthData[growthData.length - 1];
  const years = plan.targetAge - plan.currentAge;

  const scenarioData = useMemo(() => {
    const conservative = projectGrowth(input, Math.max(0, annualReturn - RETURN_SPREAD));
    const expected = growthData;
    const optimistic = projectGrowth(input, annualReturn + RETURN_SPREAD);
    return expected.map((point, i) => ({
      age: point.age,
      conservative: conservative[i].balance,
      expected: point.balance,
      optimistic: optimistic[i].balance,
    }));
  }, [input, annualReturn, growthData]);

  const totalContributed = final.contributions;
  const totalGrowth = final.growth;
  const multiple = totalContributed > 0 ? final.balance / totalContributed : 0;
  const annualIncome = final.balance * SAFE_WITHDRAWAL_RATE;

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
        ? [{ metric: "Desired annual retirement income", value: plan.desiredAnnualIncome.toFixed(2) }]
        : []),
      { metric: "Contribution amount", value: plan.contributionAmount.toFixed(2) },
      { metric: "Contribution frequency", value: plan.contributionFrequency },
      { metric: "Assumed avg. annual return (%)", value: (annualReturn * 100).toFixed(2) },
      { metric: "Final balance", value: final.balance.toFixed(2) },
      { metric: "Total contributed", value: totalContributed.toFixed(2) },
      { metric: "Investment growth", value: totalGrowth.toFixed(2) },
      { metric: "Growth multiple", value: multiple.toFixed(2) },
      {
        metric: `Estimated annual retirement income (${(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% rule)`,
        value: annualIncome.toFixed(2),
      },
      {
        metric: `Estimated monthly retirement income (${(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% rule)`,
        value: (annualIncome / 12).toFixed(2),
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
        };
      })
      .sort((a, b) => Number(b.projectedBalance) - Number(a.projectedBalance));

    const yearlyGrowthRows = growthData.slice(1).map((point, i) => ({
      age: point.age,
      yearlyGrowth: (point.growth - growthData[i].growth).toFixed(2),
    }));

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
          contributions: row.contributions.toFixed(2),
          growth: row.growth.toFixed(2),
          balance: (row.contributions + row.growth).toFixed(2),
        })),
      },
      {
        name: "Scenario Range",
        rows: scenarioData.map((row) => ({
          age: row.age,
          conservative: row.conservative.toFixed(2),
          expected: row.expected.toFixed(2),
          optimistic: row.optimistic.toFixed(2),
        })),
      },
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
    ];
  };

  const planPanelRef = useRef<HTMLElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-dvh pb-16">
      <Header getSheets={getReportSheets} />

      <main className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-6 lg:pt-8">
        {/* One column on small screens, ordered answer first, then the inputs, then the detail.
            From lg up, the plan panel sits in a sticky left column spanning both rows. */}
        <div className="grid grid-cols-1 gap-6 print:block lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
          <div ref={summaryRef} className="min-w-0 lg:col-start-2 lg:row-start-1 print:mb-6">
            <SummaryHero
              balance={final.balance}
              contributed={totalContributed}
              growth={totalGrowth}
              multiple={multiple}
              annualIncome={annualIncome}
              withdrawalRate={SAFE_WITHDRAWAL_RATE}
              targetAge={plan.targetAge}
              years={years}
              planLabel={planLabel}
              annualReturn={annualReturn}
            />
          </div>

          <aside
            ref={planPanelRef}
            aria-label="Your plan"
            className="min-w-0 print:hidden lg:sticky lg:top-6 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto"
          >
            <ControlsPanel
              controls={controls}
              onChange={setControls}
              liveData={liveData}
              annualReturn={annualReturn}
              currentAnnualIncomeEstimate={annualIncome}
            />
          </aside>

          <div className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-2">
            <ProjectionCard
              data={growthData}
              scenarioData={scenarioData}
              annualReturn={annualReturn}
              returnSpread={RETURN_SPREAD}
              planLabel={planLabel}
            />

            <FundOverviewCard data={fundOverviewData} />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <HoldingsChart label={planLabel} composition={compositionResult.composition} note={compositionResult.note} />
              <SectorChart label={planLabel} composition={compositionResult.composition} note={compositionResult.note} />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <CompareChart input={input} funds={compareFunds} highlightTicker={compareHighlight} />
              <RiskReturnChart points={riskReturnPoints} />
            </div>

            <footer className="pt-2 text-[13px] leading-relaxed text-ink-3">
              <p>
                Average annual returns are approximate, long-run historical figures for each fund and are provided for
                educational purposes only.
                <br />
                They are not a guarantee or prediction of future performance.
                <br />
                This tool does not account for fees, taxes, dividend reinvestment timing, or inflation, and is not financial
                advice.
              </p>
              <p className="mt-2">
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
        balance={final.balance}
        targetAge={plan.targetAge}
      />
    </div>
  );
}

export default App;

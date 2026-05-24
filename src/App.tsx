import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PiggyBank, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { ControlsPanel, type Controls } from "./components/ControlsPanel";
import { StatTile } from "./components/StatTile";
import { AnimatedNumber } from "./components/AnimatedNumber";
import { GrowthChart } from "./components/GrowthChart";
import { ScenarioChart } from "./components/ScenarioChart";
import { CompareChart, type CompareFund } from "./components/CompareChart";
import { BreakdownDonut } from "./components/BreakdownDonut";
import { YearlyGrowthBarChart } from "./components/YearlyGrowthBarChart";
import { CandlestickChart, type CandlePoint } from "./components/CandlestickChart";
import { RetirementIncomeCard } from "./components/RetirementIncomeCard";
import { RiskReturnChart, type RiskReturnPoint } from "./components/RiskReturnChart";
import { VolatilityBarChart, type VolatilityPoint } from "./components/VolatilityBarChart";
import { HoldingsDonut } from "./components/HoldingsDonut";
import { HoldingsChart } from "./components/HoldingsChart";
import { SectorChart } from "./components/SectorChart";
import { GeographyDonut } from "./components/GeographyDonut";
import { FundOverviewCard, type FundOverviewData } from "./components/FundOverviewCard";
import { DownloadReportButton } from "./components/DownloadReportButton";
import { GithubRepoButton } from "./components/GithubRepoButton";
import { PrintPageButton } from "./components/PrintPageButton";
import { ThemeToggle } from "./components/ThemeToggle";
import { ETF_OPTIONS, getAllFunds, DEFAULT_ETF_TICKER } from "./data/etfs";
import { aggregatePortfolioComposition, getFundComposition, getTopHoldingsConcentration } from "./data/fundComposition";
import type { ExcelSheet } from "./lib/excelExport";
import { fetchLiveQuotes, type LiveQuote } from "./lib/liveData";
import { computeBlendedReturn, computeBlendedVolatility, type PortfolioMixRow } from "./lib/portfolio";
import {
  currencyFormatter,
  finalPoint,
  formatAdaptiveCurrency,
  projectGrowth,
  SAFE_WITHDRAWAL_RATE,
  type ProjectionInput,
} from "./lib/projection";
import { classifyRisk } from "./lib/risk";

const RETURN_SPREAD = 0.02;

const WALLET_ICON = <Wallet size={16} />;
const PIGGY_ICON = <PiggyBank size={16} />;
const TRENDING_ICON = <TrendingUp size={16} />;
const SPARKLES_ICON = <Sparkles size={16} />;
const formatMultiple = (v: number) => `${v.toFixed(1)}×`;
const LIVE_RETURN_BOUNDS: [number, number] = [-0.1, 0.5];

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

    return () => {
      cancelled = true;
    };
  }, [fundTickerKey]);

  const blendedReturn = useMemo(
    () => computeBlendedReturn(plan.allocations, allFunds),
    [plan.allocations, allFunds],
  );

  const annualReturn = plan.mode === "portfolio" ? blendedReturn : selectedFund.avgReturn;

  const planLabel =
    plan.mode === "portfolio"
      ? "your portfolio mix"
      : selectedFund.ticker;

  const growthSubtitle =
    plan.mode === "portfolio"
      ? "Projected value of your portfolio mix, contributions vs. market growth"
      : `Projected value of your ${selectedFund.ticker} investment, contributions vs. market growth`;

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

  const riskReturnPoints: RiskReturnPoint[] = useMemo(() => {
    const points: RiskReturnPoint[] = [];
    for (const f of ETF_OPTIONS) {
      const risk = getVolatility(f.ticker, f.staticVolatility);
      if (risk === undefined) continue;
      points.push({ ticker: f.ticker, risk, returnPct: f.avgReturn * 100, highlighted: compareHighlight === f.ticker });
    }
    if (plan.mode === "portfolio") {
      const mixRisk = computeBlendedVolatility(plan.allocations, (t) => getVolatility(t));
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

  const volatilityPoints: VolatilityPoint[] = useMemo(
    () =>
      riskReturnPoints.map((p) => ({
        ticker: p.ticker,
        volatility: p.risk,
        riskLabel: classifyRisk(p.risk),
        highlighted: p.highlighted,
      })),
    [riskReturnPoints],
  );

  const compositionResult = useMemo(() => {
    if (plan.mode === "portfolio") {
      const agg = aggregatePortfolioComposition(plan.allocations);
      if (!agg) return { composition: undefined, note: undefined };
      const totalWeight = plan.allocations.reduce((s, a) => s + a.weight, 0) || 1;
      const coveragePct = (agg.coveredWeight / totalWeight) * 100;
      return {
        composition: agg.composition,
        note: `Weighted across the funds in your mix with known composition data (~${coveragePct.toFixed(0)}% of your allocation) — approximate, not live.`,
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
      const mixRisk = totalWeight > 0 ? computeBlendedVolatility(plan.allocations, (t) => getVolatility(t)) : undefined;

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

  const candleData: CandlePoint[] = useMemo(
    () =>
      scenarioData.slice(1).map((point, i) => ({
        age: point.age,
        open: scenarioData[i].expected,
        close: point.expected,
        high: point.optimistic,
        low: point.conservative,
      })),
    [scenarioData],
  );

  const totalContributed = final.contributions;
  const totalGrowth = final.growth;
  const multiple = totalContributed > 0 ? final.balance / totalContributed : 0;

  const getReportSheets = (): ExcelSheet[] => {
    const composition = compositionResult.composition;
    const annualIncome = final.balance * SAFE_WITHDRAWAL_RATE;

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

  return (
    <div className="bg-grid min-h-screen pb-16">
      <header
        className="border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "color-mix(in srgb, var(--series-contrib) 15%, transparent)", color: "var(--series-contrib)" }}
            >
              <PiggyBank size={18} />
            </span>
            <div>
              <h1 className="text-base font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                Retirement Investing Dashboard
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Model your ETF investments through retirement
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PrintPageButton />
            <DownloadReportButton filename="retirement-plan-report.xlsx" getSheets={getReportSheets} />
            <GithubRepoButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 rounded-2xl border p-5 sm:p-6"
          style={{
            borderColor: "var(--border)",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--series-contrib) 10%, var(--surface-card)), var(--surface-card))",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--series-contrib)" }}>
                <Sparkles size={14} />
                {years > 0 ? `${years} years to go` : "Set a future target age"}
              </div>
              <p className="mt-2 text-lg sm:text-xl" style={{ color: "var(--text-primary)" }}>
                At age {plan.targetAge}, investing in <span className="font-semibold">{planLabel}</span> could
                potentially grow to{" "}
                <span className="font-semibold" style={{ color: "var(--series-contrib)" }}>
                  <AnimatedNumber
                    value={final.balance}
                    formatter={(v) => currencyFormatter.format(v)}
                    className="text-xl sm:text-2xl"
                    pulseOnChange
                  />
                </span>
                .
              </p>
              <p className="mt-1 text-base sm:text-lg" style={{ color: "var(--text-muted)" }}>
                Which is{" "}
                <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
                  <AnimatedNumber
                    value={final.balance * SAFE_WITHDRAWAL_RATE}
                    formatter={(v) => currencyFormatter.format(v)}
                    pulseOnChange
                  />
                </span>{" "}
                annually at a {(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% safe withdrawal rate.
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                Based on a {(annualReturn * 100).toFixed(1)}% average annual return, historically. Actual results will vary.
              </p>
            </div>
            <span
              className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl sm:flex"
              style={{
                background: "color-mix(in srgb, var(--series-contrib) 15%, transparent)",
                color: "var(--series-contrib)",
              }}
            >
              <TrendingUp size={30} />
            </span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 print:block lg:grid-cols-[320px_1fr]">
          <div className="print:hidden lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
            <ControlsPanel
              controls={controls}
              onChange={setControls}
              liveData={liveData}
              annualReturn={annualReturn}
              currentAnnualIncomeEstimate={final.balance * SAFE_WITHDRAWAL_RATE}
            />
          </div>

          <div className="flex flex-col gap-6">
            <FundOverviewCard data={fundOverviewData} />

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile
                label="Final balance"
                value={final.balance}
                formatter={formatAdaptiveCurrency}
                hint={`at age ${plan.targetAge}`}
                icon={WALLET_ICON}
                accent="var(--series-contrib)"
              />
              <StatTile
                label="Total contributed"
                value={totalContributed}
                formatter={formatAdaptiveCurrency}
                hint="principal you invest"
                icon={PIGGY_ICON}
                accent="var(--series-contrib)"
              />
              <StatTile
                label="Investment growth"
                value={totalGrowth}
                formatter={formatAdaptiveCurrency}
                hint="earned from compounding"
                icon={TRENDING_ICON}
                accent="var(--series-growth)"
              />
              <StatTile
                label="Growth multiple"
                value={multiple}
                formatter={formatMultiple}
                hint="balance vs. contributed"
                icon={SPARKLES_ICON}
                accent="var(--series-accent)"
              />
            </div>

            <GrowthChart data={growthData} subtitle={growthSubtitle} />

            <div className="grid grid-cols-1 gap-6 print:grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
              <ScenarioChart data={scenarioData} returnSpread={RETURN_SPREAD} />
              <BreakdownDonut contributions={totalContributed} growth={totalGrowth} />
            </div>

            <div className="grid grid-cols-1 gap-6 print:grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
              <YearlyGrowthBarChart data={growthData} />
              <RetirementIncomeCard finalBalance={final.balance} />
            </div>

            <CandlestickChart data={candleData} />

            <div className="grid grid-cols-1 gap-6 print:grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
              <RiskReturnChart points={riskReturnPoints} />
              <VolatilityBarChart points={volatilityPoints} />
            </div>

            <div className="grid grid-cols-1 items-stretch gap-6 print:grid-cols-1 lg:grid-cols-[1fr_1.3fr]">
              <HoldingsDonut label={planLabel} composition={compositionResult.composition} note={compositionResult.note} />
              <HoldingsChart label={planLabel} composition={compositionResult.composition} note={compositionResult.note} />
            </div>

            <div className="grid grid-cols-1 items-stretch gap-6 print:grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
              <SectorChart label={planLabel} composition={compositionResult.composition} note={compositionResult.note} />
              <GeographyDonut label={planLabel} composition={compositionResult.composition} note={compositionResult.note} />
            </div>

            <CompareChart input={input} funds={compareFunds} highlightTicker={compareHighlight} />

            <div className="px-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              <p>
                Average annual returns are approximate, long-run historical figures for each fund and are provided for
                educational purposes only. They are not a guarantee or prediction of future performance. This tool does
                not account for fees, taxes, dividend reinvestment timing, or inflation, and is not financial advice.
              </p>
              <p className="mt-2">
                This dashboard was made by{" "}
                <a
                  href="https://github.com/amishpr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline-offset-2 hover:underline"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Amish Prajapati
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

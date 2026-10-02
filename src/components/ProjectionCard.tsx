import { memo, useEffect, useState, type ReactNode } from "react";
import type { InflationPath } from "../lib/inflation";
import { buildYearlyGrowth, currencyFormatterPrecise, type Dollars, type YearPoint } from "../lib/projection";
import { BuyingPowerChart } from "./BuyingPowerChart";
import { Card } from "./Card";
import { DownloadCsvButton } from "./DownloadCsvButton";
import { GrowthChart } from "./GrowthChart";
import { PREPARE_PRINT_EVENT } from "./Header";
import { ScenarioChart, type ScenarioPoint } from "./ScenarioChart";
import { Segmented } from "./Segmented";
import { YearlyGrowthBarChart } from "./YearlyGrowthBarChart";

type View = "balance" | "buying" | "range" | "yearly" | "table";

const VIEWS = [
  { value: "balance", label: "Balance" },
  { value: "buying", label: "Buying power" },
  { value: "range", label: "Range" },
  { value: "yearly", label: "Yearly" },
  { value: "table", label: "Table" },
] as const;

const money = (v: number) => currencyFormatterPrecise.format(v);

/** `data` is in the dollars shown; `rawData` has both, for the year, price, and other-dollar columns. */
function ProjectionTable({ data, rawData, dollars }: { data: YearPoint[]; rawData: YearPoint[]; dollars: Dollars }) {
  const other = dollars === "today" ? "future" : "today";
  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-line">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-sunken text-xs text-ink-3">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">Age</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Year</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">You put in</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{dollars === "today" ? "Growth after inflation" : "Market growth"}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Balance</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Prices vs today</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Balance ({other === "today" ? "today's" : "future"} $)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {data.map((row, i) => (
            <tr key={row.age}>
              <td className="px-3 py-2 text-ink">{row.age}</td>
              <td className="px-3 py-2 text-ink-3">{row.calendarYear}</td>
              <td className="px-3 py-2 text-right text-ink-2">{money(row.contributions)}</td>
              <td className="px-3 py-2 text-right text-ink-2">{money(row.growth)}</td>
              <td className="px-3 py-2 text-right font-medium text-ink">{money(row.contributions + row.growth)}</td>
              <td className="px-3 py-2 text-right text-ink-3">{row.priceIndex.toFixed(2)}×</td>
              <td className="px-3 py-2 text-right text-ink-2">
                {money(other === "today" ? rawData[i].realBalance : rawData[i].balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="break-inside-avoid">
      <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
      <div className="h-80">{children}</div>
    </div>
  );
}

/**
 * The main chart, with the three ways of reading the projection (and the raw numbers) as tabs on
 * one card instead of three separate cards stacked down the page.
 */
export const ProjectionCard = memo(function ProjectionCard({
  data,
  rawData,
  inflationPath,
  dollars,
  scenarioData,
  annualReturn,
  returnSpread,
  planLabel,
}: {
  /** The projection in the dollars being shown. */
  data: YearPoint[];
  /** The same projection with both future and today's dollars, for Buying power and the table. */
  rawData: YearPoint[];
  inflationPath: InflationPath;
  dollars: Dollars;
  scenarioData: ScenarioPoint[];
  annualReturn: number;
  returnSpread: number;
  planLabel: string;
}) {
  const [view, setView] = useState<View>("balance");

  // On screen only the open tab renders. The Export menu's print path fires PREPARE_PRINT_EVENT a
  // couple of seconds before opening the print dialog, which gives these charts time to mount and
  // size themselves, so the PDF has both the balance and the range whichever tab was open.
  const [printAll, setPrintAll] = useState(false);
  useEffect(() => {
    const on = () => setPrintAll(true);
    const off = () => setPrintAll(false);
    window.addEventListener(PREPARE_PRINT_EVENT, on);
    window.addEventListener("afterprint", off);
    return () => {
      window.removeEventListener(PREPARE_PRINT_EVENT, on);
      window.removeEventListener("afterprint", off);
    };
  }, []);

  const inDollars = dollars === "today" ? "in today's dollars" : "in future dollars";
  const subtitles: Record<View, string> = {
    balance:
      dollars === "today"
        ? `What you put into ${planLabel} versus what it grows to beyond inflation, in today's dollars.`
        : `What you put into ${planLabel} versus what the market adds, year by year, in future dollars.`,
    buying: "What the balance will say in future dollars, and what it will buy at today's prices.",
    range: `How the balance changes if returns come in ${Math.round(returnSpread * 100)} points higher or lower, ${inDollars}.`,
    yearly:
      dollars === "today"
        ? "Growth beyond inflation each year, in today's dollars, not counting new contributions."
        : "Market growth (or loss) each year, in future dollars, not counting new contributions.",
    table: `Every year of the projection, ${inDollars}.`,
  };

  // Both dollars always go in the file, whichever the page is showing.
  const balanceCsv = {
    filename: "portfolio-growth.csv",
    getRows: () =>
      rawData.map((row) => ({
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
  };
  const csv: Record<View, { filename: string; getRows: () => Record<string, unknown>[] }> = {
    balance: balanceCsv,
    buying: { ...balanceCsv, filename: "buying-power.csv" },
    table: balanceCsv,
    range: {
      filename: dollars === "today" ? "scenario-range-todays-dollars.csv" : "scenario-range.csv",
      getRows: () =>
        scenarioData.map((row) => ({
          age: row.age,
          conservative: row.conservative.toFixed(2),
          expected: row.expected.toFixed(2),
          optimistic: row.optimistic.toFixed(2),
        })),
    },
    yearly: {
      filename: dollars === "today" ? "growth-by-year-todays-dollars.csv" : "growth-by-year.csv",
      getRows: () => buildYearlyGrowth(data).map((row) => ({ age: row.age, yearlyGrowth: row.yearlyGrowth.toFixed(2) })),
    },
  };

  return (
    <Card
      title="Projection"
      subtitle={printAll ? undefined : subtitles[view]}
      action={<DownloadCsvButton filename={csv[view].filename} getRows={csv[view].getRows} />}
    >
      {printAll ? (
        <div className="flex flex-col gap-8">
          <PrintSection title={dollars === "today" ? "Balance, in today's dollars" : "Balance, in future dollars"}>
            <GrowthChart data={data} dollars={dollars} />
          </PrintSection>
          <PrintSection title="Buying power">
            <BuyingPowerChart data={rawData} path={inflationPath} />
          </PrintSection>
          <PrintSection title={dollars === "today" ? "Range, in today's dollars" : "Range, in future dollars"}>
            <ScenarioChart data={scenarioData} annualReturn={annualReturn} returnSpread={returnSpread} />
          </PrintSection>
        </div>
      ) : (
        <>
          {/* Five tabs are wider than a phone, so on narrow screens the bar scrolls sideways in its
              own strip (bleeding to the card's edges) rather than widening the page. */}
          <div className="-mx-5 mb-5 overflow-x-auto px-5 sm:mx-0 sm:overflow-visible sm:px-0">
            <Segmented label="Projection view" options={VIEWS} value={view} onChange={setView} className="w-max min-w-full sm:min-w-0" />
          </div>
          {view === "table" ? (
            <ProjectionTable data={data} rawData={rawData} dollars={dollars} />
          ) : (
            <div className="h-72 sm:h-96">
              {view === "balance" && <GrowthChart data={data} dollars={dollars} />}
              {view === "buying" && <BuyingPowerChart data={rawData} path={inflationPath} />}
              {view === "range" && (
                <ScenarioChart data={scenarioData} annualReturn={annualReturn} returnSpread={returnSpread} />
              )}
              {view === "yearly" && <YearlyGrowthBarChart data={data} dollars={dollars} />}
            </div>
          )}
        </>
      )}
    </Card>
  );
});

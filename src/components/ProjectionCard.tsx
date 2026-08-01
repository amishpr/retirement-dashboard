import { memo, useEffect, useState, type ReactNode } from "react";
import { buildYearlyGrowth, currencyFormatterPrecise, type YearPoint } from "../lib/projection";
import { Card } from "./Card";
import { DownloadCsvButton } from "./DownloadCsvButton";
import { GrowthChart } from "./GrowthChart";
import { PREPARE_PRINT_EVENT } from "./Header";
import { ScenarioChart, type ScenarioPoint } from "./ScenarioChart";
import { Segmented } from "./Segmented";
import { YearlyGrowthBarChart } from "./YearlyGrowthBarChart";

type View = "balance" | "range" | "yearly" | "table";

const VIEWS = [
  { value: "balance", label: "Balance" },
  { value: "range", label: "Range" },
  { value: "yearly", label: "Yearly" },
  { value: "table", label: "Table" },
] as const;

const money = (v: number) => currencyFormatterPrecise.format(v);

function ProjectionTable({ data }: { data: YearPoint[] }) {
  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-line">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-sunken text-xs text-ink-3">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">Age</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">You put in</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Market growth</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line font-mono tabular-nums">
          {data.map((row) => (
            <tr key={row.age}>
              <td className="px-3 py-2 text-ink">{row.age}</td>
              <td className="px-3 py-2 text-right text-ink-2">{money(row.contributions)}</td>
              <td className="px-3 py-2 text-right text-ink-2">{money(row.growth)}</td>
              <td className="px-3 py-2 text-right font-medium text-ink">{money(row.contributions + row.growth)}</td>
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
  scenarioData,
  annualReturn,
  returnSpread,
  planLabel,
}: {
  data: YearPoint[];
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

  const subtitles: Record<View, string> = {
    balance: `What you put into ${planLabel} versus what the market adds, year by year.`,
    range: `How the balance changes if returns come in ${Math.round(returnSpread * 100)} points higher or lower.`,
    yearly: "Market growth added each year, not counting new contributions.",
    table: "Every year of the projection.",
  };

  const balanceCsv = {
    filename: "portfolio-growth.csv",
    getRows: () =>
      data.map((row) => ({
        age: row.age,
        contributions: row.contributions.toFixed(2),
        growth: row.growth.toFixed(2),
        balance: (row.contributions + row.growth).toFixed(2),
      })),
  };
  const csv: Record<View, { filename: string; getRows: () => Record<string, unknown>[] }> = {
    balance: balanceCsv,
    table: balanceCsv,
    range: {
      filename: "scenario-range.csv",
      getRows: () =>
        scenarioData.map((row) => ({
          age: row.age,
          conservative: row.conservative.toFixed(2),
          expected: row.expected.toFixed(2),
          optimistic: row.optimistic.toFixed(2),
        })),
    },
    yearly: {
      filename: "growth-by-year.csv",
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
          <PrintSection title="Balance">
            <GrowthChart data={data} />
          </PrintSection>
          <PrintSection title="Range">
            <ScenarioChart data={scenarioData} annualReturn={annualReturn} returnSpread={returnSpread} />
          </PrintSection>
        </div>
      ) : (
        <>
          <Segmented
            label="Projection view"
            options={VIEWS}
            value={view}
            onChange={setView}
            className="mb-5 w-full sm:w-fit"
          />
          {view === "table" ? (
            <ProjectionTable data={data} />
          ) : (
            <div className="h-72 sm:h-96">
              {view === "balance" && <GrowthChart data={data} />}
              {view === "range" && (
                <ScenarioChart data={scenarioData} annualReturn={annualReturn} returnSpread={returnSpread} />
              )}
              {view === "yearly" && <YearlyGrowthBarChart data={data} />}
            </div>
          )}
        </>
      )}
    </Card>
  );
});

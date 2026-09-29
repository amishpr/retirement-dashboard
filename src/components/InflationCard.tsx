import { memo, useMemo, useState } from "react";
import { annualRates, formatCpiMonth, historicalAverage, type InflationData, type InflationPath } from "../lib/inflation";
import { Card } from "./Card";
import { StatusDot } from "./DataSource";
import { DownloadCsvButton } from "./DownloadCsvButton";
import { InflationChart, type InflationChartPoint } from "./InflationChart";
import { Segmented } from "./Segmented";

const FIRST_CHART_YEAR = 1960;

const VIEWS = [
  { value: "chart", label: "Chart" },
  { value: "table", label: "Table" },
] as const;

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const dollars = (v: number) => `$${Math.round(v)}`;

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em] text-ink tabular-nums">{value}</dd>
      <dd className="text-xs text-ink-3">{note}</dd>
    </div>
  );
}

interface Row extends InflationChartPoint {
  /** Prices relative to today, for forecast years. */
  priceIndex?: number;
}

/**
 * Inflation at a glance: where it is now, what the bond market expects, the long-run history, and
 * what the plan assumes, with the history and the forecast on one chart.
 */
export const InflationCard = memo(function InflationCard({
  data,
  live,
  path,
  targetAge,
  startYear,
}: {
  data: InflationData;
  /** Whether `data` is fresh from FRED or the built-in copy. */
  live: boolean;
  path: InflationPath;
  targetAge: number;
  startYear: number;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const retirement = path.years[path.years.length - 1];
  const hasRange = path.years.some((y) => y.priceLow !== undefined);
  const cpiMonth = formatCpiMonth(data.latest.date);

  const rows = useMemo<Row[]>(() => {
    const history: Row[] = annualRates(data.annual)
      .filter(([year]) => year >= FIRST_CHART_YEAR && year < startYear)
      .map(([year, rate]) => ({ year, actual: rate * 100 }));
    // The forecast line starts from today (the latest 12-month change, or the flat rate) so it
    // joins the history instead of floating a year to the right of it.
    const now: Row = { year: startYear, forecast: path.start * 100, range: hasRange ? [path.start * 100, path.start * 100] : undefined, priceIndex: 1 };
    const forecast: Row[] = path.years.map((y) => ({
      year: y.calendarYear,
      forecast: y.rate * 100,
      range: y.rateLow !== undefined && y.rateHigh !== undefined ? [y.rateLow * 100, y.rateHigh * 100] : undefined,
      priceIndex: y.priceIndex,
    }));
    return [...history, now, ...forecast];
  }, [data.annual, path, startYear, hasRange]);

  const csvRows = () =>
    rows.map((r) => {
      const year = path.years.find((y) => y.calendarYear === r.year);
      return {
        year: r.year,
        actualPct: r.actual?.toFixed(2) ?? "",
        forecastPct: r.forecast?.toFixed(2) ?? "",
        lowPct: r.range?.[0].toFixed(2) ?? "",
        highPct: r.range?.[1].toFixed(2) ?? "",
        pricesVsToday: r.priceIndex?.toFixed(4) ?? "",
        buyingPowerOfOneDollar: r.priceIndex ? (1 / r.priceIndex).toFixed(4) : "",
        buyingPowerLow: year?.priceHigh ? (1 / year.priceHigh).toFixed(4) : "",
        buyingPowerHigh: year?.priceLow ? (1 / year.priceLow).toFixed(4) : "",
      };
    });

  return (
    <Card
      title="Inflation"
      subtitle={`What US consumer prices have done since ${FIRST_CHART_YEAR}, and what your plan assumes through ${
        retirement?.calendarYear ?? startYear
      }.`}
      action={<DownloadCsvButton filename="inflation.csv" getRows={csvRows} />}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <Stat label="Now" value={pct(data.latest.yoy)} note={`${cpiMonth}, past 12 months`} />
        <Stat label="Bond market" value={pct(data.market.breakeven10y)} note="Expected, next 10 years" />
        <Stat label="Since 1926" value={pct(historicalAverage(data.annual, 1926))} note="US average a year" />
        <Stat label="Your plan" value={pct(path.average)} note={`Average to ${retirement?.calendarYear ?? startYear}`} />
      </dl>

      <p className="mt-4 flex items-center gap-2 text-xs text-ink-3">
        <StatusDot state={live ? "live" : "offline"} />
        {live ? "Live from FRED, St. Louis Fed" : "Built-in copy of FRED data"} · CPI through {cpiMonth}
      </p>

      {retirement && (
        <p className="mt-5 rounded-lg bg-sunken px-3.5 py-3 text-sm text-ink">
          At {targetAge}, $100 will buy about what <span className="font-semibold tabular-nums">{dollars(100 / retirement.priceIndex)}</span>{" "}
          buys today
          {retirement.priceLow && retirement.priceHigh ? (
            <span className="text-ink-2 tabular-nums">
              {" "}
              (likely {dollars(100 / retirement.priceHigh)} to {dollars(100 / retirement.priceLow)})
            </span>
          ) : null}
          .
        </p>
      )}

      <Segmented label="Inflation view" options={VIEWS} value={view} onChange={setView} className="mb-5 mt-5 w-full sm:w-fit print:hidden" />

      {view === "chart" ? (
        <div className="h-72 sm:h-80">
          <InflationChart data={rows} today={startYear} planAverage={path.average * 100} hasRange={hasRange} />
        </div>
      ) : (
        <div className="max-h-96 overflow-auto rounded-lg border border-line">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-sunken text-xs text-ink-3">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Year</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Actual</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Plan assumes</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Likely range</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">$100 then, in today's money</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {[...rows].reverse().map((r) => (
                <tr key={r.year}>
                  <td className="px-3 py-2 text-ink">{r.year}</td>
                  <td className="px-3 py-2 text-right text-ink-2">{r.actual !== undefined ? `${r.actual.toFixed(1)}%` : ""}</td>
                  <td className="px-3 py-2 text-right text-ink-2">{r.forecast !== undefined ? `${r.forecast.toFixed(1)}%` : ""}</td>
                  <td className="px-3 py-2 text-right text-ink-3">
                    {r.range && r.range[1] > r.range[0] ? `${r.range[0].toFixed(1)}% to ${r.range[1].toFixed(1)}%` : ""}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-ink">{r.priceIndex ? `$${(100 / r.priceIndex).toFixed(2)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="group mt-5 text-[13px] leading-relaxed text-ink-2">
        <summary className="cursor-pointer select-none font-medium text-ink marker:text-ink-3">How the forecast works</summary>
        <div className="mt-2 flex max-w-[68ch] flex-col gap-2 text-ink-3">
          <p>
            It starts at the latest 12-month change in consumer prices ({pct(data.latest.yoy)} in {cpiMonth}) and each year
            closes about a quarter of the gap to {pct(path.anchor)}. That's halfway between what the bond market expects for
            the long run and the US average over the last 40 years.
          </p>
          <p>
            How fast it settles, and how wide the likely range is, come from how US inflation has moved from year to year
            since 1950, 1970s included. The range covers 8 in 10 outcomes, so 1 in 10 lands above it and 1 in 10 below.
          </p>
          <p>
            The bond market figures are breakevens, the gap between regular and inflation-protected Treasury yields, which
            also carries a small risk premium. This is a simple statistical model, not a prediction. History uses the
            average since 1926, and Custom uses your own rate with no range.
          </p>
        </div>
      </details>
    </Card>
  );
});

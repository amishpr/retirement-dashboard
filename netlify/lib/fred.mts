/**
 * Turns FRED's public CSV downloads into the app's InflationData. Shared by the inflation function
 * and scripts/update-cpi.mjs, which writes the built-in copy the app falls back to.
 *
 * fredgraph.csv needs no API key, but it has no SLA either and sends no CORS headers, which is why
 * the browser goes through the function rather than calling FRED itself.
 */
import type { InflationData } from "../../src/lib/inflation.ts";

export const FRED_SERIES = {
  cpi: "CPIAUCNS", // CPI-U, all items, not seasonally adjusted, monthly since 1913
  breakeven10y: "T10YIE", // 10-year breakeven inflation, daily
  forward5y5y: "T5YIFR", // 5-year, 5-year forward inflation expectation, daily
} as const;

export const fredCsvUrl = (id: string) => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;

/** [date, value] rows. Blank and "." values are skipped, never read as 0: BLS published no
 *  October 2025 CPI, and a zero there throws every average off. */
export function parseFredCsv(csv: string): [date: string, value: number][] {
  const rows: [string, number][] = [];
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const [date, raw] = line.split(",");
    const value = Number(raw);
    if (date && raw && raw.trim() !== "." && raw.trim() !== "" && Number.isFinite(value) && value > 0) rows.push([date, value]);
  }
  return rows;
}

export function buildInflationData(cpiCsv: string, breakevenCsv: string, forwardCsv: string, fetchedAt: string): InflationData {
  const cpi = parseFredCsv(cpiCsv);
  if (cpi.length < 24) throw new Error("CPI series is too short");

  const byYear = new Map<number, number[]>();
  for (const [date, value] of cpi) {
    const year = Number(date.slice(0, 4));
    const list = byYear.get(year) ?? [];
    list.push(value);
    byYear.set(year, list);
  }
  const annual: [number, number][] = [];
  for (const [year, values] of byYear) {
    if (values.length >= 11) annual.push([year, round(values.reduce((a, b) => a + b, 0) / values.length, 3)]);
  }
  annual.sort((a, b) => a[0] - b[0]);

  // The same month a year earlier, looked up by date rather than by counting 12 rows back, because
  // the missing October 2025 row would shift a count.
  const [latestDate, latestIndex] = cpi[cpi.length - 1];
  const yearAgoDate = `${Number(latestDate.slice(0, 4)) - 1}${latestDate.slice(4)}`;
  const yearAgo = cpi.find(([date]) => date === yearAgoDate);
  if (!yearAgo) throw new Error(`No CPI reading for ${yearAgoDate}`);

  const breakeven = parseFredCsv(breakevenCsv).at(-1);
  const forward = parseFredCsv(forwardCsv).at(-1);
  if (!breakeven || !forward) throw new Error("Market expectations series is empty");

  return {
    annual,
    latest: { date: latestDate.slice(0, 7), index: latestIndex, yoy: round(latestIndex / yearAgo[1] - 1, 5) },
    market: {
      breakeven10y: round(breakeven[1] / 100, 5),
      forward5y5y: round(forward[1] / 100, 5),
      asOf: breakeven[0] < forward[0] ? breakeven[0] : forward[0],
    },
    fetchedAt,
  };
}

/** Fetches all three series and builds the data. Throws if any of them fails. */
export async function fetchInflationData(fetchImpl: typeof fetch = fetch): Promise<InflationData> {
  const get = async (id: string) => {
    const res = await fetchImpl(fredCsvUrl(id), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`FRED ${id} returned ${res.status}`);
    return res.text();
  };
  const [cpi, breakeven, forward] = await Promise.all([
    get(FRED_SERIES.cpi),
    get(FRED_SERIES.breakeven10y),
    get(FRED_SERIES.forward5y5y),
  ]);
  return buildInflationData(cpi, breakeven, forward, new Date().toISOString());
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

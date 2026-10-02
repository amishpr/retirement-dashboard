/**
 * The inflation model: US consumer prices (CPI-U) history, a forecast for each year of the plan,
 * and a likely range around it.
 *
 * The forecast is a first-order autoregressive model, AR(1), fit to annual CPI inflation since
 * 1950. Inflation starts at the latest 12-month CPI change and each year closes part of the gap to
 * a long-run anchor: pi_k = anchor + phi^k * (start - anchor). The anchor is halfway between what
 * the bond market expects for the long run (the 5-year, 5-year forward breakeven) and the last 40
 * years of history. The same fit's year-to-year surprises give the 10 to 90% range.
 *
 * Every function here is pure and the file has no imports, so `node --test` can load it directly.
 */

/** CPI data in the shape the inflation function returns and cpiHistory.ts stores. */
export interface InflationData {
  /** Average CPI-U index (not seasonally adjusted) per calendar year. Only years with at least 11
   *  monthly readings: BLS skipped October 2025 during the shutdown, and a year missing more than
   *  that isn't a fair average. */
  annual: [year: number, avgIndex: number][];
  /** The latest monthly reading, with its change from the same month a year earlier. */
  latest: { date: string; index: number; yoy: number };
  /** Market-implied inflation, as decimals: the 10-year breakeven (T10YIE) and the 5-year, 5-year
   *  forward expectation (T5YIFR). */
  market: { breakeven10y: number; forward5y5y: number; asOf: string };
  fetchedAt: string;
}

export type InflationMode = "forecast" | "history" | "custom";

export interface InflationSettings {
  mode: InflationMode;
  /** The flat yearly rate for custom mode, as a decimal. */
  customRate: number;
}

/** One plan year of inflation. `priceIndex` is prices at the end of that year relative to today
 *  (1.5 means things cost 50% more). Low and high are the 10th and 90th percentiles. */
export interface InflationYear {
  calendarYear: number;
  rate: number;
  rateLow?: number;
  rateHigh?: number;
  priceIndex: number;
  priceLow?: number;
  priceHigh?: number;
}

export interface InflationPath {
  mode: InflationMode;
  /** Plan years 1..N. */
  years: InflationYear[];
  /** The first year's starting point and where the forecast settles (forecast mode). */
  start: number;
  anchor: number;
  /** Geometric average yearly rate across the plan. */
  average: number;
}

/** The 90th percentile of a standard normal: 80% of outcomes fall within +/- this many sds. */
export const Z_80 = 1.2816;

/** Year-over-year change in the annual average index. */
export function annualRates(annual: InflationData["annual"]): [year: number, rate: number][] {
  const rates: [number, number][] = [];
  for (let i = 1; i < annual.length; i++) {
    const [year, index] = annual[i];
    const [prevYear, prevIndex] = annual[i - 1];
    // A gap in the years (a skipped incomplete year) would make this a multi-year change.
    if (year === prevYear + 1) rates.push([year, index / prevIndex - 1]);
  }
  return rates;
}

/** Ordinary least squares fit of pi_t = c + phi * pi_(t-1), on years from `fromYear` on. `mean` is
 *  the level the fit settles at, c / (1 - phi), and `sigma` is the spread of its yearly errors. */
export function fitAR1(rates: [year: number, rate: number][], fromYear = 1950): { phi: number; sigma: number; mean: number } {
  const byYear = new Map(rates);
  const x: number[] = [];
  const y: number[] = [];
  for (const [year, rate] of rates) {
    const prev = byYear.get(year - 1);
    if (year > fromYear && prev !== undefined) {
      x.push(prev);
      y.push(rate);
    }
  }
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  const phi = sxy / sxx;
  const c = my - phi * mx;
  const sse = y.reduce((sum, yi, i) => sum + (yi - (c + phi * x[i])) ** 2, 0);
  return { phi, sigma: Math.sqrt(sse / (n - 2)), mean: c / (1 - phi) };
}

/** Compound average yearly rate between two years' annual indexes, e.g. since 1926. */
export function historicalAverage(annual: InflationData["annual"], fromYear: number, toYear = annual[annual.length - 1][0]): number {
  const from = annual.find(([y]) => y === fromYear);
  const to = annual.find(([y]) => y === toYear);
  if (!from || !to || toYear <= fromYear) return NaN;
  return Math.pow(to[1] / from[1], 1 / (toYear - fromYear)) - 1;
}

/** Where the forecast settles: halfway between the bond market's long-run expectation and the
 *  last 40 years of history. */
export function forecastAnchor(data: InflationData): number {
  const lastYear = data.annual[data.annual.length - 1][0];
  return (data.market.forward5y5y + historicalAverage(data.annual, lastYear - 40)) / 2;
}

/** Standard deviation of log prices k years out when each year's rate carries an AR(1) shock:
 *  a shock in year j keeps echoing, phi times smaller each year, through every later year. */
function priceSd(k: number, phi: number, sigma: number): number {
  let sum = 0;
  for (let j = 1; j <= k; j++) {
    const echo = Math.abs(1 - phi) < 1e-9 ? k - j + 1 : (1 - Math.pow(phi, k - j + 1)) / (1 - phi);
    sum += echo * echo;
  }
  return sigma * Math.sqrt(sum);
}

/** Standard deviation of the yearly rate itself k years out. */
function rateSd(k: number, phi: number, sigma: number): number {
  let sum = 0;
  for (let j = 0; j < k; j++) sum += Math.pow(phi, 2 * j);
  return sigma * Math.sqrt(sum);
}

/** A path from per-year rates, with the AR(1) range around it when `band` is given. */
function pathFromRates(rates: number[], startYear: number, band?: { phi: number; sigma: number }): InflationYear[] {
  let priceIndex = 1;
  return rates.map((rate, i) => {
    const k = i + 1;
    priceIndex *= 1 + rate;
    const year: InflationYear = { calendarYear: startYear + k, rate, priceIndex };
    if (band) {
      const pSd = priceSd(k, band.phi, band.sigma);
      const rSd = rateSd(k, band.phi, band.sigma);
      year.priceLow = priceIndex * Math.exp(-Z_80 * pSd);
      year.priceHigh = priceIndex * Math.exp(Z_80 * pSd);
      year.rateLow = rate - Z_80 * rSd;
      year.rateHigh = rate + Z_80 * rSd;
    }
    return year;
  });
}

/** The forecast: starts at `start`, decays toward `anchor` by `phi` a year. */
export function forecastInflation({
  start,
  anchor,
  phi,
  sigma,
  years,
  startYear,
}: {
  start: number;
  anchor: number;
  phi: number;
  sigma: number;
  years: number;
  startYear: number;
}): InflationYear[] {
  const rates = Array.from({ length: Math.max(0, years) }, (_, i) => anchor + Math.pow(phi, i + 1) * (start - anchor));
  return pathFromRates(rates, startYear, { phi, sigma });
}

/** Geometric average yearly rate across a path; 0 for an empty one. */
export function averageRate(years: InflationYear[]): number {
  if (years.length === 0) return 0;
  return Math.pow(years[years.length - 1].priceIndex, 1 / years.length) - 1;
}

/**
 * The inflation path the plan uses, one entry per plan year, for the chosen mode:
 * - forecast: the AR(1) forecast with its range
 * - history: a flat rate at the US average since 1926, with the same range
 * - custom: a flat rate you pick, with no range (it's your assumption, not an estimate)
 */
export function buildInflationPath(settings: InflationSettings, data: InflationData, years: number, startYear: number): InflationPath {
  const fit = fitAR1(annualRates(data.annual), 1950);
  const anchor = forecastAnchor(data);
  const n = Math.max(0, years);
  let path: InflationYear[];
  let start: number;
  if (settings.mode === "forecast") {
    start = data.latest.yoy;
    path = forecastInflation({ start, anchor, phi: fit.phi, sigma: fit.sigma, years: n, startYear });
  } else {
    start = settings.mode === "history" ? historicalAverage(data.annual, 1926) : settings.customRate;
    path = pathFromRates(Array(n).fill(start), startYear, settings.mode === "history" ? fit : undefined);
  }
  return { mode: settings.mode, years: path, start, anchor, average: averageRate(path) };
}

/** Return after inflation: (1 + r) / (1 + i) - 1, not r - i. */
export function realReturn(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/** "Aug 2026" from a CPI month like "2026-08". */
export function formatCpiMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

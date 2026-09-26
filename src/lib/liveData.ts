export type RiskLabel = "Low" | "Medium" | "High" | "Very High";

export interface LiveQuote {
  symbol: string;
  ok: boolean;
  price?: number;
  /** Average monthly close over the last 12 months. */
  avgPrice?: number;
  currency?: string;
  name?: string;
  cagr?: number;
  years?: number;
  volatility?: number;
  riskLabel?: RiskLabel;
  error?: string;
}

/**
 * Where the finance proxy lives. Same-origin by default, which is what the Netlify deploy and
 * `netlify dev` serve. Static hosts that can't run the function — GitHub Pages — build with
 * VITE_FINANCE_ENDPOINT pointed at the Netlify deploy's copy instead.
 */
const FINANCE_ENDPOINT = import.meta.env.VITE_FINANCE_ENDPOINT || "/.netlify/functions/finance";

/**
 * Fetches live prices and a trailing CAGR via our Netlify function proxy. Only available when
 * that proxy is reachable — a plain `vite dev` server has no `/.netlify/functions` route, so
 * this will reject and callers should treat it as optional progressive enhancement, never a
 * requirement for the app to work.
 */
export async function fetchLiveQuotes(
  symbols: string[],
  range: "1y" | "2y" | "5y" | "10y" | "max" = "5y",
): Promise<LiveQuote[]> {
  if (symbols.length === 0) return [];

  const params = new URLSearchParams({ symbols: symbols.join(","), range });
  const res = await fetch(`${FINANCE_ENDPOINT}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Live data request failed (${res.status})`);
  }
  const data = (await res.json()) as { results?: LiveQuote[] };
  return data.results ?? [];
}

/** A fund's price and where it came from: a live quote, or a 12-month average when there's none. */
export interface FundPrice {
  value: number;
  source: "live" | "average";
  currency: string;
}

/**
 * Picks the best price available: the live quote, then the 12-month average the proxy computed,
 * then the built-in average for preset funds (which is all there is when the proxy can't be
 * reached). Custom tickers have no built-in average, so they show no price until a quote arrives.
 */
export function resolvePrice(live: LiveQuote | undefined, fallbackAvg: number | undefined): FundPrice | undefined {
  const [currency, scale] = MINOR_UNITS[live?.currency ?? ""] ?? [live?.currency ?? "USD", 1];
  if (live?.price !== undefined) return { value: live.price / scale, source: "live", currency };
  const avg = live?.avgPrice !== undefined ? live.avgPrice / scale : fallbackAvg;
  return avg !== undefined ? { value: avg, source: "average", currency } : undefined;
}

/** Yahoo quotes some exchanges in the minor unit (London in pence as "GBp"). Intl reads currency
 *  codes case-insensitively, so "GBp" would print pence as pounds, 100 times too high. */
const MINOR_UNITS: Record<string, [currency: string, perUnit: number]> = {
  GBp: ["GBP", 100],
  ZAc: ["ZAR", 100],
  ILA: ["ILS", 100],
};

const priceFormatters = new Map<string, Intl.NumberFormat>();

/** "$710.79", or "CA$42.10" for a ticker quoted in another currency. */
export function formatPrice(price: FundPrice): string {
  let formatter = priceFormatters.get(price.currency);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: price.currency });
    } catch {
      // An unexpected currency code from upstream: show the plain number rather than throw.
      formatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    priceFormatters.set(price.currency, formatter);
  }
  return formatter.format(price.value);
}

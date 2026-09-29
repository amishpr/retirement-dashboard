import { DEFAULT_FINANCE_ENDPOINT, DEFAULT_INFLATION_ENDPOINT, quotesUrl } from "./coreQuotes";
import type { InflationData } from "./inflation";

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
  /** When Yahoo last priced the quote (ISO). Outside market hours this is the last close. */
  asOf?: string;
  error?: string;
}

/** Where live prices stand, for the status line under the fund list. `fetchedAt` is when our
 *  server last reached Yahoo for the newest response so far (the CDN can hand out a copy up to a
 *  few minutes old), and `asOf` is the newest quote time among all the quotes so far. */
export type LiveStatus =
  | { state: "loading" }
  | { state: "live"; fetchedAt?: string; asOf?: string }
  | { state: "offline" };

/**
 * Where the finance proxy lives. Same-origin by default, which is what the Netlify deploy and
 * `netlify dev` serve. Static hosts that can't run the function — GitHub Pages — build with
 * VITE_FINANCE_ENDPOINT pointed at the Netlify deploy's copy instead.
 */
const FINANCE_ENDPOINT = import.meta.env.VITE_FINANCE_ENDPOINT || DEFAULT_FINANCE_ENDPOINT;

/** The finance function's per-request limit. Longer lists go out as several requests. */
const MAX_SYMBOLS_PER_REQUEST = 30;

/**
 * Fetches live prices and a trailing CAGR via our Netlify function proxy. Only available when
 * that proxy is reachable — a plain `vite dev` server has no `/.netlify/functions` route, so
 * this will reject and callers should treat it as optional progressive enhancement, never a
 * requirement for the app to work. Pass a `bucket` to get past the CDN's cached copy (see quotesUrl).
 */
export async function fetchLiveQuotes(
  symbols: readonly string[],
  bucket?: number,
): Promise<{ results: LiveQuote[]; fetchedAt?: string }> {
  if (symbols.length === 0) return { results: [] };

  const chunks: (readonly string[])[] = [];
  for (let i = 0; i < symbols.length; i += MAX_SYMBOLS_PER_REQUEST) {
    chunks.push(symbols.slice(i, i + MAX_SYMBOLS_PER_REQUEST));
  }
  const responses = await Promise.all(
    chunks.map(async (chunk) => {
      const res = await fetch(quotesUrl(FINANCE_ENDPOINT, chunk, bucket));
      if (!res.ok) {
        throw new Error(`Live data request failed (${res.status})`);
      }
      return (await res.json()) as { results?: LiveQuote[]; fetchedAt?: string };
    }),
  );
  return { results: responses.flatMap((r) => r.results ?? []), fetchedAt: newest(responses.map((r) => r.fetchedAt)) };
}

/** The latest of some ISO timestamps, which sort as plain strings. */
export function newest(times: (string | undefined)[]): string | undefined {
  return times.reduce<string | undefined>((latest, t) => (t && (!latest || t > latest) ? t : latest), undefined);
}

/** Where the inflation proxy lives. Same idea as FINANCE_ENDPOINT. */
const INFLATION_ENDPOINT = import.meta.env.VITE_INFLATION_ENDPOINT || DEFAULT_INFLATION_ENDPOINT;

/** Fresh CPI history and market expectations from FRED, via our proxy. Rejects when the proxy
 *  can't be reached or returns something that isn't usable, and the app keeps its built-in copy. */
export async function fetchInflationData(): Promise<InflationData> {
  const res = await fetch(INFLATION_ENDPOINT);
  if (!res.ok) throw new Error(`Inflation data request failed (${res.status})`);
  const data = (await res.json()) as InflationData;
  if (!Array.isArray(data?.annual) || data.annual.length < 50 || !(data.latest?.index > 0) || !(data.market?.forward5y5y > 0)) {
    throw new Error("Inflation data is incomplete");
  }
  return data;
}

/** A fund's price and where it came from: a live quote, or a 12-month average when there's none. */
export interface FundPrice {
  value: number;
  source: "live" | "average";
  currency: string;
  /** When a live price was quoted (ISO). */
  asOf?: string;
}

/**
 * Picks the best price available: the live quote, then the 12-month average the proxy computed,
 * then the built-in average for preset funds (which is all there is when the proxy can't be
 * reached). Custom tickers have no built-in average, so they show no price until a quote arrives.
 */
export function resolvePrice(live: LiveQuote | undefined, fallbackAvg: number | undefined): FundPrice | undefined {
  const [currency, scale] = MINOR_UNITS[live?.currency ?? ""] ?? [live?.currency ?? "USD", 1];
  if (live?.price !== undefined) return { value: live.price / scale, source: "live", currency, asOf: live.asOf };
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

const marketTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const localTimeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** "Sep 25, 4:00 PM ET": quote times read in the exchange's own time zone, the way markets quote them. */
export function formatMarketTime(iso: string): string {
  return `${marketTimeFormatter.format(new Date(iso))} ET`;
}

/** "7:32 PM" in the visitor's own time zone. */
export function formatLocalTime(iso: string): string {
  return localTimeFormatter.format(new Date(iso));
}

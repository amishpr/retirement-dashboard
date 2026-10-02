/**
 * Proxies Yahoo Finance's unofficial chart endpoint so the browser can get live prices and a
 * trailing CAGR without hitting CORS (Yahoo doesn't send permissive CORS headers) or needing
 * an API key. This endpoint is undocumented and can change or rate-limit without notice — it's
 * fine for a personal/portfolio project, not something to depend on for production trading.
 *
 * Two things soften that: a request Yahoo rate-limits or fails on query1 is retried once on its
 * twin host, query2, and Netlify's CDN keeps serving the last good response for up to an hour
 * while it retries in the background. When every symbol still fails, the response is a 502 that
 * nothing caches, and the app says it's showing built-in averages instead of live prices.
 *
 * Keep the plain, self-identifying User-Agent below. In testing, Yahoo answered it reliably but
 * rate-limited requests that claimed to be a desktop browser.
 */
import { allowedOrigin, jsonResponse } from "../lib/http.mts";

const ALLOWED_RANGES = new Set(["1y", "2y", "5y", "10y", "max"]);
const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const SYMBOL_PATTERN = /^[A-Z0-9.-]{1,10}$/;
/** Room for every preset fund plus a handful of custom tickers. The client splits longer lists. */
const MAX_SYMBOLS = 30;
/** Yahoo rate-limits bursts. Nineteen chart requests fired at once drew 429s in testing, while
 *  five at a time went through, and still finish in about a second. */
const CONCURRENT_REQUESTS = 5;

type RiskLabel = "Low" | "Medium" | "High" | "Very High";

interface QuoteResult {
  symbol: string;
  ok: boolean;
  price?: number;
  /** Average monthly close over the last 12 months, shown when there's no live price. */
  avgPrice?: number;
  currency?: string;
  name?: string;
  cagr?: number;
  years?: number;
  /** Annualized standard deviation of monthly returns over the fetched range. */
  volatility?: number;
  riskLabel?: RiskLabel;
  /** When Yahoo last priced the quote (ISO). Outside market hours this is the last close. */
  asOf?: string;
  error?: string;
}

export default async (req: Request) => {
  const allowOrigin = allowedOrigin(req);

  const url = new URL(req.url);
  const rawSymbols = url.searchParams.get("symbols") ?? "";
  const rangeParam = url.searchParams.get("range") ?? "5y";
  const range = ALLOWED_RANGES.has(rangeParam) ? rangeParam : "5y";

  const symbols = Array.from(
    new Set(
      rawSymbols
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => SYMBOL_PATTERN.test(s)),
    ),
  ).slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return jsonResponse({ error: "Provide at least one symbol via ?symbols=TICKER,TICKER" }, { status: 400, allowOrigin });
  }

  const results = await mapWithLimit(symbols, CONCURRENT_REQUESTS, (symbol) => fetchQuote(symbol, range));
  const fetchedAt = new Date().toISOString();
  // A total failure means Yahoo itself is down or blocking us, not that the tickers are wrong.
  // Answering with an error keeps the CDN from caching the outage over its last good response.
  if (results.every((r) => !r.ok)) {
    return jsonResponse(
      { error: "Yahoo Finance didn't answer", results, fetchedAt, source: "Yahoo Finance" },
      { status: 502, allowOrigin },
    );
  }
  return jsonResponse(
    { results, fetchedAt, source: "Yahoo Finance" },
    { allowOrigin, maxAge: 300, staleWhileRevalidate: 3600 },
  );
};

/** Like Promise.all over `items`, but with at most `limit` calls in flight at once. */
async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** One chart request, retried on the twin host when the first is rate-limited, errors, or times out. */
async function fetchChart(symbol: string, range: string): Promise<Response> {
  let last: Response | undefined;
  for (const host of YAHOO_HOSTS) {
    try {
      last = await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1mo`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RetirementDashboard/1.0; +https://github.com)",
        },
        signal: AbortSignal.timeout(4000),
      });
      // A 404 is a real answer (unknown ticker); only rate limits and server errors are worth a retry.
      if (last.status !== 429 && last.status < 500) return last;
    } catch (err) {
      if (host === YAHOO_HOSTS[YAHOO_HOSTS.length - 1]) throw err;
    }
  }
  return last!;
}

async function fetchQuote(symbol: string, range: string): Promise<QuoteResult> {
  try {
    const res = await fetchChart(symbol, range);

    if (!res.ok) {
      return { symbol, ok: false, error: `Upstream returned ${res.status}` };
    }

    const data = (await res.json()) as any;
    const result = data?.chart?.result?.[0];
    if (!result) {
      return { symbol, ok: false, error: "Symbol not found" };
    }

    const meta = result.meta ?? {};
    const timestamps: unknown[] = result.timestamp ?? [];
    const rawAdjclose: unknown[] = result.indicators?.adjclose?.[0]?.adjclose ?? [];

    // Pair each price with its timestamp before filtering, so a dropped null entry can't shift
    // prices out of alignment with the dates they came from.
    const series = rawAdjclose
      .map((price, i) => ({ price, timestamp: timestamps[i] }))
      .filter(
        (row): row is { price: number; timestamp: number } =>
          typeof row.price === "number" && row.price > 0 && typeof row.timestamp === "number",
      );
    const prices = series.map((row) => row.price);

    // The average uses unadjusted closes: it stands in for the quoted price, and adjclose
    // back-adjusts older months for dividends, which would pull the average below what traded.
    const rawClose: unknown[] = result.indicators?.quote?.[0]?.close ?? [];
    const recentCloses = rawClose.filter((c): c is number => typeof c === "number" && c > 0).slice(-12);
    const avgPrice =
      recentCloses.length > 0 ? recentCloses.reduce((sum, c) => sum + c, 0) / recentCloses.length : undefined;

    let cagr: number | undefined;
    let years: number | undefined;
    if (series.length >= 2) {
      // Years spanned by the *actual* first-to-last date range, not the point count — a 5y/1mo
      // request returns 61 monthly closes (60 intervals since inception-to-date), so dividing by
      // point count instead of elapsed time would overstate the span and understate the CAGR.
      const spanSeconds = series[series.length - 1].timestamp - series[0].timestamp;
      years = spanSeconds / (365.25 * 86400);
      const first = series[0].price;
      const last = series[series.length - 1].price;
      if (first > 0 && years > 0) {
        cagr = Math.pow(last / first, 1 / years) - 1;
      }
    }

    const { volatility, riskLabel } = computeRisk(prices);

    return {
      symbol,
      ok: true,
      price: typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : undefined,
      avgPrice,
      currency: meta.currency,
      name: meta.longName ?? meta.shortName ?? symbol,
      cagr,
      years: years ? Math.round(years) : undefined,
      volatility,
      riskLabel,
      asOf: typeof meta.regularMarketTime === "number" ? new Date(meta.regularMarketTime * 1000).toISOString() : undefined,
    };
  } catch (err) {
    return { symbol, ok: false, error: err instanceof Error ? err.message : "Fetch failed" };
  }
}

/** Annualized volatility from monthly returns (sample stdev × √12), plus a plain-language bucket. */
function computeRisk(monthlyPrices: number[]): { volatility?: number; riskLabel?: RiskLabel } {
  if (monthlyPrices.length < 4) return {};

  const returns: number[] = [];
  for (let i = 1; i < monthlyPrices.length; i++) {
    returns.push(monthlyPrices[i] / monthlyPrices[i - 1] - 1);
  }

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(12);

  let riskLabel: RiskLabel;
  if (volatility < 0.12) riskLabel = "Low";
  else if (volatility < 0.22) riskLabel = "Medium";
  else if (volatility < 0.35) riskLabel = "High";
  else riskLabel = "Very High";

  return { volatility, riskLabel };
}

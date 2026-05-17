/**
 * Proxies Yahoo Finance's unofficial chart endpoint so the browser can get live prices and a
 * trailing CAGR without hitting CORS (Yahoo doesn't send permissive CORS headers) or needing
 * an API key. This endpoint is undocumented and can change or rate-limit without notice — it's
 * fine for a personal/portfolio project, not something to depend on for production trading.
 */

const ALLOWED_RANGES = new Set(["1y", "2y", "5y", "10y", "max"]);
const SYMBOL_PATTERN = /^[A-Z0-9.-]{1,10}$/;
const MAX_SYMBOLS = 15;

type RiskLabel = "Low" | "Medium" | "High" | "Very High";

interface QuoteResult {
  symbol: string;
  ok: boolean;
  price?: number;
  currency?: string;
  name?: string;
  cagr?: number;
  years?: number;
  /** Annualized standard deviation of monthly returns over the fetched range. */
  volatility?: number;
  riskLabel?: RiskLabel;
  error?: string;
}

export default async (req: Request) => {
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
    return jsonResponse({ error: "Provide at least one symbol via ?symbols=TICKER,TICKER" }, 400);
  }

  const results = await Promise.all(symbols.map((symbol) => fetchQuote(symbol, range)));
  return jsonResponse({ results });
};

async function fetchQuote(symbol: string, range: string): Promise<QuoteResult> {
  try {
    const upstream = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1mo`;
    const res = await fetch(upstream, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RetirementDashboard/1.0; +https://github.com)",
      },
      signal: AbortSignal.timeout(8000),
    });

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
      currency: meta.currency,
      name: meta.longName ?? meta.shortName ?? symbol,
      cagr,
      years: years ? Math.round(years) : undefined,
      volatility,
      riskLabel,
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      // Only successful lookups are worth caching; a cached 400 would keep failing after the fix.
      "cache-control": status === 200 ? "public, max-age=300" : "no-store",
    },
  });
}

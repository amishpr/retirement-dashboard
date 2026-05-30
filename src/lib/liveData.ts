export type RiskLabel = "Low" | "Medium" | "High" | "Very High";

export interface LiveQuote {
  symbol: string;
  ok: boolean;
  price?: number;
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

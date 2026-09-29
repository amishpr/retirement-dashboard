/**
 * The five funds the page leads with, and how quote requests are addressed. Kept free of browser
 * and Vite-only code because vite.config.ts imports it too: the build preloads the first quote
 * request from index.html, and that only helps if its URL matches the app's request exactly.
 */

/** Shown first in the fund list and priced first on load. The other funds follow in the background. */
export const CORE_TICKERS = ["VT", "VOO", "VTI", "SPY", "VXUS"];

export const DEFAULT_FINANCE_ENDPOINT = "/.netlify/functions/finance";
export const DEFAULT_INFLATION_ENDPOINT = "/.netlify/functions/inflation";

/** The finance function's URL for `symbols`. `bucket` varies the URL once per refresh window, so a
 *  refresh gets past the CDN's cached copy while visitors in the same window still share one. */
export function quotesUrl(endpoint: string, symbols: readonly string[], bucket?: number): string {
  const params = new URLSearchParams({ symbols: symbols.join(","), range: "5y" });
  if (bucket !== undefined) params.set("t", String(bucket));
  return `${endpoint}?${params.toString()}`;
}

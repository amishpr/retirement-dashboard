/**
 * US inflation data from FRED (St. Louis Fed): annual CPI history, the latest 12-month change, and
 * what the bond market expects. The browser can't read FRED directly (no CORS headers), so this
 * proxies it and trims three CSVs down to a few KB of JSON.
 *
 * CPI is monthly and the market series are daily, so a 6-hour cache is plenty, and the CDN may
 * serve the last good copy for a day while it refetches. On failure the app keeps its built-in
 * copy (src/data/cpiHistory.ts), so a FRED outage never breaks the page.
 */
import { fetchInflationData } from "../lib/fred.mts";
import { allowedOrigin, jsonResponse } from "../lib/http.mts";

export default async (req: Request) => {
  const allowOrigin = allowedOrigin(req);
  try {
    const data = await fetchInflationData();
    return jsonResponse(data, { allowOrigin, maxAge: 21600, staleWhileRevalidate: 86400 });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "FRED request failed" }, { status: 502, allowOrigin });
  }
};

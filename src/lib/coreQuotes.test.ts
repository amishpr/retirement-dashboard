import assert from "node:assert/strict";
import { test } from "node:test";
import { ETF_OPTIONS } from "../data/etfs.ts";
import { CORE_TICKERS, quotesUrl } from "./coreQuotes.ts";

test("the core five are distinct preset funds", () => {
  assert.equal(new Set(CORE_TICKERS).size, 5);
  for (const ticker of CORE_TICKERS) {
    assert.ok(ETF_OPTIONS.some((f) => f.ticker === ticker), `${ticker} is a preset`);
  }
});

test("quotesUrl matches the preload link in index.html", () => {
  // vite.config.ts preloads this exact URL, and the browser only reuses the response for an exact match.
  assert.equal(
    quotesUrl("/.netlify/functions/finance", CORE_TICKERS),
    "/.netlify/functions/finance?symbols=VT%2CVOO%2CVTI%2CSPY%2CVXUS&range=5y",
  );
});

test("a refresh bucket varies the URL so it gets past the CDN's cached copy", () => {
  const url = quotesUrl("https://example.netlify.app/.netlify/functions/finance", ["QQQ"], 5_925_000);
  assert.equal(url, "https://example.netlify.app/.netlify/functions/finance?symbols=QQQ&range=5y&t=5925000");
});

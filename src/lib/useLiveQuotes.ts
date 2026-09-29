import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ETF_OPTIONS } from "../data/etfs";
import { CORE_TICKERS } from "./coreQuotes";
import { fetchLiveQuotes, newest, type LiveQuote, type LiveStatus } from "./liveData";

/** Matches the finance function's 5-minute cache, so each refresh can bring a newer quote. */
export const LIVE_REFRESH_MS = 5 * 60 * 1000;

/** How long to wait between tries while Yahoo can't be reached, before settling into the usual
 *  5-minute pace. Soon enough to recover from a blip, spaced out enough not to hammer an outage. */
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000];

/** Every preset that isn't one of the core five, fetched in the background after the first view. */
const REST_TICKERS = ETF_OPTIONS.map((f) => f.ticker).filter((t) => !CORE_TICKERS.includes(t));

/** Which refresh window it is. Refreshes send it along so they get past the CDN's cached copy. */
const refreshBucket = () => Math.floor(Date.now() / LIVE_REFRESH_MS);

/** Runs `fn` once the browser has a quiet moment. Safari has no requestIdleCallback, so it waits a
 *  beat instead. Returns a cancel function. */
export function whenIdle(fn: () => void, timeout = 2000): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 200);
  return () => window.clearTimeout(id);
}

const adding = (symbols: readonly string[]) => (set: ReadonlySet<string>) => new Set([...set, ...symbols]);

export interface LiveQuotes {
  quotes: Record<string, LiveQuote>;
  status: LiveStatus;
  /** Symbols whose first quote is still on its way. Their prices show a placeholder, not an average. */
  pending: ReadonlySet<string>;
  /** Starts the background request for the other presets now, if it hasn't started already. */
  loadRest: () => void;
}

/**
 * Live quotes, in stages so the first view isn't waiting on all of them:
 *
 * 1. On mount, the core five (one fixed URL, which index.html preloads and every visitor shares).
 * 2. Once `detailReady` says the lower cards are on screen and the browser is idle, the other
 *    presets. If the first request failed, the retries below pick them up instead.
 * 3. A ticker the visitor adds, by itself, as soon as it appears.
 *
 * It keeps them current without anyone asking:
 *
 * - An answer that's more than 5 minutes old (the CDN can serve an old copy while it re-fetches)
 *   is shown right away, then replaced by a fresh one fetched past the cache.
 * - Everything refreshes every 5 minutes while the tab is visible, and right away on coming back
 *   to a tab that missed its turn.
 * - While Yahoo can't be reached, it tries again after 30 seconds, 1 minute, and 2 minutes, then
 *   every 5 minutes, and at once when the browser comes back online.
 *
 * Live data is a progressive enhancement: until it arrives, or when it can't, every price falls
 * back to its built-in average and the status says so.
 */
export function useLiveQuotes({
  customTickers,
  detailReady,
  onQuotes,
}: {
  customTickers: string[];
  detailReady: boolean;
  /** Called with each batch of good quotes, e.g. to seed a new ticker's assumed return. */
  onQuotes?: (quotes: LiveQuote[]) => void;
}): LiveQuotes {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [status, setStatus] = useState<LiveStatus>({ state: "loading" });
  // Symbols whose first request has finished, well or badly. Everything else is still pending.
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set());
  const [coreLoaded, setCoreLoaded] = useState<boolean | undefined>(undefined);

  const alive = useRef(true);
  const hasLive = useRef(false);
  const onQuotesRef = useRef(onQuotes);
  const customRef = useRef(customTickers);
  const restRequested = useRef(false);
  const customRequested = useRef(new Set<string>());

  useEffect(() => {
    onQuotesRef.current = onQuotes;
    customRef.current = customTickers;
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Fetches `symbols` and merges what comes back. Resolves to whether any quote was good. A
   *  `bucket` fetches past the CDN's cached copy (see quotesUrl). */
  const load = useCallback(function load(symbols: readonly string[], bucket?: number): Promise<boolean> {
    if (symbols.length === 0) return Promise.resolve(false);
    // A failed request after a good load keeps the last good quotes and the "live" state; the
    // status line's times show how old they are.
    const markFailed = () => setStatus((prev) => (prev.state === "live" ? prev : { state: "offline" }));

    return fetchLiveQuotes(symbols, bucket)
      .then(({ results, fetchedAt }) => {
        if (!alive.current) return false;
        const good = results.filter((r) => r.ok);
        if (good.length === 0) {
          markFailed();
          return false;
        }
        hasLive.current = true;
        // Keyed by symbol, and never replaced by an older quote, so responses can land in any order.
        setQuotes((prev) => {
          const next = { ...prev };
          for (const q of good) {
            const old = prev[q.symbol];
            if (!old?.asOf || !q.asOf || q.asOf >= old.asOf) next[q.symbol] = q;
          }
          return next;
        });
        setStatus((prev) => {
          const was = prev.state === "live" ? prev : undefined;
          return {
            state: "live",
            fetchedAt: newest([was?.fetchedAt, fetchedAt]),
            asOf: newest([was?.asOf, ...good.map((q) => q.asOf)]),
          };
        });
        onQuotesRef.current?.(good);
        // The CDN keeps handing out its last copy for up to an hour while it re-fetches in the
        // background. That copy is still worth showing now, but a fresh one follows right behind.
        if (bucket === undefined && fetchedAt && Date.now() - Date.parse(fetchedAt) > LIVE_REFRESH_MS) {
          void load(symbols, refreshBucket());
        }
        return true;
      })
      .catch(() => {
        if (alive.current) markFailed();
        return false;
      })
      .finally(() => {
        if (alive.current) setSettled(adding(symbols));
      });
  }, []);

  const loadRest = useCallback(() => {
    if (restRequested.current) return;
    restRequested.current = true;
    void load(REST_TICKERS);
  }, [load]);

  /** Everything at once, fresh past the CDN's copy: core, the other presets, and custom tickers.
   *  Resolves to whether the core five came back. */
  const refreshAll = useCallback(() => {
    const bucket = refreshBucket();
    restRequested.current = true;
    void load(REST_TICKERS, bucket);
    void load(customRef.current, bucket);
    return load(CORE_TICKERS, bucket).then((ok) => {
      if (ok && alive.current) setCoreLoaded(true);
      return ok;
    });
  }, [load]);

  // Stage 1, then the refresh timer, the retries while offline, and the catch-ups.
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let retries = 0;
    // A turn the timer skipped because the tab was hidden, taken as soon as it's shown again.
    let due = false;

    function scheduleNext() {
      window.clearTimeout(timer);
      const delay = hasLive.current ? LIVE_REFRESH_MS : (RETRY_DELAYS_MS[retries++] ?? LIVE_REFRESH_MS);
      timer = window.setTimeout(() => {
        if (document.hidden) due = true;
        else run();
      }, delay);
    }
    function run() {
      due = false;
      window.clearTimeout(timer);
      void refreshAll().then(() => {
        if (!stopped) scheduleNext();
      });
    }

    void load(CORE_TICKERS).then((ok) => {
      if (stopped) return;
      setCoreLoaded(ok);
      // The other presets won't be asked for until a retry gets through, so they show their
      // averages now rather than a placeholder that could sit there for minutes.
      if (!ok) setSettled(adding(REST_TICKERS));
      scheduleNext();
    });

    const onVisible = () => {
      if (!document.hidden && due) run();
    };
    const onOnline = () => {
      if (!hasLive.current) run();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [load, refreshAll]);

  // Stage 2, once the first view is fully drawn.
  useEffect(() => {
    if (!coreLoaded || !detailReady) return;
    return whenIdle(loadRest);
  }, [coreLoaded, detailReady, loadRest]);

  // Stage 3: a ticker the visitor just added. Removing one forgets it, so adding it back asks again.
  const customKey = customTickers.join(",");
  useEffect(() => {
    const tickers = customKey ? customKey.split(",") : [];
    for (const t of customRequested.current) if (!tickers.includes(t)) customRequested.current.delete(t);
    const fresh = tickers.filter((t) => !customRequested.current.has(t));
    if (fresh.length === 0) return;
    for (const t of fresh) customRequested.current.add(t);
    void load(fresh);
  }, [customKey, load]);

  const pending = useMemo(() => {
    const tickers = [...CORE_TICKERS, ...REST_TICKERS, ...(customKey ? customKey.split(",") : [])];
    return new Set(tickers.filter((t) => !settled.has(t)));
  }, [settled, customKey]);

  return { quotes, status, pending, loadRest };
}

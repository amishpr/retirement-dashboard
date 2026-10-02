import { FALLBACK_PRICES_AS_OF } from "../data/etfs";
import { formatLocalTime, formatMarketTime, type LiveStatus } from "../lib/liveData";

/** A small status dot. The words beside it always say the same thing, so it's never color alone. */
export function StatusDot({ state }: { state: LiveStatus["state"] }) {
  if (state === "live") {
    return (
      <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inset-0 rounded-full bg-[var(--status-good)] opacity-60 motion-safe:animate-ping" />
        <span className="relative h-2 w-2 rounded-full bg-[var(--status-good)]" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`h-2 w-2 shrink-0 rounded-full ${
        state === "loading" ? "bg-ink-3/50 motion-safe:animate-pulse" : "border-[1.5px] border-ink-3"
      }`}
    />
  );
}

/**
 * Says where the fund prices come from and how fresh they are: live from Yahoo Finance, still
 * loading, or the built-in 12-month averages when Yahoo can't be reached.
 */
export function DataSource({ status }: { status: LiveStatus }) {
  const { title, detail, hint } =
    status.state === "live"
      ? {
          title: "Live from Yahoo Finance",
          detail: [
            status.asOf && `As of ${formatMarketTime(status.asOf)}`,
            status.fetchedAt && `updated ${formatLocalTime(status.fetchedAt)}`,
          ]
            .filter(Boolean)
            .join(" · "),
          hint: "Quotes can be delayed by up to 15 minutes, and refresh every 5 minutes while this page is open.",
        }
      : status.state === "loading"
        ? { title: "Checking Yahoo Finance…", detail: "Getting the latest prices", hint: undefined }
        : {
            title: "Live prices unavailable",
            detail: `Showing 12-month averages to ${FALLBACK_PRICES_AS_OF}`,
            hint: "Yahoo Finance couldn't be reached, so the page keeps trying in the background. Prices marked ~ are built-in averages, and projections use the same long-run returns either way.",
          };

  return (
    <div role="status" title={hint} className="flex items-start gap-2 text-xs leading-snug">
      <span className="flex h-[1lh] items-center">
        <StatusDot state={status.state} />
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-ink-2">{title}</span>
        {detail && <span className="block text-ink-3 tabular-nums">{detail}</span>}
      </span>
    </div>
  );
}

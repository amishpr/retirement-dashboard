import { useEffect, useState, type RefObject } from "react";
import { currencyFormatter } from "../lib/projection";
import { AnimatedNumber } from "./AnimatedNumber";

/**
 * On small screens the plan panel sits below the summary, so while you're editing inputs the
 * result you're changing is off screen. This bar keeps the projected balance in view whenever the
 * plan panel is visible and the summary isn't. IntersectionObserver, not a scroll listener, so it
 * costs nothing while scrolling. Hidden from lg up, where the summary is always beside the panel.
 */
export function MobileBalanceBar({
  planRef,
  summaryRef,
  balance,
  targetAge,
}: {
  planRef: RefObject<HTMLElement | null>;
  summaryRef: RefObject<HTMLElement | null>;
  balance: number;
  targetAge: number;
}) {
  const [planVisible, setPlanVisible] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(true);

  useEffect(() => {
    const plan = planRef.current;
    const summary = summaryRef.current;
    if (!plan || !summary) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === plan) setPlanVisible(entry.isIntersecting);
        else if (entry.target === summary) setSummaryVisible(entry.isIntersecting);
      }
    });
    observer.observe(plan);
    observer.observe(summary);
    return () => observer.disconnect();
  }, [planRef, summaryRef]);

  const show = planVisible && !summaryVisible;

  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-10 border-t border-line bg-panel px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-float transition-[transform,opacity] duration-200 ease-out lg:hidden print:hidden ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] text-ink-3">Projected balance at {targetAge}</span>
        <span className="text-lg font-semibold tracking-[-0.02em] text-ink">
          <AnimatedNumber value={balance} formatter={(v) => currencyFormatter.format(v)} />
        </span>
      </div>
    </div>
  );
}

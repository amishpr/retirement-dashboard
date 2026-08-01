import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/** Shared Recharts styling, so every chart has the same recessive axes and gridlines. */

/** Numeric ticks are set in the mono face so digits line up down an axis. */
export const numberTick = { fill: "var(--ink-3)", fontSize: 12, fontFamily: "var(--font-mono)" };
export const labelTick = { fill: "var(--ink-2)", fontSize: 12 };

export const xAxisProps = {
  tickLine: false,
  axisLine: { stroke: "var(--line-strong)" },
  tick: numberTick,
  tickMargin: 8,
} as const;

export const yAxisProps = {
  tickLine: false,
  axisLine: false,
  tick: numberTick,
} as const;

export const gridProps = { stroke: "var(--line)", vertical: false } as const;

export const lineCursor = { stroke: "var(--line-strong)", strokeWidth: 1 };
export const bandCursor = { fill: "var(--ink)", fillOpacity: 0.04 };

const trimZero = (n: number) => Number(n.toFixed(1)).toString();

/** Compact money for axis ticks: $0, $350K, $1.4M, never "$0.0" or "$350.0K". */
export function formatAxisMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${trimZero(value / 1e9)}B`;
  if (abs >= 1e6) return `$${trimZero(value / 1e6)}M`;
  if (abs >= 1e3) return `$${trimZero(value / 1e3)}K`;
  return `$${Math.round(value)}`;
}

export const formatAxisPercent = (value: number) => `${trimZero(value)}%`;

/** Round-number ticks from 0 to just past `max`, stepping by 1, 2, 2.5 or 5 times a power of ten. */
export function niceTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const count = Math.ceil(max / step - 1e-9);
  return Array.from({ length: count + 1 }, (_, i) => Number((i * step).toPrecision(12)));
}

/** How long a chart's one-time draw-in takes. */
export const REVEAL_MS = 900;

/**
 * True for the first REVEAL_MS after a chart mounts, then false for good. Recharts replays its
 * animation on every data change while isAnimationActive is on, so leaving it on made every slider
 * drag restart a full draw-in. This plays it once per mount (switching tabs remounts a chart, so
 * each view still draws in when you open it) and never for reduced-motion visitors.
 */
export function useMountReveal(): boolean {
  const reduce = useReducedMotion();
  const [revealing, setRevealing] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setRevealing(false), REVEAL_MS + 100);
    return () => clearTimeout(timer);
  }, []);
  return revealing && !reduce;
}

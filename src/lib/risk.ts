import type { RiskLabel } from "../data/etfs";

/** Mirrors the bucketing in netlify/functions/finance.mts so static and live risk labels agree. */
export function classifyRisk(volatility: number): RiskLabel {
  if (volatility < 0.12) return "Low";
  if (volatility < 0.22) return "Medium";
  if (volatility < 0.35) return "High";
  return "Very High";
}

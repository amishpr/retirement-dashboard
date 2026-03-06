import type { EtfOption } from "../data/etfs";

export interface AllocationEntry {
  ticker: string;
  weight: number;
}

export interface PortfolioMixRow {
  ticker: string;
  name: string;
  weight: number;
}

/**
 * Weighted-average return across a mix of funds. Weights don't need to sum to 100 — they're
 * normalized. An allocation whose ticker has no matching fund is excluded from both the sum and
 * the weight total, rather than silently counting as a 0%-return position.
 */
export function computeBlendedReturn(allocations: AllocationEntry[], allFunds: EtfOption[]): number {
  const known = allocations
    .map((a) => ({ weight: Math.max(0, a.weight), fund: allFunds.find((f) => f.ticker === a.ticker) }))
    .filter((row): row is { weight: number; fund: EtfOption } => !!row.fund);

  const totalWeight = known.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) return 0;

  const weightedSum = known.reduce((sum, row) => sum + row.fund.avgReturn * row.weight, 0);
  return weightedSum / totalWeight;
}

/**
 * Naive weighted-average volatility across a mix, using each fund's volatility if known.
 * This ignores correlation between holdings, so it overstates real portfolio risk — true
 * portfolio volatility is usually lower thanks to diversification. Returns undefined if no
 * fund in the mix has a known volatility figure.
 */
export function computeBlendedVolatility(
  allocations: AllocationEntry[],
  getVolatility: (ticker: string) => number | undefined,
): number | undefined {
  const known = allocations
    .map((a) => ({ weight: Math.max(0, a.weight), volatility: getVolatility(a.ticker) }))
    .filter((row): row is { weight: number; volatility: number } => row.volatility !== undefined);

  const totalWeight = known.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) return undefined;

  return known.reduce((sum, row) => sum + row.volatility * row.weight, 0) / totalWeight;
}

/** Adds a fund to the mix, giving it an equal share and proportionally shrinking the rest so the total stays exactly 100. */
export function addFundToMix(allocations: AllocationEntry[], ticker: string): AllocationEntry[] {
  const n = allocations.length;
  if (n === 0) return [{ ticker, weight: 100 }];

  const newShare = 100 / (n + 1);
  const currentTotal = allocations.reduce((sum, a) => sum + a.weight, 0) || 100;
  const scale = (100 - newShare) / currentTotal;
  const rescaled = allocations.map((a) => ({ ...a, weight: a.weight * scale }));
  return [...rescaled, { ticker, weight: newShare }];
}

/** Removes a fund from the mix, proportionally scaling the rest up to fill the freed-up share so the total stays exactly 100. */
export function removeFundFromMix(allocations: AllocationEntry[], ticker: string): AllocationEntry[] {
  const remaining = allocations.filter((a) => a.ticker !== ticker);
  if (remaining.length === 0) return [];

  const remainingTotal = remaining.reduce((sum, a) => sum + a.weight, 0);
  if (remainingTotal <= 0) {
    const share = 100 / remaining.length;
    return remaining.map((a) => ({ ...a, weight: share }));
  }

  const scale = 100 / remainingTotal;
  return remaining.map((a) => ({ ...a, weight: a.weight * scale }));
}

/**
 * Sets one fund's weight to a dragged value and proportionally redistributes the remainder across
 * the other funds (relative to their current weights), so the total always stays exactly 100.
 */
export function updateMixWeight(allocations: AllocationEntry[], ticker: string, weight: number): AllocationEntry[] {
  const clamped = Math.max(0, Math.min(100, weight));
  const others = allocations.filter((a) => a.ticker !== ticker);

  if (others.length === 0) {
    return allocations.map((a) => (a.ticker === ticker ? { ...a, weight: 100 } : a));
  }

  const remaining = 100 - clamped;
  const othersTotal = others.reduce((sum, a) => sum + a.weight, 0);
  const nextOthers = new Map(
    othersTotal > 0
      ? others.map((a) => [a.ticker, (a.weight / othersTotal) * remaining] as const)
      : others.map((a) => [a.ticker, remaining / others.length] as const),
  );

  return allocations.map((a) => (a.ticker === ticker ? { ...a, weight: clamped } : { ...a, weight: nextOthers.get(a.ticker)! }));
}

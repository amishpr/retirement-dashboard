import type { AllocationEntry } from "../lib/portfolio";

export interface TopHolding {
  name: string;
  weight: number;
}

export interface SectorWeight {
  name: string;
  weight: number;
}

export interface FundComposition {
  /** Top holdings by weight (decimal), largest first. Not exhaustive — the rest rolls into "Other". */
  topHoldings: TopHolding[];
  /** Approximate total number of positions in the fund, for the "Other (N holdings)" label. */
  holdingsCount: number;
  /** Approximate domestic (US) vs. international split, as decimals summing to 1. */
  domestic: number;
  international: number;
  /** GICS-style sector breakdown (decimal weights). Undefined for bond funds — sectors don't apply. */
  sectorWeightings?: SectorWeight[];
}

/** Sum of the listed top holdings' weights — how concentrated the fund is in its largest positions. */
export function getTopHoldingsConcentration(composition: FundComposition): number {
  return composition.topHoldings.reduce((sum, h) => sum + h.weight, 0);
}

/**
 * Approximate, illustrative fund composition — not live holdings data. Real Yahoo Finance holdings
 * data requires a crumb/cookie-authenticated endpoint that's heavily rate-limited and unreliable
 * for a serverless proxy, so this is a static snapshot that will drift from the fund's actual
 * current composition over time.
 */
export const FUND_COMPOSITION: Record<string, FundComposition> = {
  VOO: {
    topHoldings: [
      { name: "Apple", weight: 0.071 },
      { name: "Microsoft", weight: 0.067 },
      { name: "Nvidia", weight: 0.06 },
      { name: "Amazon", weight: 0.038 },
      { name: "Meta Platforms", weight: 0.026 },
      { name: "Alphabet (Class A)", weight: 0.022 },
      { name: "Broadcom", weight: 0.021 },
      { name: "Alphabet (Class C)", weight: 0.018 },
      { name: "Berkshire Hathaway", weight: 0.016 },
      { name: "Tesla", weight: 0.015 },
    ],
    holdingsCount: 503,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.32 },
      { name: "Financials", weight: 0.13 },
      { name: "Healthcare", weight: 0.11 },
      { name: "Consumer Discretionary", weight: 0.1 },
      { name: "Communication Services", weight: 0.09 },
      { name: "Industrials", weight: 0.08 },
      { name: "Consumer Staples", weight: 0.06 },
      { name: "Energy", weight: 0.03 },
      { name: "Utilities", weight: 0.025 },
      { name: "Real Estate", weight: 0.02 },
      { name: "Materials", weight: 0.02 },
    ],
  },
  SPY: {
    topHoldings: [
      { name: "Apple", weight: 0.071 },
      { name: "Microsoft", weight: 0.067 },
      { name: "Nvidia", weight: 0.06 },
      { name: "Amazon", weight: 0.038 },
      { name: "Meta Platforms", weight: 0.026 },
      { name: "Alphabet (Class A)", weight: 0.022 },
      { name: "Broadcom", weight: 0.021 },
      { name: "Alphabet (Class C)", weight: 0.018 },
      { name: "Berkshire Hathaway", weight: 0.016 },
      { name: "Tesla", weight: 0.015 },
    ],
    holdingsCount: 503,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.32 },
      { name: "Financials", weight: 0.13 },
      { name: "Healthcare", weight: 0.11 },
      { name: "Consumer Discretionary", weight: 0.1 },
      { name: "Communication Services", weight: 0.09 },
      { name: "Industrials", weight: 0.08 },
      { name: "Consumer Staples", weight: 0.06 },
      { name: "Energy", weight: 0.03 },
      { name: "Utilities", weight: 0.025 },
      { name: "Real Estate", weight: 0.02 },
      { name: "Materials", weight: 0.02 },
    ],
  },
  VTI: {
    topHoldings: [
      { name: "Apple", weight: 0.06 },
      { name: "Microsoft", weight: 0.056 },
      { name: "Nvidia", weight: 0.052 },
      { name: "Amazon", weight: 0.033 },
      { name: "Meta Platforms", weight: 0.023 },
      { name: "Alphabet (Class A)", weight: 0.019 },
      { name: "Broadcom", weight: 0.018 },
      { name: "Alphabet (Class C)", weight: 0.016 },
      { name: "Berkshire Hathaway", weight: 0.014 },
      { name: "Tesla", weight: 0.013 },
    ],
    holdingsCount: 3600,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.31 },
      { name: "Financials", weight: 0.135 },
      { name: "Healthcare", weight: 0.11 },
      { name: "Consumer Discretionary", weight: 0.105 },
      { name: "Industrials", weight: 0.09 },
      { name: "Communication Services", weight: 0.08 },
      { name: "Consumer Staples", weight: 0.055 },
      { name: "Energy", weight: 0.035 },
      { name: "Real Estate", weight: 0.03 },
      { name: "Utilities", weight: 0.025 },
      { name: "Materials", weight: 0.025 },
    ],
  },
  QQQ: {
    topHoldings: [
      { name: "Apple", weight: 0.085 },
      { name: "Microsoft", weight: 0.08 },
      { name: "Nvidia", weight: 0.075 },
      { name: "Broadcom", weight: 0.05 },
      { name: "Amazon", weight: 0.048 },
      { name: "Meta Platforms", weight: 0.038 },
      { name: "Netflix", weight: 0.03 },
      { name: "Alphabet (Class A)", weight: 0.028 },
      { name: "Alphabet (Class C)", weight: 0.026 },
      { name: "Costco", weight: 0.024 },
    ],
    holdingsCount: 101,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.58 },
      { name: "Communication Services", weight: 0.15 },
      { name: "Consumer Discretionary", weight: 0.13 },
      { name: "Healthcare", weight: 0.06 },
      { name: "Consumer Staples", weight: 0.04 },
      { name: "Industrials", weight: 0.03 },
      { name: "Utilities", weight: 0.01 },
    ],
  },
  SCHD: {
    topHoldings: [
      { name: "AbbVie", weight: 0.045 },
      { name: "Chevron", weight: 0.043 },
      { name: "Home Depot", weight: 0.042 },
      { name: "Verizon", weight: 0.04 },
      { name: "PepsiCo", weight: 0.039 },
      { name: "Coca-Cola", weight: 0.038 },
      { name: "Cisco Systems", weight: 0.037 },
      { name: "Altria Group", weight: 0.036 },
      { name: "Amgen", weight: 0.035 },
      { name: "Texas Instruments", weight: 0.034 },
    ],
    holdingsCount: 104,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Financials", weight: 0.18 },
      { name: "Healthcare", weight: 0.15 },
      { name: "Consumer Staples", weight: 0.14 },
      { name: "Industrials", weight: 0.13 },
      { name: "Energy", weight: 0.1 },
      { name: "Technology", weight: 0.09 },
      { name: "Communication Services", weight: 0.08 },
      { name: "Consumer Discretionary", weight: 0.06 },
      { name: "Materials", weight: 0.04 },
      { name: "Utilities", weight: 0.03 },
    ],
  },
  VT: {
    topHoldings: [
      { name: "Apple", weight: 0.04 },
      { name: "Microsoft", weight: 0.038 },
      { name: "Nvidia", weight: 0.035 },
      { name: "Amazon", weight: 0.021 },
      { name: "Meta Platforms", weight: 0.014 },
      { name: "Alphabet (Class A)", weight: 0.012 },
      { name: "Broadcom", weight: 0.011 },
      { name: "Alphabet (Class C)", weight: 0.01 },
      { name: "Taiwan Semiconductor", weight: 0.009 },
      { name: "Berkshire Hathaway", weight: 0.009 },
    ],
    holdingsCount: 9700,
    domestic: 0.62,
    international: 0.38,
    sectorWeightings: [
      { name: "Technology", weight: 0.26 },
      { name: "Financials", weight: 0.16 },
      { name: "Industrials", weight: 0.11 },
      { name: "Healthcare", weight: 0.1 },
      { name: "Consumer Discretionary", weight: 0.1 },
      { name: "Communication Services", weight: 0.07 },
      { name: "Consumer Staples", weight: 0.06 },
      { name: "Energy", weight: 0.04 },
      { name: "Materials", weight: 0.04 },
      { name: "Utilities", weight: 0.03 },
      { name: "Real Estate", weight: 0.03 },
    ],
  },
  VXUS: {
    topHoldings: [
      { name: "Taiwan Semiconductor", weight: 0.025 },
      { name: "SAP", weight: 0.01 },
      { name: "Novo Nordisk", weight: 0.009 },
      { name: "ASML Holding", weight: 0.009 },
      { name: "Tencent Holdings", weight: 0.008 },
      { name: "Samsung Electronics", weight: 0.008 },
      { name: "Nestle", weight: 0.007 },
      { name: "AstraZeneca", weight: 0.007 },
      { name: "Toyota Motor", weight: 0.006 },
      { name: "Shell", weight: 0.006 },
    ],
    holdingsCount: 8500,
    domestic: 0,
    international: 1,
    sectorWeightings: [
      { name: "Financials", weight: 0.21 },
      { name: "Industrials", weight: 0.15 },
      { name: "Technology", weight: 0.13 },
      { name: "Healthcare", weight: 0.1 },
      { name: "Consumer Discretionary", weight: 0.1 },
      { name: "Consumer Staples", weight: 0.08 },
      { name: "Materials", weight: 0.07 },
      { name: "Communication Services", weight: 0.06 },
      { name: "Energy", weight: 0.05 },
      { name: "Utilities", weight: 0.03 },
      { name: "Real Estate", weight: 0.02 },
    ],
  },
  // Bond funds hold thousands of individual issues with no single meaningful "top holding," so
  // these use broad sector categories instead of company/security names — a "top 10" of actual
  // bond issues wouldn't be meaningful (each is a tiny, roughly interchangeable fraction of a
  // percent) or reliably knowable without live holdings data.
  BND: {
    topHoldings: [
      { name: "US Treasury bonds", weight: 0.46 },
      { name: "Corporate bonds", weight: 0.24 },
      { name: "Mortgage-backed securities", weight: 0.21 },
    ],
    holdingsCount: 11000,
    domestic: 1,
    international: 0,
  },
  AGG: {
    topHoldings: [
      { name: "US Treasury bonds", weight: 0.44 },
      { name: "Mortgage-backed securities", weight: 0.26 },
      { name: "Corporate bonds", weight: 0.25 },
    ],
    holdingsCount: 13000,
    domestic: 1,
    international: 0,
  },
  SPLV: {
    topHoldings: [
      { name: "Coca-Cola", weight: 0.013 },
      { name: "Procter & Gamble", weight: 0.012 },
      { name: "Duke Energy", weight: 0.011 },
      { name: "Waste Management", weight: 0.011 },
      { name: "Southern Company", weight: 0.011 },
      { name: "Consolidated Edison", weight: 0.01 },
      { name: "American Water Works", weight: 0.01 },
      { name: "Kimberly-Clark", weight: 0.01 },
      { name: "McDonald's", weight: 0.01 },
      { name: "Colgate-Palmolive", weight: 0.009 },
    ],
    holdingsCount: 100,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Utilities", weight: 0.2 },
      { name: "Consumer Staples", weight: 0.18 },
      { name: "Healthcare", weight: 0.15 },
      { name: "Financials", weight: 0.12 },
      { name: "Industrials", weight: 0.1 },
      { name: "Real Estate", weight: 0.08 },
      { name: "Materials", weight: 0.07 },
      { name: "Communication Services", weight: 0.05 },
      { name: "Consumer Discretionary", weight: 0.03 },
      { name: "Energy", weight: 0.02 },
    ],
  },
};

export function getFundComposition(ticker: string): FundComposition | undefined {
  return FUND_COMPOSITION[ticker];
}

/** Weight-blends the composition of every fund in a portfolio mix that has known composition data. */
export function aggregatePortfolioComposition(
  allocations: AllocationEntry[],
): { composition: FundComposition; coveredWeight: number } | undefined {
  const totalWeight = allocations.reduce((sum, a) => sum + Math.max(0, a.weight), 0);
  if (totalWeight <= 0) return undefined;

  const known = allocations
    .map((a) => ({ allocation: a, composition: getFundComposition(a.ticker) }))
    .filter((row): row is { allocation: AllocationEntry; composition: FundComposition } => !!row.composition);

  if (known.length === 0) return undefined;

  const coveredWeight = known.reduce((sum, row) => sum + Math.max(0, row.allocation.weight), 0);

  let domestic = 0;
  let international = 0;
  const holdingMap = new Map<string, number>();
  let holdingsCount = 0;

  for (const { allocation, composition } of known) {
    const share = Math.max(0, allocation.weight) / coveredWeight;
    domestic += composition.domestic * share;
    international += composition.international * share;
    holdingsCount += composition.holdingsCount * share;
    for (const holding of composition.topHoldings) {
      holdingMap.set(holding.name, (holdingMap.get(holding.name) ?? 0) + holding.weight * share);
    }
  }

  const topHoldings = Array.from(holdingMap.entries())
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  // Blend sectors only across the slice of the mix that has sector data (e.g. bond funds don't),
  // renormalized so it reads as "sector mix of your equity holdings," not diluted by silence.
  const knownSectors = known.filter((row) => row.composition.sectorWeightings);
  const sectorCoveredWeight = knownSectors.reduce((sum, row) => sum + Math.max(0, row.allocation.weight), 0);
  let sectorWeightings: SectorWeight[] | undefined;
  if (sectorCoveredWeight > 0) {
    const sectorMap = new Map<string, number>();
    for (const { allocation, composition } of knownSectors) {
      const share = Math.max(0, allocation.weight) / sectorCoveredWeight;
      for (const sector of composition.sectorWeightings ?? []) {
        sectorMap.set(sector.name, (sectorMap.get(sector.name) ?? 0) + sector.weight * share);
      }
    }
    sectorWeightings = Array.from(sectorMap.entries())
      .map(([name, weight]) => ({ name, weight }))
      .sort((a, b) => b.weight - a.weight);
  }

  return {
    composition: { topHoldings, holdingsCount: Math.round(holdingsCount), domestic, international, sectorWeightings },
    coveredWeight,
  };
}

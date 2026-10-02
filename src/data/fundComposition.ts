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
 * Approximate fund composition, not live holdings data. Stock funds are a snapshot of Yahoo Finance
 * fund profiles from late September 2026, and bond funds come from the issuers' fact sheets. Live
 * holdings need Yahoo's crumb and cookie endpoint, which is too rate-limited for a serverless proxy,
 * so this snapshot drifts from each fund's actual holdings over time. Refresh it now and then.
 */
export const FUND_COMPOSITION: Record<string, FundComposition> = {
  VOO: {
    topHoldings: [
      { name: "Nvidia", weight: 0.081 },
      { name: "Apple", weight: 0.07 },
      { name: "Microsoft", weight: 0.057 },
      { name: "Amazon", weight: 0.038 },
      { name: "Alphabet (Class A)", weight: 0.03 },
      { name: "Broadcom", weight: 0.027 },
      { name: "Alphabet (Class C)", weight: 0.024 },
      { name: "Meta Platforms", weight: 0.019 },
      { name: "Micron Technology", weight: 0.016 },
      { name: "Tesla", weight: 0.016 },
    ],
    holdingsCount: 503,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.387 },
      { name: "Financials", weight: 0.12 },
      { name: "Communication Services", weight: 0.095 },
      { name: "Consumer Discretionary", weight: 0.093 },
      { name: "Healthcare", weight: 0.093 },
      { name: "Industrials", weight: 0.077 },
      { name: "Consumer Staples", weight: 0.045 },
      { name: "Energy", weight: 0.035 },
      { name: "Utilities", weight: 0.02 },
      { name: "Real Estate", weight: 0.018 },
      { name: "Materials", weight: 0.017 },
    ],
  },
  SPY: {
    topHoldings: [
      { name: "Nvidia", weight: 0.081 },
      { name: "Apple", weight: 0.07 },
      { name: "Microsoft", weight: 0.057 },
      { name: "Amazon", weight: 0.038 },
      { name: "Alphabet (Class A)", weight: 0.03 },
      { name: "Broadcom", weight: 0.026 },
      { name: "Alphabet (Class C)", weight: 0.024 },
      { name: "Meta Platforms", weight: 0.019 },
      { name: "Micron Technology", weight: 0.016 },
      { name: "Tesla", weight: 0.016 },
    ],
    holdingsCount: 503,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.387 },
      { name: "Financials", weight: 0.121 },
      { name: "Communication Services", weight: 0.095 },
      { name: "Consumer Discretionary", weight: 0.093 },
      { name: "Healthcare", weight: 0.093 },
      { name: "Industrials", weight: 0.077 },
      { name: "Consumer Staples", weight: 0.045 },
      { name: "Energy", weight: 0.035 },
      { name: "Utilities", weight: 0.02 },
      { name: "Real Estate", weight: 0.018 },
      { name: "Materials", weight: 0.017 },
    ],
  },
  VTI: {
    topHoldings: [
      { name: "Nvidia", weight: 0.069 },
      { name: "Apple", weight: 0.063 },
      { name: "Microsoft", weight: 0.051 },
      { name: "Amazon", weight: 0.034 },
      { name: "Alphabet (Class A)", weight: 0.027 },
      { name: "Broadcom", weight: 0.024 },
      { name: "Alphabet (Class C)", weight: 0.021 },
      { name: "Meta Platforms", weight: 0.017 },
      { name: "Micron Technology", weight: 0.015 },
      { name: "Tesla", weight: 0.014 },
    ],
    holdingsCount: 3600,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.364 },
      { name: "Financials", weight: 0.124 },
      { name: "Healthcare", weight: 0.101 },
      { name: "Consumer Discretionary", weight: 0.092 },
      { name: "Industrials", weight: 0.091 },
      { name: "Communication Services", weight: 0.088 },
      { name: "Consumer Staples", weight: 0.043 },
      { name: "Energy", weight: 0.037 },
      { name: "Real Estate", weight: 0.023 },
      { name: "Utilities", weight: 0.02 },
      { name: "Materials", weight: 0.019 },
    ],
  },
  QQQ: {
    topHoldings: [
      { name: "Nvidia", weight: 0.085 },
      { name: "Apple", weight: 0.074 },
      { name: "Microsoft", weight: 0.06 },
      { name: "Micron Technology", weight: 0.048 },
      { name: "Amazon", weight: 0.044 },
      { name: "AMD", weight: 0.034 },
      { name: "Alphabet (Class A)", weight: 0.031 },
      { name: "Tesla", weight: 0.029 },
      { name: "Alphabet (Class C)", weight: 0.029 },
      { name: "Broadcom", weight: 0.028 },
    ],
    holdingsCount: 101,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.592 },
      { name: "Communication Services", weight: 0.127 },
      { name: "Consumer Discretionary", weight: 0.111 },
      { name: "Consumer Staples", weight: 0.062 },
      { name: "Healthcare", weight: 0.04 },
      { name: "Industrials", weight: 0.039 },
      { name: "Utilities", weight: 0.011 },
      { name: "Materials", weight: 0.01 },
      { name: "Energy", weight: 0.005 },
    ],
  },
  SCHD: {
    topHoldings: [
      { name: "Merck", weight: 0.048 },
      { name: "Abbott Laboratories", weight: 0.048 },
      { name: "Amgen", weight: 0.047 },
      { name: "Coca-Cola", weight: 0.042 },
      { name: "Verizon Communications", weight: 0.04 },
      { name: "Chevron", weight: 0.039 },
      { name: "Home Depot", weight: 0.039 },
      { name: "ConocoPhillips", weight: 0.039 },
      { name: "UnitedHealth Group", weight: 0.038 },
      { name: "Procter & Gamble", weight: 0.038 },
    ],
    holdingsCount: 104,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Healthcare", weight: 0.215 },
      { name: "Consumer Staples", weight: 0.195 },
      { name: "Energy", weight: 0.154 },
      { name: "Technology", weight: 0.129 },
      { name: "Financials", weight: 0.098 },
      { name: "Industrials", weight: 0.075 },
      { name: "Consumer Discretionary", weight: 0.069 },
      { name: "Communication Services", weight: 0.065 },
    ],
  },
  VT: {
    topHoldings: [
      { name: "Nvidia", weight: 0.043 },
      { name: "Apple", weight: 0.038 },
      { name: "Microsoft", weight: 0.032 },
      { name: "Amazon", weight: 0.021 },
      { name: "Alphabet (Class A)", weight: 0.017 },
      { name: "Taiwan Semiconductor", weight: 0.015 },
      { name: "Broadcom", weight: 0.014 },
      { name: "Alphabet (Class C)", weight: 0.013 },
      { name: "Meta Platforms", weight: 0.011 },
      { name: "Micron Technology", weight: 0.009 },
    ],
    holdingsCount: 9700,
    domestic: 0.62,
    international: 0.38,
    sectorWeightings: [
      { name: "Technology", weight: 0.303 },
      { name: "Financials", weight: 0.165 },
      { name: "Industrials", weight: 0.111 },
      { name: "Consumer Discretionary", weight: 0.09 },
      { name: "Healthcare", weight: 0.086 },
      { name: "Communication Services", weight: 0.073 },
      { name: "Consumer Staples", weight: 0.045 },
      { name: "Materials", weight: 0.041 },
      { name: "Energy", weight: 0.041 },
      { name: "Utilities", weight: 0.023 },
      { name: "Real Estate", weight: 0.023 },
    ],
  },
  VXUS: {
    topHoldings: [
      { name: "Taiwan Semiconductor", weight: 0.04 },
      { name: "Samsung Electronics", weight: 0.019 },
      { name: "SK hynix", weight: 0.015 },
      { name: "ASML Holding", weight: 0.014 },
      { name: "Tencent Holdings", weight: 0.008 },
      { name: "HSBC Holdings", weight: 0.008 },
      { name: "Roche Holding", weight: 0.007 },
      { name: "Royal Bank of Canada", weight: 0.006 },
      { name: "Novartis", weight: 0.006 },
      { name: "Alibaba Group Holding", weight: 0.006 },
    ],
    holdingsCount: 8500,
    domestic: 0,
    international: 1,
    sectorWeightings: [
      { name: "Financials", weight: 0.233 },
      { name: "Technology", weight: 0.199 },
      { name: "Industrials", weight: 0.151 },
      { name: "Consumer Discretionary", weight: 0.081 },
      { name: "Materials", weight: 0.077 },
      { name: "Healthcare", weight: 0.069 },
      { name: "Consumer Staples", weight: 0.048 },
      { name: "Energy", weight: 0.048 },
      { name: "Communication Services", weight: 0.043 },
      { name: "Utilities", weight: 0.029 },
      { name: "Real Estate", weight: 0.023 },
    ],
  },
  // Bond funds hold thousands of individual issues with no single meaningful "top holding," so
  // these use broad sector categories instead of company/security names — a "top 10" of actual
  // bond issues wouldn't be meaningful (each is a tiny, roughly interchangeable fraction of a
  // percent) or reliably knowable without live holdings data.
  BND: {
    topHoldings: [
      { name: "US Treasury bonds", weight: 0.46 },
      { name: "Corporate bonds", weight: 0.25 },
      { name: "Mortgage-backed securities", weight: 0.21 },
    ],
    holdingsCount: 11000,
    domestic: 1,
    international: 0,
  },
  AGG: {
    topHoldings: [
      { name: "US Treasury bonds", weight: 0.46 },
      { name: "Corporate bonds", weight: 0.25 },
      { name: "Mortgage-backed securities", weight: 0.24 },
    ],
    holdingsCount: 13000,
    domestic: 1,
    international: 0,
  },
  SPLV: {
    topHoldings: [
      { name: "Berkshire Hathaway", weight: 0.014 },
      { name: "WEC Energy Group", weight: 0.013 },
      { name: "Duke Energy", weight: 0.013 },
      { name: "Regency Centers", weight: 0.013 },
      { name: "FirstEnergy", weight: 0.012 },
      { name: "Atmos Energy", weight: 0.012 },
      { name: "Evergy", weight: 0.012 },
      { name: "Alliant Energy", weight: 0.012 },
      { name: "Realty Income", weight: 0.012 },
      { name: "CenterPoint Energy", weight: 0.012 },
    ],
    holdingsCount: 100,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Utilities", weight: 0.268 },
      { name: "Financials", weight: 0.238 },
      { name: "Real Estate", weight: 0.172 },
      { name: "Industrials", weight: 0.13 },
      { name: "Consumer Staples", weight: 0.068 },
      { name: "Consumer Discretionary", weight: 0.038 },
      { name: "Healthcare", weight: 0.038 },
      { name: "Energy", weight: 0.029 },
      { name: "Materials", weight: 0.021 },
    ],
  },
  // Added Sep 2026 from Yahoo Finance's fund holdings. Holding counts and the US/international split
  // are rounded approximations, like the rest of this file.
  VUG: {
    topHoldings: [
      { name: "Nvidia", weight: 0.136 },
      { name: "Apple", weight: 0.125 },
      { name: "Microsoft", weight: 0.101 },
      { name: "Alphabet (Class A)", weight: 0.053 },
      { name: "Amazon", weight: 0.048 },
      { name: "Alphabet (Class C)", weight: 0.042 },
      { name: "Broadcom", weight: 0.041 },
      { name: "Meta Platforms", weight: 0.034 },
      { name: "Tesla", weight: 0.028 },
      { name: "Eli Lilly", weight: 0.026 },
    ],
    holdingsCount: 160,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.578 },
      { name: "Communication Services", weight: 0.145 },
      { name: "Consumer Discretionary", weight: 0.113 },
      { name: "Healthcare", weight: 0.046 },
      { name: "Industrials", weight: 0.045 },
      { name: "Financials", weight: 0.042 },
      { name: "Consumer Staples", weight: 0.013 },
      { name: "Real Estate", weight: 0.01 },
      { name: "Materials", weight: 0.005 },
    ],
  },
  SCHB: {
    topHoldings: [
      { name: "Nvidia", weight: 0.071 },
      { name: "Apple", weight: 0.063 },
      { name: "Microsoft", weight: 0.051 },
      { name: "Amazon", weight: 0.035 },
      { name: "Alphabet (Class A)", weight: 0.027 },
      { name: "Broadcom", weight: 0.023 },
      { name: "Alphabet (Class C)", weight: 0.022 },
      { name: "Meta Platforms", weight: 0.017 },
      { name: "Micron Technology", weight: 0.014 },
      { name: "Tesla", weight: 0.013 },
    ],
    holdingsCount: 2400,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.365 },
      { name: "Financials", weight: 0.124 },
      { name: "Healthcare", weight: 0.099 },
      { name: "Consumer Discretionary", weight: 0.093 },
      { name: "Industrials", weight: 0.089 },
      { name: "Communication Services", weight: 0.089 },
      { name: "Consumer Staples", weight: 0.043 },
      { name: "Energy", weight: 0.036 },
      { name: "Real Estate", weight: 0.023 },
      { name: "Utilities", weight: 0.02 },
      { name: "Materials", weight: 0.019 },
    ],
  },
  ACWI: {
    topHoldings: [
      { name: "Nvidia", weight: 0.049 },
      { name: "Apple", weight: 0.045 },
      { name: "Microsoft", weight: 0.034 },
      { name: "Amazon", weight: 0.024 },
      { name: "Alphabet (Class A)", weight: 0.019 },
      { name: "Taiwan Semiconductor", weight: 0.018 },
      { name: "Broadcom", weight: 0.016 },
      { name: "Alphabet (Class C)", weight: 0.015 },
      { name: "Meta Platforms", weight: 0.012 },
      { name: "Micron Technology", weight: 0.01 },
    ],
    holdingsCount: 2300,
    domestic: 0.64,
    international: 0.36,
    sectorWeightings: [
      { name: "Technology", weight: 0.322 },
      { name: "Financials", weight: 0.166 },
      { name: "Industrials", weight: 0.102 },
      { name: "Consumer Discretionary", weight: 0.086 },
      { name: "Healthcare", weight: 0.085 },
      { name: "Communication Services", weight: 0.078 },
      { name: "Consumer Staples", weight: 0.046 },
      { name: "Energy", weight: 0.04 },
      { name: "Materials", weight: 0.036 },
      { name: "Utilities", weight: 0.023 },
      { name: "Real Estate", weight: 0.015 },
    ],
  },
  URTH: {
    topHoldings: [
      { name: "Nvidia", weight: 0.055 },
      { name: "Apple", weight: 0.051 },
      { name: "Microsoft", weight: 0.039 },
      { name: "Amazon", weight: 0.027 },
      { name: "Alphabet (Class A)", weight: 0.022 },
      { name: "Broadcom", weight: 0.018 },
      { name: "Alphabet (Class C)", weight: 0.017 },
      { name: "Meta Platforms", weight: 0.014 },
      { name: "Micron Technology", weight: 0.012 },
      { name: "Tesla", weight: 0.011 },
    ],
    holdingsCount: 1330,
    domestic: 0.72,
    international: 0.28,
    sectorWeightings: [
      { name: "Technology", weight: 0.308 },
      { name: "Financials", weight: 0.163 },
      { name: "Industrials", weight: 0.107 },
      { name: "Healthcare", weight: 0.093 },
      { name: "Consumer Discretionary", weight: 0.087 },
      { name: "Communication Services", weight: 0.08 },
      { name: "Consumer Staples", weight: 0.048 },
      { name: "Energy", weight: 0.041 },
      { name: "Materials", weight: 0.033 },
      { name: "Utilities", weight: 0.023 },
      { name: "Real Estate", weight: 0.016 },
    ],
  },
  SCHG: {
    topHoldings: [
      { name: "Nvidia", weight: 0.105 },
      { name: "Apple", weight: 0.093 },
      { name: "Microsoft", weight: 0.076 },
      { name: "Amazon", weight: 0.052 },
      { name: "Alphabet (Class A)", weight: 0.04 },
      { name: "Broadcom", weight: 0.035 },
      { name: "Alphabet (Class C)", weight: 0.032 },
      { name: "Eli Lilly", weight: 0.03 },
      { name: "Meta Platforms", weight: 0.025 },
      { name: "Visa", weight: 0.024 },
    ],
    holdingsCount: 200,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.47 },
      { name: "Communication Services", weight: 0.131 },
      { name: "Consumer Discretionary", weight: 0.108 },
      { name: "Healthcare", weight: 0.097 },
      { name: "Financials", weight: 0.081 },
      { name: "Industrials", weight: 0.063 },
      { name: "Consumer Staples", weight: 0.018 },
      { name: "Materials", weight: 0.014 },
      { name: "Energy", weight: 0.009 },
      { name: "Real Estate", weight: 0.005 },
      { name: "Utilities", weight: 0.004 },
    ],
  },
  MGK: {
    topHoldings: [
      { name: "Nvidia", weight: 0.143 },
      { name: "Apple", weight: 0.13 },
      { name: "Microsoft", weight: 0.1 },
      { name: "Alphabet (Class A)", weight: 0.055 },
      { name: "Amazon", weight: 0.047 },
      { name: "Alphabet (Class C)", weight: 0.043 },
      { name: "Broadcom", weight: 0.041 },
      { name: "Meta Platforms", weight: 0.04 },
      { name: "Tesla", weight: 0.034 },
      { name: "Eli Lilly", weight: 0.032 },
    ],
    holdingsCount: 70,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.601 },
      { name: "Communication Services", weight: 0.155 },
      { name: "Consumer Discretionary", weight: 0.11 },
      { name: "Healthcare", weight: 0.048 },
      { name: "Financials", weight: 0.044 },
      { name: "Industrials", weight: 0.023 },
      { name: "Real Estate", weight: 0.012 },
      { name: "Materials", weight: 0.004 },
    ],
  },
  IWF: {
    topHoldings: [
      { name: "Nvidia", weight: 0.155 },
      { name: "Apple", weight: 0.074 },
      { name: "Alphabet (Class A)", weight: 0.059 },
      { name: "Microsoft", weight: 0.057 },
      { name: "Broadcom", weight: 0.052 },
      { name: "Alphabet (Class C)", weight: 0.048 },
      { name: "Micron Technology", weight: 0.032 },
      { name: "Tesla", weight: 0.032 },
      { name: "Meta Platforms", weight: 0.031 },
      { name: "Eli Lilly", weight: 0.028 },
    ],
    holdingsCount: 390,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.554 },
      { name: "Communication Services", weight: 0.158 },
      { name: "Consumer Discretionary", weight: 0.081 },
      { name: "Industrials", weight: 0.077 },
      { name: "Healthcare", weight: 0.056 },
      { name: "Financials", weight: 0.049 },
      { name: "Consumer Staples", weight: 0.012 },
      { name: "Energy", weight: 0.005 },
      { name: "Real Estate", weight: 0.004 },
    ],
  },
  SPYG: {
    topHoldings: [
      { name: "Nvidia", weight: 0.149 },
      { name: "Microsoft", weight: 0.105 },
      { name: "Apple", weight: 0.065 },
      { name: "Alphabet (Class A)", weight: 0.055 },
      { name: "Broadcom", weight: 0.049 },
      { name: "Alphabet (Class C)", weight: 0.044 },
      { name: "Amazon", weight: 0.037 },
      { name: "Meta Platforms", weight: 0.035 },
      { name: "Micron Technology", weight: 0.03 },
      { name: "Berkshire Hathaway", weight: 0.026 },
    ],
    holdingsCount: 210,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.534 },
      { name: "Communication Services", weight: 0.149 },
      { name: "Financials", weight: 0.091 },
      { name: "Consumer Discretionary", weight: 0.085 },
      { name: "Healthcare", weight: 0.062 },
      { name: "Industrials", weight: 0.055 },
      { name: "Consumer Staples", weight: 0.01 },
      { name: "Real Estate", weight: 0.006 },
    ],
  },
  VGT: {
    topHoldings: [
      { name: "Nvidia", weight: 0.177 },
      { name: "Apple", weight: 0.158 },
      { name: "Microsoft", weight: 0.115 },
      { name: "Broadcom", weight: 0.045 },
      { name: "Micron Technology", weight: 0.042 },
      { name: "AMD", weight: 0.03 },
      { name: "Cisco Systems", weight: 0.017 },
      { name: "Palantir Technologies", weight: 0.016 },
      { name: "Intel", weight: 0.015 },
      { name: "Lam Research", weight: 0.015 },
    ],
    holdingsCount: 320,
    domestic: 1,
    international: 0,
    sectorWeightings: [
      { name: "Technology", weight: 0.993 },
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

export type RiskLabel = "Low" | "Medium" | "High" | "Very High";

export interface EtfOption {
  ticker: string;
  name: string;
  description: string;
  /** Approximate long-run average annual return (historical CAGR), as a decimal. Educational estimate only. */
  avgReturn: number;
  category: "US Broad Market" | "Global" | "Growth / Tech" | "Dividend" | "Bonds" | "Low Volatility" | "Custom";
  /** Annual expense ratio (fund management fee) as a decimal, e.g. 0.0003 = 0.03%/yr. Undefined for individual stocks. */
  expenseRatio?: number;
  /** Static fallback risk category, used until live-computed volatility is available. */
  riskLabel?: RiskLabel;
  /** Annualized volatility of monthly returns over the last 5 years (Yahoo Finance, 27 Sep 2026), the
   *  same measure the live data computes. It stands in until live figures arrive, or when they can't,
   *  and matching them keeps the risk chart still when the live figures land. */
  staticVolatility?: number;
  /** Average daily close over the 12 months to 25 Sep 2026 (Yahoo Finance), shown in place of the
   *  price when a live quote isn't available. Refresh these now and then so they don't drift. */
  avgPrice?: number;
}

export const ETF_OPTIONS: EtfOption[] = [
  {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    description: "Tracks the 500 largest US companies",
    avgReturn: 0.105,
    category: "US Broad Market",
    expenseRatio: 0.0003,
    riskLabel: "Medium",
    staticVolatility: 0.154,
    avgPrice: 652.12,
  },
  {
    ticker: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    description: "The original S&P 500 index fund",
    avgReturn: 0.104,
    category: "US Broad Market",
    expenseRatio: 0.000945,
    riskLabel: "Medium",
    staticVolatility: 0.154,
    avgPrice: 709.16,
  },
  {
    ticker: "VTI",
    name: "Vanguard Total Stock Market ETF",
    description: "Entire US stock market, large to small cap",
    avgReturn: 0.103,
    category: "US Broad Market",
    expenseRatio: 0.0003,
    riskLabel: "Medium",
    staticVolatility: 0.157,
    avgPrice: 349.68,
  },
  {
    ticker: "SCHB",
    name: "Schwab U.S. Broad Market ETF",
    description: "The 2,500 largest US companies, for a very low fee",
    avgReturn: 0.103,
    category: "US Broad Market",
    expenseRatio: 0.0003,
    riskLabel: "Medium",
    staticVolatility: 0.158,
    avgPrice: 27.36,
  },
  {
    ticker: "VT",
    name: "Vanguard Total World Stock ETF",
    description: "Every major stock market, US + international",
    avgReturn: 0.085,
    category: "Global",
    expenseRatio: 0.0006,
    riskLabel: "Medium",
    staticVolatility: 0.148,
    avgPrice: 148.47,
  },
  {
    ticker: "VXUS",
    name: "Vanguard Total International Stock ETF",
    description: "Global stocks excluding the US",
    avgReturn: 0.06,
    category: "Global",
    expenseRatio: 0.0005,
    riskLabel: "Medium",
    staticVolatility: 0.151,
    avgPrice: 80.79,
  },
  {
    ticker: "ACWI",
    name: "iShares MSCI ACWI ETF",
    description: "Large and mid-size companies in developed and emerging markets",
    avgReturn: 0.08,
    category: "Global",
    expenseRatio: 0.0032,
    riskLabel: "Medium",
    staticVolatility: 0.147,
    avgPrice: 148.66,
  },
  {
    ticker: "URTH",
    name: "iShares MSCI World ETF",
    description: "Large and mid-size companies in 23 developed countries",
    avgReturn: 0.09,
    category: "Global",
    expenseRatio: 0.0024,
    riskLabel: "Medium",
    staticVolatility: 0.149,
    avgPrice: 193.54,
  },
  {
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    description: "Nasdaq-100, tech-heavy growth companies",
    avgReturn: 0.135,
    category: "Growth / Tech",
    expenseRatio: 0.0018,
    riskLabel: "Medium",
    staticVolatility: 0.207,
    avgPrice: 654.58,
  },
  {
    ticker: "VUG",
    name: "Vanguard Morningstar Growth ETF",
    description: "Large US companies growing faster than the market",
    avgReturn: 0.115,
    category: "Growth / Tech",
    expenseRatio: 0.0003,
    riskLabel: "Medium",
    staticVolatility: 0.201,
    avgPrice: 82.56,
  },
  {
    ticker: "SCHG",
    name: "Schwab U.S. Large-Cap Growth ETF",
    description: "Large US growth companies, for a very low fee",
    avgReturn: 0.115,
    category: "Growth / Tech",
    expenseRatio: 0.0004,
    riskLabel: "Medium",
    staticVolatility: 0.196,
    avgPrice: 32.92,
  },
  {
    ticker: "MGK",
    name: "Vanguard Morningstar Mega Cap Growth ETF",
    description: "The very largest US growth companies",
    avgReturn: 0.12,
    category: "Growth / Tech",
    expenseRatio: 0.0005,
    riskLabel: "Medium",
    staticVolatility: 0.206,
    avgPrice: 83.69,
  },
  {
    ticker: "IWF",
    name: "iShares Russell 1000 Growth ETF",
    description: "Growth stocks in the Russell 1000 index",
    avgReturn: 0.115,
    category: "Growth / Tech",
    expenseRatio: 0.0018,
    riskLabel: "Medium",
    staticVolatility: 0.19,
    avgPrice: 118.65,
  },
  {
    ticker: "SPYG",
    name: "SPDR Portfolio S&P 500 Growth ETF",
    description: "The growth half of the S&P 500",
    avgReturn: 0.11,
    category: "Growth / Tech",
    expenseRatio: 0.0004,
    riskLabel: "Medium",
    staticVolatility: 0.188,
    avgPrice: 110.92,
  },
  {
    ticker: "VGT",
    name: "Vanguard Information Technology ETF",
    description: "US technology companies, from chips to software",
    avgReturn: 0.14,
    category: "Growth / Tech",
    expenseRatio: 0.0009,
    riskLabel: "High",
    staticVolatility: 0.232,
    avgPrice: 103.52,
  },
  {
    ticker: "SCHD",
    name: "Schwab US Dividend Equity ETF",
    description: "High-quality US dividend-paying companies",
    avgReturn: 0.108,
    category: "Dividend",
    expenseRatio: 0.0006,
    riskLabel: "Medium",
    staticVolatility: 0.149,
    avgPrice: 30.67,
  },
  {
    ticker: "BND",
    name: "Vanguard Total Bond Market ETF",
    description: "Broad US investment-grade bond market",
    avgReturn: 0.035,
    category: "Bonds",
    expenseRatio: 0.0003,
    riskLabel: "Low",
    staticVolatility: 0.064,
    avgPrice: 73.56,
  },
  {
    ticker: "AGG",
    name: "iShares Core U.S. Aggregate Bond ETF",
    description: "Tracks the US investment-grade bond market",
    avgReturn: 0.034,
    category: "Bonds",
    expenseRatio: 0.0003,
    riskLabel: "Low",
    staticVolatility: 0.065,
    avgPrice: 99.18,
  },
  {
    ticker: "SPLV",
    name: "Invesco S&P 500 Low Volatility ETF",
    description: "The 100 least volatile stocks in the S&P 500",
    avgReturn: 0.09,
    category: "Low Volatility",
    expenseRatio: 0.0025,
    riskLabel: "Medium",
    staticVolatility: 0.128,
    avgPrice: 73.70,
  },
];

export const DEFAULT_ETF_TICKER = "VT";

/** The date the built-in `avgPrice` figures run to, shown when live prices can't be reached. */
export const FALLBACK_PRICES_AS_OF = "Sep 25, 2026";

/** Assumed annual return for a user-entered ticker we have no historical data for. */
export const DEFAULT_CUSTOM_RETURN = 0.08;

export interface CustomTicker {
  ticker: string;
  avgReturn: number;
  /** True once a live 5yr CAGR has auto-filled avgReturn, so we don't overwrite a later manual edit. */
  liveSeeded?: boolean;
}

/** Merges the preset funds with any tickers the user has typed in, so both can be selected the same way. */
export function getAllFunds(customTickers: CustomTicker[]): EtfOption[] {
  return [
    ...ETF_OPTIONS,
    ...customTickers.map(
      (ct): EtfOption => ({
        ticker: ct.ticker,
        name: `${ct.ticker} (your estimate)`,
        description: "Custom ticker with a return you set",
        avgReturn: ct.avgReturn,
        category: "Custom",
      }),
    ),
  ];
}

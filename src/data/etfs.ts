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
  /** Approximate long-run annualized volatility as a decimal, used as the risk chart's fallback axis value. */
  staticVolatility?: number;
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
    staticVolatility: 0.155,
  },
  {
    ticker: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    description: "The original S&P 500 index fund",
    avgReturn: 0.104,
    category: "US Broad Market",
    expenseRatio: 0.000945,
    riskLabel: "Medium",
    staticVolatility: 0.155,
  },
  {
    ticker: "VTI",
    name: "Vanguard Total Stock Market ETF",
    description: "Entire US stock market, large to small cap",
    avgReturn: 0.103,
    category: "US Broad Market",
    expenseRatio: 0.0003,
    riskLabel: "Medium",
    staticVolatility: 0.16,
  },
  {
    ticker: "VT",
    name: "Vanguard Total World Stock ETF",
    description: "Every major stock market, US + international",
    avgReturn: 0.085,
    category: "Global",
    expenseRatio: 0.0007,
    riskLabel: "Medium",
    staticVolatility: 0.14,
  },
  {
    ticker: "VXUS",
    name: "Vanguard Total International Stock ETF",
    description: "Global stocks excluding the US",
    avgReturn: 0.06,
    category: "Global",
    expenseRatio: 0.0005,
    riskLabel: "Medium",
    staticVolatility: 0.16,
  },
  {
    ticker: "QQQ",
    name: "Invesco QQQ Trust",
    description: "Nasdaq-100, tech-heavy growth companies",
    avgReturn: 0.135,
    category: "Growth / Tech",
    expenseRatio: 0.002,
    riskLabel: "Medium",
    staticVolatility: 0.2,
  },
  {
    ticker: "SCHD",
    name: "Schwab US Dividend Equity ETF",
    description: "High-quality US dividend-paying companies",
    avgReturn: 0.108,
    category: "Dividend",
    expenseRatio: 0.0006,
    riskLabel: "Medium",
    staticVolatility: 0.148,
  },
  {
    ticker: "BND",
    name: "Vanguard Total Bond Market ETF",
    description: "Broad US investment-grade bond market",
    avgReturn: 0.035,
    category: "Bonds",
    expenseRatio: 0.0003,
    riskLabel: "Low",
    staticVolatility: 0.065,
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
  },
  {
    ticker: "SPLV",
    name: "Invesco S&P 500 Low Volatility ETF",
    description: "The 100 least volatile stocks in the S&P 500",
    avgReturn: 0.09,
    category: "Low Volatility",
    expenseRatio: 0.0025,
    riskLabel: "Medium",
    staticVolatility: 0.126,
  },
];

export const DEFAULT_ETF_TICKER = "VT";

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

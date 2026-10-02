export type ContributionFrequency = "weekly" | "biweekly" | "monthly" | "yearly";

export interface ProjectionInput {
  currentAge: number;
  targetAge: number;
  currentAmount: number;
  contributionAmount: number;
  contributionFrequency: ContributionFrequency;
  annualReturn: number;
  /** Inflation for each plan year (index 0 is the first year), as decimals. Missing years count as
   *  0%, so a projection without it has real values equal to nominal ones. */
  inflation?: readonly number[];
  /** Raise each year's contributions with prices, so they keep the same buying power. */
  raiseContributions?: boolean;
  /** The calendar year the plan starts in, today. Defaults to the current year. */
  startYear?: number;
}

export interface YearPoint {
  age: number;
  year: number;
  calendarYear: number;
  /** Nominal (future) dollars: what the account statement will say. */
  balance: number;
  contributions: number;
  growth: number;
  /** Prices at this point relative to today: 1.6 means things cost 60% more. */
  priceIndex: number;
  /** The same figures in today's dollars. `realContributions` counts each deposit at what it was
   *  worth when you made it, so `realGrowth` is growth beyond inflation and can be negative even
   *  when nominal growth isn't. */
  realBalance: number;
  realContributions: number;
  realGrowth: number;
}

export type Dollars = "today" | "future";

/** The two ways to count money, labeled the same everywhere they're offered. */
export const DOLLAR_OPTIONS = [
  { value: "today", label: "Today's dollars" },
  { value: "future", label: "Future dollars" },
] as const satisfies readonly { value: Dollars; label: string }[];

/** Balance, contributions, and growth in the chosen dollars, so components don't each branch. */
export function pickDollars(point: YearPoint, dollars: Dollars): { balance: number; contributions: number; growth: number } {
  return dollars === "today"
    ? { balance: point.realBalance, contributions: point.realContributions, growth: point.realGrowth }
    : { balance: point.balance, contributions: point.contributions, growth: point.growth };
}

export function toMonthlyContribution(amount: number, frequency: ContributionFrequency): number {
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
  }
}

/** Inverse of toMonthlyContribution — expresses a monthly-equivalent amount at the given cadence. */
export function fromMonthlyContribution(monthlyAmount: number, frequency: ContributionFrequency): number {
  switch (frequency) {
    case "weekly":
      return (monthlyAmount * 12) / 52;
    case "biweekly":
      return (monthlyAmount * 12) / 26;
    case "monthly":
      return monthlyAmount;
    case "yearly":
      return monthlyAmount * 12;
  }
}

/** The common "4% rule" safe withdrawal rate, used both to project retirement income and to solve for it. */
export const SAFE_WITHDRAWAL_RATE = 0.04;

/**
 * A yearly income goal, entered in either dollars, as income in the retirement year's prices and
 * in today's, and the balance the 4% rule needs to pay it. `retirementPrices` is the price index at
 * retirement (2.5 means things cost 2.5 times what they do today). The 4% rule already raises each
 * withdrawal with prices, so the first year's income in future dollars is all the target needs.
 */
export function incomeGoal(
  amount: number,
  dollars: Dollars,
  retirementPrices: number,
): { future: number; today: number; targetBalance: number } {
  const future = dollars === "future" ? amount : amount * retirementPrices;
  const today = dollars === "today" ? amount : amount / retirementPrices;
  return { future, today, targetBalance: future / SAFE_WITHDRAWAL_RATE };
}

/**
 * Solves for the monthly contribution needed to reach `targetBalance` (in future dollars) by the
 * target age. The balance is linear in the contribution: it's what the starting amount grows to,
 * plus the contribution times what one dollar a month grows to. So two runs of the same simulation
 * `projectGrowth` uses give the answer exactly, including contributions that rise with inflation,
 * which a closed-form annuity formula can't handle. Never returns a negative number: if the
 * starting amount alone clears the target, no further contribution is needed.
 */
export function computeRequiredMonthlyContribution(
  targetBalance: number,
  input: Omit<ProjectionInput, "contributionAmount" | "contributionFrequency">,
): number {
  if (input.targetAge - input.currentAge <= 0) return 0;
  const base = { ...input, contributionFrequency: "monthly" as const };
  const fromCurrentAmount = finalPoint({ ...base, contributionAmount: 0 }).balance;
  const perDollarMonthly = finalPoint({ ...base, currentAmount: 0, contributionAmount: 1 }).balance;
  const remaining = targetBalance - fromCurrentAmount;
  if (remaining <= 0 || perDollarMonthly <= 0) return 0;
  return remaining / perDollarMonthly;
}

/**
 * Simulates monthly compounding with contributions added at the start of each month. Prices rise
 * through each year at that year's inflation rate, spread evenly across its months, and every
 * deposit is also counted in today's dollars at the price level when it went in.
 */
export function projectGrowth(input: ProjectionInput, annualReturnOverride?: number): YearPoint[] {
  const years = Math.max(0, input.targetAge - input.currentAge);
  const monthlyContribution = toMonthlyContribution(
    input.contributionAmount,
    input.contributionFrequency,
  );
  const annualReturn = annualReturnOverride ?? input.annualReturn;
  const monthlyRate = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const startYear = input.startYear ?? new Date().getFullYear();

  const points: YearPoint[] = [
    {
      age: input.currentAge,
      year: 0,
      calendarYear: startYear,
      balance: input.currentAmount,
      contributions: input.currentAmount,
      growth: 0,
      priceIndex: 1,
      realBalance: input.currentAmount,
      realContributions: input.currentAmount,
      realGrowth: 0,
    },
  ];

  let balance = input.currentAmount;
  let contributions = input.currentAmount;
  let realContributions = input.currentAmount;
  let priceIndex = 1;
  let yearStartPrice = 1;
  let monthlyPriceGrowth = 1;

  for (let month = 1; month <= years * 12; month++) {
    if ((month - 1) % 12 === 0) {
      yearStartPrice = priceIndex;
      monthlyPriceGrowth = Math.pow(1 + (input.inflation?.[(month - 1) / 12] ?? 0), 1 / 12);
    }
    const deposit = input.raiseContributions ? monthlyContribution * yearStartPrice : monthlyContribution;
    balance += deposit;
    contributions += deposit;
    realContributions += deposit / priceIndex;
    balance *= 1 + monthlyRate;
    priceIndex *= monthlyPriceGrowth;

    if (month % 12 === 0) {
      const year = month / 12;
      const realBalance = balance / priceIndex;
      points.push({
        age: input.currentAge + year,
        year,
        calendarYear: startYear + year,
        balance,
        contributions,
        growth: balance - contributions,
        priceIndex,
        realBalance,
        realContributions,
        realGrowth: realBalance - realContributions,
      });
    }
  }

  return points;
}

export function finalPoint(input: ProjectionInput, annualReturnOverride?: number): YearPoint {
  const points = projectGrowth(input, annualReturnOverride);
  return points[points.length - 1];
}

export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const currencyFormatterPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

// Constructing an Intl.NumberFormat costs ~100x more than formatting with an existing one, and this
// runs on every axis tick and on every frame of the stat tiles' count-up animation, so the instance
// is built once and reused rather than per call.
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
  style: "currency",
  currency: "USD",
});

export function formatCompact(value: number): string {
  return compactFormatter.format(value);
}

/**
 * Full precision below $1M (where the exact dollar figure is most useful), switching to compact
 * notation ($2.4M, $1.8B, $3.1T, …) above it — so a stat display never has to fit an arbitrarily
 * long number and stays legible no matter how large a projection grows.
 */
export function formatAdaptiveCurrency(value: number): string {
  return Math.abs(value) >= 1_000_000 ? formatCompact(value) : currencyFormatter.format(value);
}

export interface YearlyGrowthPoint {
  age: number;
  yearlyGrowth: number;
}

/** Market growth added in each year of a projection, excluding that year's new contributions. In
 *  today's dollars it's growth beyond inflation, which a low-return year can turn negative. */
export function buildYearlyGrowth(data: YearPoint[], dollars: Dollars = "future"): YearlyGrowthPoint[] {
  return data.slice(1).map((point, i) => ({
    age: point.age,
    yearlyGrowth: pickDollars(point, dollars).growth - pickDollars(data[i], dollars).growth,
  }));
}

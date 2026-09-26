export type ContributionFrequency = "weekly" | "biweekly" | "monthly" | "yearly";

export interface ProjectionInput {
  currentAge: number;
  targetAge: number;
  currentAmount: number;
  contributionAmount: number;
  contributionFrequency: ContributionFrequency;
  annualReturn: number;
}

export interface YearPoint {
  age: number;
  year: number;
  balance: number;
  contributions: number;
  growth: number;
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
 * Solves for the monthly contribution needed to reach `targetBalance` after `years`, given a
 * starting `currentAmount` and `annualReturn`. This inverts the same monthly-compounding model
 * `projectGrowth` uses (contribute, then grow, each month) via the future-value-of-an-annuity-due
 * formula, rather than approximating with search/iteration. Never returns a negative number — if
 * the starting amount alone is already projected to clear the target, no further contribution is
 * needed.
 */
export function computeRequiredMonthlyContribution(
  targetBalance: number,
  currentAmount: number,
  years: number,
  annualReturn: number,
): number {
  if (years <= 0) return 0;

  const months = years * 12;
  const monthlyRate = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const growthOfCurrentAmount = currentAmount * Math.pow(1 + monthlyRate, months);
  const remaining = targetBalance - growthOfCurrentAmount;
  if (remaining <= 0) return 0;

  if (monthlyRate === 0) {
    return remaining / months;
  }

  // Future value of an annuity-due (contribution added at the start of each period, then grown).
  const annuityFactor = ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
  return remaining / annuityFactor;
}

/** Simulates monthly compounding with contributions added at the start of each month. */
export function projectGrowth(input: ProjectionInput, annualReturnOverride?: number): YearPoint[] {
  const years = Math.max(0, input.targetAge - input.currentAge);
  const monthlyContribution = toMonthlyContribution(
    input.contributionAmount,
    input.contributionFrequency,
  );
  const annualReturn = annualReturnOverride ?? input.annualReturn;
  const monthlyRate = Math.pow(1 + annualReturn, 1 / 12) - 1;

  const points: YearPoint[] = [
    {
      age: input.currentAge,
      year: 0,
      balance: input.currentAmount,
      contributions: input.currentAmount,
      growth: 0,
    },
  ];

  let balance = input.currentAmount;
  let contributions = input.currentAmount;

  for (let month = 1; month <= years * 12; month++) {
    balance += monthlyContribution;
    contributions += monthlyContribution;
    balance *= 1 + monthlyRate;

    if (month % 12 === 0) {
      const year = month / 12;
      points.push({
        age: input.currentAge + year,
        year,
        balance,
        contributions,
        growth: balance - contributions,
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

/** Market growth added in each year of a projection, excluding that year's new contributions. */
export function buildYearlyGrowth(data: YearPoint[]): YearlyGrowthPoint[] {
  return data.slice(1).map((point, i) => ({
    age: point.age,
    yearlyGrowth: point.growth - data[i].growth,
  }));
}

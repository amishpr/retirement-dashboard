import assert from "node:assert/strict";
import { test } from "node:test";
import { computeRequiredMonthlyContribution, finalPoint, incomeGoal, projectGrowth, type ProjectionInput } from "./projection.ts";

const plan: ProjectionInput = {
  currentAge: 30,
  targetAge: 65,
  currentAmount: 10000,
  contributionAmount: 200,
  contributionFrequency: "biweekly",
  annualReturn: 0.085,
  startYear: 2026,
};

const close = (actual: number, expected: number, tolerance: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ""} expected ${expected}, got ${actual}`);

test("nominal numbers are unchanged by the inflation fields", () => {
  const withoutInflation = finalPoint(plan);
  const withInflation = finalPoint({ ...plan, inflation: Array(35).fill(0.03) });
  // The figure the app showed before inflation existed.
  assert.equal(Math.round(withoutInflation.balance), 1221406);
  assert.equal(withInflation.balance, withoutInflation.balance);
  assert.equal(withInflation.contributions, withoutInflation.contributions);
});

test("with no inflation, today's dollars equal future dollars", () => {
  for (const point of projectGrowth(plan)) {
    assert.equal(point.priceIndex, 1);
    close(point.realBalance, point.balance, 1e-6);
    close(point.realContributions, point.contributions, 1e-6);
  }
});

test("a flat 3% compounds prices to 1.03^35", () => {
  const last = finalPoint({ ...plan, inflation: Array(35).fill(0.03) });
  close(last.priceIndex, Math.pow(1.03, 35), 1e-9);
  close(last.realBalance, last.balance / Math.pow(1.03, 35), 1e-6);
  assert.equal(last.calendarYear, 2061);
  // Deposits made later are worth less in today's money, so real contributions trail nominal ones.
  assert.ok(last.realContributions < last.contributions);
  close(last.realGrowth, last.realBalance - last.realContributions, 1e-6);
});

test("raising contributions with inflation keeps their buying power", () => {
  const inflation = Array(35).fill(0.03);
  const flat = finalPoint({ ...plan, inflation });
  const raised = finalPoint({ ...plan, inflation, raiseContributions: true });
  assert.ok(raised.contributions > flat.contributions);
  // Each year's deposits are worth the same in today's money, give or take the within-year drift.
  const yearlyToday = (200 * 26) / 12 * 12;
  close(raised.realContributions, 10000 + yearlyToday * 35, yearlyToday * 35 * 0.02);
});

test("the goal solver matches the old closed-form answer without inflation", () => {
  const target = 1_000_000;
  const months = 35 * 12;
  const r = Math.pow(1.085, 1 / 12) - 1;
  const closedForm = (target - 10000 * Math.pow(1 + r, months)) / (((Math.pow(1 + r, months) - 1) / r) * (1 + r));
  close(computeRequiredMonthlyContribution(target, plan), closedForm, 1e-6);
});

test("the goal solver round-trips with step-ups and varying inflation", () => {
  const inflation = Array.from({ length: 35 }, (_, i) => 0.025 + 0.01 * Math.pow(0.7, i + 1));
  const target = 2_480_000;
  for (const raiseContributions of [false, true]) {
    const monthly = computeRequiredMonthlyContribution(target, { ...plan, inflation, raiseContributions });
    const reached = finalPoint({ ...plan, inflation, raiseContributions, contributionAmount: monthly, contributionFrequency: "monthly" });
    close(reached.balance, target, 1, `raiseContributions=${raiseContributions}`);
  }
});

test("no contribution is needed when savings already clear the goal", () => {
  assert.equal(computeRequiredMonthlyContribution(1000, plan), 0);
  assert.equal(computeRequiredMonthlyContribution(1_000_000, { ...plan, targetAge: 30 }), 0);
});

test("an income goal in either dollars aims for the same balance when it means the same money", () => {
  const prices = 2.5;
  const inToday = incomeGoal(40_000, "today", prices);
  assert.deepEqual(inToday, { future: 100_000, today: 40_000, targetBalance: 2_500_000 });
  const inFuture = incomeGoal(100_000, "future", prices);
  assert.deepEqual(inFuture, { future: 100_000, today: 40_000, targetBalance: 2_500_000 });
  // The same number means less in future dollars, so it needs a smaller balance.
  assert.equal(incomeGoal(40_000, "future", prices).targetBalance, 1_000_000);
  // With prices flat, the two are the same.
  assert.deepEqual(incomeGoal(40_000, "future", 1), incomeGoal(40_000, "today", 1));
});

test("a future-dollar goal seeded from the plan's own income asks for the plan's own contribution", () => {
  const inflation = Array(35).fill(0.03);
  const last = finalPoint({ ...plan, inflation });
  const goal = incomeGoal(last.balance * 0.04, "future", last.priceIndex);
  const monthly = computeRequiredMonthlyContribution(goal.targetBalance, { ...plan, inflation });
  close(monthly, (200 * 26) / 12, 1e-6);
  // And the same income counted in today's dollars asks for the same thing.
  const inToday = incomeGoal(last.realBalance * 0.04, "today", last.priceIndex);
  close(inToday.targetBalance, goal.targetBalance, 1e-6);
});

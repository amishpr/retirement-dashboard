import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILT_IN_INFLATION as data } from "../data/cpiHistory.ts";
import {
  annualRates,
  averageRate,
  buildInflationPath,
  fitAR1,
  forecastAnchor,
  forecastInflation,
  historicalAverage,
  realReturn,
} from "./inflation.ts";

const close = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);

test("annual rates skip gaps instead of spanning them", () => {
  const rates = annualRates([
    [2000, 100],
    [2001, 103],
    [2003, 110],
    [2004, 110],
  ]);
  assert.deepEqual(rates.map(([y]) => y), [2001, 2004]);
  close(rates[0][1], 0.03, 1e-12);
});

test("the AR(1) fit recovers a known process", () => {
  // pi_t = 0.01 + 0.6 * pi_(t-1) + e_t, with e_t from a seeded generator so the test is repeatable.
  let seed = 42;
  const noise = () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return (seed / 2 ** 32 - 0.5) * 0.02;
  };
  const rates: [number, number][] = [[1950, 0.025]];
  for (let y = 1951; y < 4000; y++) rates.push([y, 0.01 + 0.6 * rates[rates.length - 1][1] + noise()]);
  const fit = fitAR1(rates, 1950);
  close(fit.phi, 0.6, 0.03);
  close(fit.mean, 0.025, 0.001);
  // Uniform noise on +/-0.01 has a standard deviation of 0.02 / sqrt(12).
  close(fit.sigma, 0.02 / Math.sqrt(12), 0.0003);
});

test("the fit on real CPI matches the numbers in the plan", () => {
  const fit = fitAR1(annualRates(data.annual), 1950);
  close(fit.phi, 0.732, 0.01);
  close(fit.sigma, 0.0186, 0.001);
  close(historicalAverage(data.annual, 1926), 0.0297, 0.0005);
  close(forecastAnchor(data), 0.0256, 0.0005);
});

test("the forecast starts near today's rate and settles at the anchor", () => {
  const path = forecastInflation({ start: 0.034, anchor: 0.0256, phi: 0.732, sigma: 0.0186, years: 35, startYear: 2026 });
  close(path[0].rate, 0.0256 + 0.732 * (0.034 - 0.0256), 1e-12);
  close(path[34].rate, 0.0256, 1e-6);
  assert.equal(path[0].calendarYear, 2027);
  assert.equal(path[34].calendarYear, 2061);
  // The range widens with time and always brackets the central path.
  for (const year of path) assert.ok(year.priceLow! < year.priceIndex && year.priceIndex < year.priceHigh!);
  assert.ok(path[34].priceHigh! / path[34].priceLow! > path[0].priceHigh! / path[0].priceLow!);
});

test("each mode builds the path it describes", () => {
  const forecast = buildInflationPath({ mode: "forecast", customRate: 0 }, data, 35, 2026);
  const history = buildInflationPath({ mode: "history", customRate: 0 }, data, 35, 2026);
  const custom = buildInflationPath({ mode: "custom", customRate: 0.03 }, data, 35, 2026);
  close(forecast.start, data.latest.yoy, 1e-12);
  close(history.average, historicalAverage(data.annual, 1926), 1e-9);
  close(custom.years[34].priceIndex, Math.pow(1.03, 35), 1e-9);
  assert.equal(custom.years[0].priceLow, undefined);
  assert.ok(history.years[0].priceLow !== undefined);
  assert.equal(buildInflationPath({ mode: "forecast", customRate: 0 }, data, 0, 2026).average, 0);
});

test("average and real return use compounding, not subtraction", () => {
  close(averageRate([{ calendarYear: 1, rate: 0.1, priceIndex: 1.1 }, { calendarYear: 2, rate: 0, priceIndex: 1.1 }]), Math.sqrt(1.1) - 1, 1e-12);
  close(realReturn(0.085, 0.0256), 1.085 / 1.0256 - 1, 1e-12);
});

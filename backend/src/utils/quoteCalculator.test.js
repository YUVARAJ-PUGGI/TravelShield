import test from "node:test";
import assert from "node:assert/strict";
import { calculatePremium } from "./quoteCalculator.js";
import { getInclusiveCalendarDays, normalizeDateOnly } from "./dateOnly.js";

test("calculates the three configured plan rates for one traveller", () => {
  assert.equal(calculatePremium(2, 5, 1), 10);
  assert.equal(calculatePremium(3.5, 5, 1), 17.5);
  assert.equal(calculatePremium(5, 5, 1), 25);
});

test("uses inclusive calendar duration and traveller count supplied by the route", () => {
  assert.equal(calculatePremium(3.5, 1, 3), 10.5);
  assert.equal(calculatePremium(3.5, 10, 2), 70);
});

test("does not add policy coverage limits or deductibles to the illustrative premium", () => {
  assert.equal(calculatePremium(2, 1, 1), 2);
  assert.equal(calculatePremium(3.5, 1, 1), 3.5);
  assert.equal(calculatePremium(5, 1, 1), 5);
});

test("preserves valid date-only values without timezone conversion", () => {
  assert.equal(normalizeDateOnly("2026-10-21"), "2026-10-21");
  assert.equal(normalizeDateOnly("2026-02-30"), null);
  assert.equal(normalizeDateOnly("2026-10-21T00:00:00.000Z"), null);
});

test("calculates inclusive dates across a month boundary", () => {
  assert.equal(getInclusiveCalendarDays("2026-10-21", "2026-11-30"), 41);
  assert.equal(calculatePremium(5, getInclusiveCalendarDays("2026-10-21", "2026-11-30"), 4), 820);
  assert.equal(getInclusiveCalendarDays("2026-10-31", "2026-11-01"), 2);
});

test("rejects reversed date ranges", () => {
  assert.equal(getInclusiveCalendarDays("2026-11-30", "2026-10-21"), null);
});

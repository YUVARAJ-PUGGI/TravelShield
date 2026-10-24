import test from "node:test";
import assert from "node:assert/strict";
import { validateEligibleQuote } from "./policyValidation.js";

function validQuote(overrides = {}) {
  return {
    quote_status: "generated",
    plan_id: 1,
    destination_country_id: 4,
    start_date: "2026-11-01",
    end_date: "2026-11-05",
    traveller_count: 1,
    premium_amount: "10.00",
    currency_code: "USD",
    ...overrides,
  };
}

test("accepts a complete generated quote", () => {
  assert.equal(validateEligibleQuote(validQuote()), null);
});

test("rejects non-generated quotes", () => {
  assert.match(
    validateEligibleQuote(validQuote({ quote_status: "converted" })),
    /Only generated quotes/
  );
});

test("rejects invalid dates and missing required fields", () => {
  assert.match(
    validateEligibleQuote(validQuote({ end_date: "2026-02-30" })),
    /invalid coverage dates/
  );
  assert.match(
    validateEligibleQuote(validQuote({ currency_code: "US" })),
    /missing required policy fields/
  );
});

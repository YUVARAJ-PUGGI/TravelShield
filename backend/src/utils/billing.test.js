import test from "node:test";
import assert from "node:assert/strict";
import { calculateInvoiceTotals } from "./billing.js";

test("calculates invoice total with configured tax and fee", () => {
  assert.deepEqual(calculateInvoiceTotals("100.00", "8.25", "2.50"), {
    premiumAmount: 100,
    taxRatePercent: 8.25,
    taxAmount: 8.25,
    feeAmount: 2.5,
    totalAmount: 110.75,
  });
});

test("defaults to no tax and no fees when not configured", () => {
  assert.deepEqual(calculateInvoiceTotals("49.99", "0", "0"), {
    premiumAmount: 49.99,
    taxRatePercent: 0,
    taxAmount: 0,
    feeAmount: 0,
    totalAmount: 49.99,
  });
});

test("rounds tax and fees to currency precision", () => {
  assert.equal(calculateInvoiceTotals("12.35", "7.5", "0.105").totalAmount, 13.39);
});

test("rejects invalid premium, tax rate, or fee", () => {
  assert.throws(() => calculateInvoiceTotals("-1"), /Premium/);
  assert.throws(() => calculateInvoiceTotals("10", "100.1"), /cannot exceed 100/);
  assert.throws(() => calculateInvoiceTotals("10", "5", "-1"), /Fixed fee/);
});
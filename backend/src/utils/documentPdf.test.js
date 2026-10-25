import test from "node:test";
import assert from "node:assert/strict";
import {
  createInsuranceCardPdf,
  createInvoicePdf,
  createPolicyCertificatePdf,
} from "./documentPdf.js";

const policy = {
  policy_number: "TS-DEMO-TEST",
  full_name: "Demo User",
  plan_name: "Essential",
  country_name: "Canada",
  coverage_start_date: "2026-10-25",
  coverage_end_date: "2026-11-09",
  premium_amount: 100,
  currency_code: "USD",
};

test("generates private PDF buffers for invoices and policy documents", async () => {
  const invoice = await createInvoicePdf({
    invoice_number: "TS-INV-TEST",
    policy_number: policy.policy_number,
    plan_name: policy.plan_name,
    created_at: "2026-10-25",
    premium_amount: 100,
    tax_rate_percent: 0,
    tax_amount: 0,
    fee_amount: 0,
    total_amount: 100,
    currency_code: "USD",
    payment_status: "PAID",
  });
  const certificate = await createPolicyCertificatePdf(policy);
  const insuranceCard = await createInsuranceCardPdf(policy);

  for (const buffer of [invoice, certificate, insuranceCard]) {
    assert.ok(buffer.subarray(0, 4).equals(Buffer.from("%PDF")));
    assert.ok(buffer.length > 500);
  }
});
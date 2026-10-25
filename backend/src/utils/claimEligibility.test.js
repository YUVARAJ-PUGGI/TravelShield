import test from "node:test";
import assert from "node:assert/strict";
import { evaluateClaimEligibility } from "./claimEligibility.js";

const base = {
  policy: {
    plan_id: 2,
    policy_status: "simulated_issued",
    coverage_start_date: "2026-01-01",
    coverage_end_date: "2026-12-31",
    coverage_amount: 75000,
    currency_code: "USD",
    policy_conditions: [],
  },
  benefit: {
    plan_id: 2,
    benefit_name: "Travel delay",
    benefit_limit: 300,
    currency_code: "USD",
    required_evidence: ["Original itinerary", "Carrier delay confirmation"],
    exclusions_conditions: "",
  },
  incidentDate: "2026-10-25",
  claimedAmount: "125.00",
  verification: { verificationStatus: "RECORD_FOUND" },
  hasTicket: true,
  supportingDocumentCount: 2,
  referenceDate: new Date("2026-10-25T12:00:00Z"),
};

test("passes configured checks when amount and required evidence fit", () => {
  const result = evaluateClaimEligibility(base);
  assert.equal(result.eligibleToSubmit, true);
  assert.equal(result.eligibilityStatus, "READY_TO_SUBMIT");
  assert.deepEqual(result.reasons, []);
});

test("returns the specific coverage and limit conditions", () => {
  const result = evaluateClaimEligibility({
    ...base,
    incidentDate: "2027-01-01",
    claimedAmount: "400",
  });
  assert.equal(result.eligibleToSubmit, false);
  const coverageReason = result.reasons.find((reason) => reason.code === "POLICY_COVERAGE");
  assert.ok(coverageReason);
  assert.match(coverageReason.condition, /Submitted incident date: 2027-01-01/);
  assert.match(coverageReason.condition, /Coverage period: 2026-01-01 to 2026-12-31/);
  assert.ok(result.reasons.some((reason) => reason.code === "BENEFIT_LIMIT"));
});

test("provider outages permit submission into manual review", () => {
  const result = evaluateClaimEligibility({
    ...base,
    verification: { verificationStatus: "MANUAL_REVIEW" },
  });
  assert.equal(result.eligibleToSubmit, true);
  assert.equal(result.eligibilityStatus, "MANUAL_REVIEW");
});

test("missing ticket or checklist documents block submission with next steps", () => {
  const result = evaluateClaimEligibility({ ...base, hasTicket: false, supportingDocumentCount: 0 });
  assert.equal(result.eligibleToSubmit, false);
  assert.ok(result.reasons.some((reason) => reason.code === "TICKET_REQUIRED"));
  assert.ok(result.reasons.some((reason) => reason.code === "MORE_EVIDENCE_REQUIRED"));
});

test("unconfigured policy conditions are routed to manual review", () => {
  const result = evaluateClaimEligibility({
    ...base,
    policy: { ...base.policy, policy_conditions: [{ title: "Waiting period", description: "Not configured" }] },
  });
  assert.equal(result.eligibleToSubmit, true);
  assert.equal(result.eligibilityStatus, "MANUAL_REVIEW");
});

test("currency mismatches bypass numeric limit comparison and require manual review", () => {
  const result = evaluateClaimEligibility({
    ...base,
    benefit: { ...base.benefit, currency_code: "EUR", benefit_limit: 50 },
    claimedAmount: "100",
  });
  assert.equal(result.eligibleToSubmit, true);
  assert.equal(result.eligibilityStatus, "MANUAL_REVIEW");
  assert.ok(result.reasons[0].message.includes("different currencies"));
  assert.ok(!result.reasons.some((reason) => reason.code === "BENEFIT_LIMIT"));
});

test("free-text plan exclusions are surfaced and routed to manual review", () => {
  const result = evaluateClaimEligibility({
    ...base,
    policy: {
      ...base.policy,
      exclusions: [{ title: "Known events", description: "Known events are excluded." }],
    },
  });
  assert.equal(result.eligibilityStatus, "MANUAL_REVIEW");
  assert.ok(result.policyConditions.some((condition) => condition.title === "Exclusion: Known events"));
});
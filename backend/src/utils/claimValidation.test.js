import test from "node:test";
import assert from "node:assert/strict";
import {
  getDateOnlyInTimeZone,
  getTodayDateOnly,
  normalizeClaimDate,
  validateClaimInput,
  validatePolicyEligibility,
} from "./claimValidation.js";

const validClaim = {
  policy_id: 1,
  incident_date: "2026-10-24",
  description: "Emergency travel expense for a delayed departure.",
  claimed_amount: "125.50",
};

test("validates an educational claim submission", () => {
  assert.deepEqual(validateClaimInput(validClaim), {
    policyId: 1,
    incidentDate: validClaim.incident_date,
    description: validClaim.description,
    claimedAmount: 125.5,
  });
});

test("rejects missing descriptions and invalid amounts", () => {
  assert.match(
    validateClaimInput({ ...validClaim, description: "short" }).message,
    /between 10 and 2000/
  );
  assert.match(
    validateClaimInput({ ...validClaim, claimed_amount: "12.345" }).message,
    /up to two decimals/
  );
  assert.match(
    validateClaimInput({ ...validClaim, claimed_amount: "-1" }).message,
    /non-negative/
  );
});

test("rejects invalid policy IDs and incident dates", () => {
  assert.match(
    validateClaimInput({ ...validClaim, policy_id: "not-an-id" }).message,
    /valid policy ID/
  );
  assert.match(
    validateClaimInput({ ...validClaim, incident_date: "2026-02-30" }).message,
    /incident date/
  );
});

test("requires an issued policy and an incident within its coverage dates", () => {
  const policy = {
    policy_status: "simulated_issued",
    coverage_start_date: "2020-01-01",
    coverage_end_date: "2020-01-05",
  };

  assert.equal(validatePolicyEligibility(policy, "2020-01-01"), null);
  assert.equal(validatePolicyEligibility(policy, "2020-01-05"), null);
  assert.match(
    validatePolicyEligibility(policy, "2019-12-31"),
    /within the simulated policy coverage dates/
  );
  assert.match(
    validatePolicyEligibility(policy, "2020-01-06"),
    /within the simulated policy coverage dates/
  );
  assert.match(
    validatePolicyEligibility(
      { ...policy, policy_status: "simulated_cancelled" },
      "2020-01-03"
    ),
    /only be submitted against an issued/
  );
});

test("rejects invalid calendar dates and future incidents", () => {
  assert.match(
    validateClaimInput({ ...validClaim, incident_date: "2026-02-30" }).message,
    /incident date/
  );

  const referenceDate = new Date("2026-10-24T19:46:00.000Z");
  const tomorrow = "2026-10-26";
  const policy = {
    policy_status: "simulated_issued",
    coverage_start_date: "2020-01-01",
    coverage_end_date: "2999-12-31",
  };
  assert.match(
    validatePolicyEligibility(policy, tomorrow, referenceDate),
    /cannot be in the future/
  );
});

test("uses the India calendar date when UTC is still on the previous day", () => {
  const utcReferenceDate = new Date("2026-10-24T19:46:00.000Z");

  assert.equal(
    getDateOnlyInTimeZone(utcReferenceDate, "Asia/Kolkata"),
    "2026-10-25"
  );
  assert.equal(getTodayDateOnly(utcReferenceDate), "2026-10-25");

  const policy = {
    policy_status: "simulated_issued",
    coverage_start_date: "2026-10-25",
    coverage_end_date: "2026-10-25",
  };
  assert.equal(
    validatePolicyEligibility(policy, "2026-10-25", utcReferenceDate),
    null
  );
  assert.match(
    validatePolicyEligibility(policy, "2026-10-26", utcReferenceDate),
    /cannot be in the future/
  );
});

test("normalizes MySQL DATE strings and Date objects without shifting coverage dates", () => {
  assert.equal(normalizeClaimDate("2026-10-24"), "2026-10-24");
  assert.equal(
    normalizeClaimDate(new Date("2026-10-23T18:30:00.000Z")),
    "2026-10-24"
  );

  const policy = {
    policy_status: "simulated_issued",
    coverage_start_date: new Date("2026-10-23T18:30:00.000Z"),
    coverage_end_date: new Date("2026-11-08T18:30:00.000Z"),
  };
  const referenceDate = new Date("2026-10-24T19:46:00.000Z");

  assert.equal(
    validatePolicyEligibility(policy, "2026-10-25", referenceDate),
    null
  );
  assert.equal(
    validatePolicyEligibility(
      { ...policy, coverage_start_date: "2026-10-24", coverage_end_date: "2026-11-09" },
      "2026-10-24",
      referenceDate
    ),
    null
  );
});

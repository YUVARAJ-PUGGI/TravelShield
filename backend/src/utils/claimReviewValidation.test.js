import test from "node:test";
import assert from "node:assert/strict";
import { validateClaimReviewInput, validateEvidenceReviewInput } from "./claimReviewValidation.js";

test("accepts documented demo review outcomes", () => {
  assert.deepEqual(validateClaimReviewInput({
    decision: "approved_demo",
    notes: "Required records reviewed for this educational simulation.",
  }), {
    decision: "approved_demo",
    notes: "Required records reviewed for this educational simulation.",
  });
});

test("rejects real approval states and missing notes", () => {
  assert.match(validateClaimReviewInput({ decision: "approved" }).message, /approved_demo/);
  assert.match(validateClaimReviewInput({ decision: "declined_demo", notes: "no" }).message, /10 and 2000/);
});

test("requires a reason when evidence needs correction", () => {
  assert.deepEqual(validateEvidenceReviewInput({ status: "verified" }), { status: "verified", notes: "" });
  assert.match(validateEvidenceReviewInput({ status: "needs_correction", notes: "no" }).message, /Explain what needs correction/);
});
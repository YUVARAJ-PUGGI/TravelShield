import test from "node:test";
import assert from "node:assert/strict";
import { matchesBenefitForDisruption } from "./claimCategory.js";

test("maps detailed disruption options to existing broad benefit families", () => {
  assert.equal(matchesBenefitForDisruption("travel_delay", "Travel"), true);
  assert.equal(matchesBenefitForDisruption("lost_damaged_baggage", "Baggage"), true);
  assert.equal(matchesBenefitForDisruption("emergency_medical_treatment", "Medical"), true);
  assert.equal(matchesBenefitForDisruption("travel_delay", "Baggage"), false);
});

test("supports detailed benefit categories when configured", () => {
  assert.equal(matchesBenefitForDisruption("travel_delay", "travel_delay"), true);
  assert.equal(matchesBenefitForDisruption("medical_evacuation_repatriation", "medical"), true);
});
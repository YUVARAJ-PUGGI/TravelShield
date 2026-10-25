import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEvidenceChecklist,
  normalizePlanBenefitRows,
} from "./planBenefitValidation.js";

test("normalizes benefit evidence checklists from MySQL JSON values", () => {
  assert.deepEqual(
    normalizePlanBenefitRows([
      { benefit_id: 1, required_evidence: '["Medical report", "Receipt"]' },
      { benefit_id: 2, required_evidence: ["Carrier notice"] },
    ]),
    [
      { benefit_id: 1, required_evidence: ["Medical report", "Receipt"] },
      { benefit_id: 2, required_evidence: ["Carrier notice"] },
    ]
  );
});

test("rejects invalid benefit evidence checklists", () => {
  assert.throws(
    () => normalizeEvidenceChecklist(["Medical report", ""]),
    /evidence checklist is invalid/
  );
  assert.throws(
    () => normalizeEvidenceChecklist("{not-json}"),
    SyntaxError
  );
});
